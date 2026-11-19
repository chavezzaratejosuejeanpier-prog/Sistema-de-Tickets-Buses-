from sqlalchemy import Column, Integer, String, Float, DateTime, CheckConstraint, ForeignKey, func
from ..database import Base

# Única modalidad de cobro existente: la compra no pasa por una pasarela real.
METODO_PAGO_SIMULADO = "SIMULADO"


class Reserva(Base):
    __tablename__ = "reservas"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('PAGADA', 'CANCELADA', 'REEMBOLSADA', 'USADA')",
            name="ck_reserva_estado",
        ),
    )
    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, nullable=True)
    ruc = Column(String, nullable=True)
    subtotal = Column(Float, nullable=False)
    igv = Column(Float, nullable=False)
    total_pagado = Column(Float, nullable=False)
    cantidad_asientos = Column(Integer, nullable=False)
    estado = Column(String, default="PAGADA", nullable=False)
    fecha_emision = Column(DateTime, server_default=func.now())
    # Titular: usuario autenticado que hizo la compra. NULL en reservas
    # históricas (anteriores a la titularidad): solo las consulta un ADMIN.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    # NULL en históricas; "SIMULADO" en compras de demostración sin cobro real.
    metodo_pago = Column(String, nullable=True)

    @property
    def pago_simulado(self) -> bool:
        # No existe integración de pago real: toda reserva es una simulación.
        return self.metodo_pago in (None, METODO_PAGO_SIMULADO)
