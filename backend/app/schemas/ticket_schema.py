from pydantic import BaseModel, EmailStr
from datetime import date, datetime
from typing import Optional, List

class TicketCreate(BaseModel):
    route_id: int
    numero_asiento: int
    piso: int = 1
    tipo_documento: str
    documento: str
    nombres: str
    apellido_paterno: str
    apellido_materno: Optional[str] = None
    sexo: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    telefono: Optional[str] = None

class TicketResponse(BaseModel):
    id: int
    route_id: int
    numero_asiento: int
    piso: int
    estado: str
    codigo_reserva: Optional[str] = None
    precio_pagado: Optional[float] = None
    tipo_documento: Optional[str] = None
    documento: Optional[str] = None
    nombres: Optional[str] = None
    apellido_paterno: Optional[str] = None
    apellido_materno: Optional[str] = None
    sexo: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    telefono: Optional[str] = None
    class Config:
        from_attributes = True

class PasajeroCheckout(BaseModel):
    numero_asiento: int
    tipo_documento: str
    documento: str
    nombres: str
    apellido_paterno: str
    apellido_materno: Optional[str] = ""
    sexo: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    telefono: Optional[str] = None

class CheckoutRequest(BaseModel):
    route_id: int
    pasajeros: List[PasajeroCheckout]
    email: EmailStr
    ruc: Optional[str] = None

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
    duracion_horas: float
    asientos_disponibles: int
    bus_placa: str
    bus_tipo: str

class ProximasSalidasResponse(BaseModel):
    total: int
    pares: int
    rutas: List[RouteResponse]

class CheckoutResponse(BaseModel):
    mensaje: str
    codigo_reserva: str
    email: EmailStr
    asientos: List[int]
    total: float

class VentaResumen(BaseModel):
    total_ventas: int
    ventas_hoy: int
    recaudacion_total: float
    recaudacion_hoy: float
