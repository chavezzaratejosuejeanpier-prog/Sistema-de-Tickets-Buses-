from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class TicketCreate(BaseModel):
    route_id: int
    numero_asiento: int
    piso: int = 1
    pasajero_nombre: str
    pasajero_dni: str

class TicketResponse(BaseModel):
    id: int
    route_id: int
    numero_asiento: int
    piso: int
    estado: str
    codigo_reserva: Optional[str] = None
    precio_pagado: Optional[float] = None
    pasajero_nombre: Optional[str] = None
    class Config:
        from_attributes = True

class CheckoutRequest(BaseModel):
    route_id: int
    asientos: List[int]
    pasajero_nombre: str
    pasajero_dni: str
    email: str

class RouteCreate(BaseModel):
    origen: str
    destino: str
    fecha_salida: datetime
    hora_salida: str
    duracion_horas: float
    precio_base: float
    precio_vip: Optional[float] = None
    bus_id: int

class RouteResponse(RouteCreate):
    id: int
    class Config:
        from_attributes = True

class RouteSearchResponse(BaseModel):
    id: int
    origen: str
    destino: str
    fecha_salida: datetime
    hora_salida: str
    precio_base: float
    asientos_disponibles: int
    bus_placa: str
    bus_tipo: str
