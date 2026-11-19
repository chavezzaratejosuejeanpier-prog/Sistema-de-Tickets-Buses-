from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from .database import engine, Base
from .database import get_db, SessionLocal
from .routers import buses, routes, sales, auth, reservas
from .models import Reserva
from .services import programa
from .core.config import settings
from .core.http import (
    BodySizeLimitMiddleware,
    ErroresInternosMiddleware,
    SecurityHeadersMiddleware,
    registrar_manejadores,
)
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import Depends
from .migraciones import aplicar_migraciones

Base.metadata.create_all(bind=engine)
aplicar_migraciones(engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        nuevas = programa.sincronizar_ventana(db)
        if nuevas:
            print(f"Programa de salidas: {nuevas} salidas creadas")
    finally:
        db.close()
    yield


app = FastAPI(
    title="BUSS ConnectPro API",
    description="Sistema de venta de pasajes - API REST desacoplada",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DOCS_ENABLED else None,
    redoc_url="/redoc" if settings.DOCS_ENABLED else None,
    openapi_url="/openapi.json" if settings.DOCS_ENABLED else None,
)

registrar_manejadores(app)

# Primero en añadirse = el más interno de los propios: un 500 no controlado
# también recibe CORS y cabeceras de seguridad.
app.add_middleware(ErroresInternosMiddleware)
# CORS solo para el servidor de desarrollo de Vite en loopback. La SPA usa
# Authorization: Bearer (sin cookies), por eso no se habilitan credenciales.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Content-Disposition", "Retry-After"],
)
app.add_middleware(BodySizeLimitMiddleware)
# Último en añadirse = más externo: también cubre respuestas 413 y CORS.
app.add_middleware(SecurityHeadersMiddleware)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(buses.router, prefix="/api/buses", tags=["Buses"])
app.include_router(routes.router, prefix="/api/routes", tags=["Rutas/Viajes"])
app.include_router(sales.router, prefix="/api/sales", tags=["Ventas"])
app.include_router(reservas.router, prefix="/api/reservas", tags=["Reservas/Check-in"])

@app.get("/")
def root():
    return {"mensaje": "BUSS ConnectPro API activa", "docs": "/docs" if settings.DOCS_ENABLED else None}

@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        # 503 para que el balanceador/orquestador deje de enviar tráfico.
        return JSONResponse(status_code=503, content={"status": "error", "database": "disconnected"})
    return {"status": "ok", "database": "connected"}
