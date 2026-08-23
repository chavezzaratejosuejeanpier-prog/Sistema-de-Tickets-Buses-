from pydantic import BaseModel
from typing import List, Optional

class AsientoBase(BaseModel):
    numero_asiento: int
    piso: int
    estado: str

class ReservaRequest(BaseModel):
    asientos_ids: List[int]
    fecha_viaje: str

class Pasajero(BaseModel):
    asiento_id: int
    dni: str
    nombres: str

class VentaRequest(BaseModel):
    origen: str
    destino: str
    total: float
    pasajeros: List[Pasajero]