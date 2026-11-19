"""Aplicación FastAPI.

Al importar o arrancar NO se ejecuta DDL: el esquema se crea y actualiza
solo con `python migrar.py`. Al arrancar se verifica que la base esté en la
revisión requerida y, si no lo está, la API no se inicia.
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from .core.config import settings
from .core.http import (
    BodySizeLimitMiddleware,
    ErroresInternosMiddleware,
    SecurityHeadersMiddleware,
    registrar_manejadores,
    resumen_traza,
)
from .core.red import HostPermitidoMiddleware, ProxyConfiableMiddleware
from .core.registro import RegistroAccesoMiddleware, configurar_registro
from .core.spa import MontajeSpa, SpaEstatica
from .database import SessionLocal, engine, get_db
from .esquema import EsquemaDesactualizado, revision_actual, revision_head, verificar_esquema
from .routers import auth, buses, reservas, routes, sales
from .services import programa

logger = logging.getLogger("buss.api")

# Sin DDL: el build del frontend se carga (y valida) al importar.
spa = SpaEstatica(Path(settings.FRONTEND_DIST)) if settings.SERVIR_FRONTEND else None


class ArranqueFallido(RuntimeError):
    """Fallo de arranque sin el mensaje original.

    Starlette envía a Uvicorn `traceback.format_exc()` del fallo del
    lifespan y Uvicorn lo registra tal cual: el mensaje de un error de
    conexión puede incluir host, usuario, base, SQL o datos. Por eso se
    sustituye por esta excepción sin contexto encadenado.
    """


def _arrancar() -> None:
    revision = verificar_esquema(engine)
    logger.info(
        "API iniciada: entorno=%s motor=%s esquema=%s frontend=%s",
        settings.ENTORNO, settings.motor_bd, revision, "si" if spa else "no",
    )
    if not settings.PROGRAMA_DEMO_AL_ARRANCAR:
        return
    if settings.es_produccion:
        # Los datos de demostración nunca se generan solos en producción.
        logger.warning("PROGRAMA_DEMO_AL_ARRANCAR se ignora en produccion")
        return
    db = SessionLocal()
    try:
        nuevas = programa.sincronizar_ventana(db)
        if nuevas:
            logger.info("Programa de salidas: %d salidas creadas", nuevas)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        configurar_registro(settings.LOG_LEVEL, settings.LOG_FORMAT)
        try:
            _arrancar()
        except EsquemaDesactualizado as exc:
            # Mensaje propio: solo revisiones y la orden a ejecutar.
            logger.critical("%s", exc)
            raise
        except Exception as exc:
            logger.critical("La API no pudo iniciar: %s", resumen_traza(exc))
            raise ArranqueFallido(
                "La API no pudo iniciar (base de datos o configuración). Revisa el registro anterior."
            ) from None
        yield
    finally:
        # También si el arranque falla: no deja conexiones abiertas.
        engine.dispose()


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
# CORS: en producción la SPA se sirve en el mismo origen y no lo necesita.
# Solo orígenes exactos de CORS_ORIGENES y, en desarrollo/pruebas, el
# servidor de Vite en loopback. Authorization: Bearer, sin cookies, por eso
# no se habilitan credenciales.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origenes,
    allow_origin_regex=None if settings.es_produccion else r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Content-Disposition", "Retry-After", "X-Request-ID"],
)
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware, spa=spa)
app.add_middleware(HostPermitidoMiddleware, permitidos=settings.hosts_permitidos)
app.add_middleware(RegistroAccesoMiddleware)
# Último en añadirse = más externo: IP real y esquema (HSTS) para todo lo demás.
app.add_middleware(
    ProxyConfiableMiddleware,
    confiables=settings.proxy_ips_confiables,
    saltos=settings.PROXY_SALTOS,
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(buses.router, prefix="/api/buses", tags=["Buses"])
app.include_router(routes.router, prefix="/api/routes", tags=["Rutas/Viajes"])
app.include_router(sales.router, prefix="/api/sales", tags=["Ventas"])
app.include_router(reservas.router, prefix="/api/reservas", tags=["Reservas/Check-in"])


def _db_disponible(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1"))
        return True
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        return False


@app.get("/health")
def health(db: Session = Depends(get_db)):
    if not _db_disponible(db):
        # 503 para que el balanceador/orquestador deje de enviar tráfico.
        return JSONResponse(status_code=503, content={"status": "error", "database": "disconnected"})
    return {"status": "ok", "database": "connected"}


@app.get("/health/live")
def health_live():
    """Liveness: el proceso responde (no consulta la base)."""
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready(db: Session = Depends(get_db)):
    """Readiness: base accesible y esquema en la revisión requerida."""
    if not _db_disponible(db):
        return JSONResponse(status_code=503, content={"status": "error", "database": "disconnected"})
    try:
        al_dia = revision_actual(db.connection()) == revision_head()
    except Exception:
        al_dia = False
    if not al_dia:
        return JSONResponse(status_code=503, content={"status": "error", "database": "connected", "schema": "pending"})
    return {"status": "ok", "database": "connected", "schema": "ok"}


if spa is not None:
    # Después de todas las rutas y sin reclamar /api, /health ni /docs.
    app.router.routes.append(MontajeSpa(spa))
else:
    @app.get("/")
    def root():
        return {"mensaje": "BUSS ConnectPro API activa", "docs": "/docs" if settings.DOCS_ENABLED else None}
