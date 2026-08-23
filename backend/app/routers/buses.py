from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.bus import Bus
from ..schemas.bus_schema import BusCreate, BusResponse
from typing import List

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
def mapa_asientos(bus_id: int, db: Session = Depends(get_db)):
    bus = db.query(Bus).filter(Bus.id == bus_id).first()
    if not bus: raise HTTPException(404, "Bus no encontrado")
    return {
        "bus_id": bus.id,
        "placa": bus.placa,
        "piso1": [{"numero": i, "tipo": "VIP" if i <= 4 else "ESTANDAR"} for i in range(1, bus.capacidad_piso1+1)],
        "piso2": [{"numero": i, "tipo": "ESTANDAR"} for i in range(1, bus.capacidad_piso2+1)],
    }
