from pydantic import BaseModel
from typing import Optional
from enum import Enum

class BusTipo(str, Enum):
    ECONOMICO = "ECONOMICO"
    EJECUTIVO = "EJECUTIVO"
    PREMIUM = "PREMIUM"

class BusCreate(BaseModel):
    placa: str
    modelo: str
    tipo: BusTipo = BusTipo.ECONOMICO
    capacidad_piso1: int = 20
    capacidad_piso2: int = 40

class BusResponse(BusCreate):
    id: int
    total_asientos: int
    class Config:
        from_attributes = True
