from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from ..database import get_db
from ..models.bus import Bus
from ..models.route import Route
from ..schemas.bus_schema import BusCreate, BusResponse
from ..schemas.ticket_schema import MAX_ID_DB
from ..core.deps import require_admin
from ..models.user import User
from ..services.ticket_service import asientos_ocupados

router = APIRouter()

PLACA_REGISTRADA = "Placa ya registrada"


@router.get("/", response_model=List[BusResponse])
def listar_buses(db: Session = Depends(get_db)):
    return db.query(Bus).order_by(Bus.id).all()


@router.post("/", response_model=BusResponse, status_code=201)
def crear_bus(data: BusCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    if db.query(Bus).filter(Bus.placa == data.placa).first():
        raise HTTPException(400, PLACA_REGISTRADA)
    bus = Bus(**data.model_dump(), total_asientos=data.capacidad_piso1 + data.capacidad_piso2)
    db.add(bus)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, PLACA_REGISTRADA)
    db.refresh(bus)
    return bus


@router.get("/{bus_id}/asientos")
def asientos_por_bus(
    bus_id: int = Path(..., ge=1, le=MAX_ID_DB),
    route_id: int = Query(..., ge=1, le=MAX_ID_DB, description="Viaje/ruta del que se quieren los asientos"),
    db: Session = Depends(get_db),
):
    bus = db.query(Bus).filter(Bus.id == bus_id).first()
    if not bus:
        raise HTTPException(404, "Bus no encontrado")
    ruta = db.query(Route).filter(Route.id == route_id, Route.bus_id == bus_id).first()
    if not ruta:
        raise HTTPException(404, "Esa ruta no pertenece a este bus")
    # Misma definición de inventario que /api/routes/{id}/asientos: los
    # tickets CANCELADO y DISPONIBLE no ocupan el asiento.
    return {
        "bus_id": bus_id,
        "route_id": route_id,
        "ocupados": asientos_ocupados(db, route_id),
        "total_piso1": bus.capacidad_piso1,
        "total_piso2": bus.capacidad_piso2,
    }
