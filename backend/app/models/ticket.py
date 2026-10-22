from sqlalchemy import Column, Integer, String, Float, ForeignKey, Enum, DateTime, Date, Index, text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base
import enum


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EstadoTicket(str, enum.Enum):
    DISPONIBLE = "DISPONIBLE"
    RESERVADO = "RESERVADO"
    VENDIDO = "VENDIDO"
    CANCELADO = "CANCELADO"
    USADO = "USADO"

class Ticket(Base):
    __tablename__ = "tickets"
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
    piso = Column(Integer, default=1)
    tipo_documento = Column(String, nullable=True)
    documento = Column(String, nullable=True)
    nombres = Column(String, nullable=True)
    apellido_paterno = Column(String, nullable=True)
    apellido_materno = Column(String, nullable=True)
    sexo = Column(String, nullable=True)
    fecha_nacimiento = Column(Date, nullable=True)
    telefono = Column(String, nullable=True)
    precio_pagado = Column(Float, nullable=True)
    estado = Column(Enum(EstadoTicket), default=EstadoTicket.DISPONIBLE)
    codigo_reserva = Column(String, nullable=True, index=True)
    creado_en = Column(DateTime, default=_utcnow)

    route = relationship("Route", back_populates="tickets")

    @property
    def nombre_completo(self) -> str:
        apellidos = " ".join(p for p in (self.apellido_paterno, self.apellido_materno) if p)
        if apellidos and self.nombres:
            return f"{apellidos}, {self.nombres}"
        return self.nombres or apellidos or "Pasajero"
