from sqlalchemy import Column, Integer, String, Float, ForeignKey, Enum, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base
import enum

class EstadoTicket(str, enum.Enum):
    DISPONIBLE = "DISPONIBLE"
    RESERVADO = "RESERVADO"
    VENDIDO = "VENDIDO"
    CANCELADO = "CANCELADO"

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    numero_asiento = Column(Integer, nullable=False)
    piso = Column(Integer, default=1)  # 1 o 2
    pasajero_nombre = Column(String, nullable=True)
    pasajero_dni = Column(String, nullable=True)
    precio_pagado = Column(Float, nullable=True)
    estado = Column(Enum(EstadoTicket), default=EstadoTicket.DISPONIBLE)
    codigo_reserva = Column(String, unique=True, nullable=True)
    creado_en = Column(DateTime, default=datetime.utcnow)

    route = relationship("Route", back_populates="tickets")
