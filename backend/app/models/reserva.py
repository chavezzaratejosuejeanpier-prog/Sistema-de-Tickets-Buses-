from sqlalchemy import Column, Integer, String, Float, DateTime, CheckConstraint, func
from ..database import Base


class Reserva(Base):
    __tablename__ = "reservas"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('PAGADA', 'CANCELADA', 'REEMBOLSADA', 'USADA')",
            name="ck_reserva_estado",
        ),
    )
    id = Column(Integer, primary_key=True, index=True)
    # Mismo codigo que tickets.codigo_reserva (BC-XXXXXXXX)
    codigo = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, nullable=True)
    subtotal = Column(Float, nullable=False)
    igv = Column(Float, nullable=False)
    total_pagado = Column(Float, nullable=False)
    cantidad_asientos = Column(Integer, nullable=False)
    estado = Column(String, default="PAGADA", nullable=False)
    fecha_emision = Column(DateTime, server_default=func.now())
