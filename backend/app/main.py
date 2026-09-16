from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .database import get_db
from .routers import buses, routes, sales, auth
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import Depends

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="BUSS ConectPro API",
    description="Sistema de venta de pasajes - API REST desacoplada",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(buses.router, prefix="/api/buses", tags=["Buses"])
app.include_router(routes.router, prefix="/api/routes", tags=["Rutas/Viajes"])
app.include_router(sales.router, prefix="/api/sales", tags=["Ventas"])

@app.get("/")
def root():
    return {"mensaje": "BUSS ConectPro API activa", "docs": "/docs"}

@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
        status = "ok"
    except Exception:
        db_status = "disconnected"
        status = "error"
    return {"status": status, "database": db_status}
