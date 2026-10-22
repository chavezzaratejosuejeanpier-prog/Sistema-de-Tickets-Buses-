from sqlalchemy import Column, Integer, String, Float, ForeignKey, Enum, DateTime, Index, text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base
import enum


def _utcnow():
    # UTC naive, consistente con los datos ya guardados
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EstadoTicket(str, enum.Enum):
    DISPONIBLE = "DISPONIBLE"
    RESERVADO = "RESERVADO"
    VENDIDO = "VENDIDO"
    CANCELADO = "CANCELADO"
    USADO = "USADO"

class Ticket(Base):
    __tablename__ = "tickets"
    # Impide vender dos veces el mismo asiento de una ruta (race condition).
    # Los tickets CANCELADOS quedan fuera del indice: al cancelar, el asiento
    # se libera y otro pasajero puede comprarlo.
    __table_args__ = (
        Index(
            "uq_ticket_ruta_asiento",
            "route_id",
            "numero_asiento",
            unique=True,
            sqlite_where=text("estado != 'CANCELADO'"),
        ),
    )
    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    numero_asiento = Column(Integer, nullable=False)
    piso = Column(Integer, default=1)  # 1 o 2
    pasajero_nombre = Column(String, nullable=True)
    pasajero_dni = Column(String, nullable=True)
    precio_pagado = Column(Float, nullable=True)
    estado = Column(Enum(EstadoTicket), default=EstadoTicket.DISPONIBLE)
    # Sin unique: una compra genera N tickets que comparten el mismo codigo_reserva
    codigo_reserva = Column(String, nullable=True, index=True)
    creado_en = Column(DateTime, default=_utcnow)

    route = relationship("Route", back_populates="tickets")
