from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.bus import Bus
from ..models.route import Route
from ..models.ticket import Ticket, EstadoTicket
from ..schemas.bus_schema import BusCreate, BusResponse

router = APIRouter()

@router.get("/", response_model=List[BusResponse])
def listar_buses(db: Session = Depends(get_db)):
    return db.query(Bus).all()

@router.post("/", response_model=BusResponse, status_code=201)
def crear_bus(data: BusCreate, db: Session = Depends(get_db)):
    if db.query(Bus).filter(Bus.placa == data.placa).first():
        raise HTTPException(400, "Placa ya registrada")
    bus = Bus(**data.model_dump(), total_asientos=data.capacidad_piso1 + data.capacidad_piso2)
    db.add(bus); db.commit(); db.refresh(bus)
    return bus

@router.get("/{bus_id}/asientos")
def asientos_por_bus(bus_id: int, db: Session = Depends(get_db)):
    bus = db.query(Bus).filter(Bus.id == bus_id).first()
    if not bus:
        raise HTTPException(404, "Bus no encontrado")
    tickets = (
        db.query(Ticket)
        .join(Route, Ticket.route_id == Route.id)
        .filter(Route.bus_id == bus_id, Ticket.estado != EstadoTicket.DISPONIBLE)
        .all()
    )
    ocupados = [t.numero_asiento for t in tickets]
    return {"bus_id": bus_id, "ocupados": ocupados, "total_piso1": bus.capacidad_piso1, "total_piso2": bus.capacidad_piso2}
