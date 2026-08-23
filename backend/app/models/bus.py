from sqlalchemy import Column, Integer, String, Enum
from sqlalchemy.orm import relationship
from ..database import Base
import enum

class BusTipo(str, enum.Enum):
    ECONOMICO = "ECONOMICO"
    EJECUTIVO = "EJECUTIVO"
    PREMIUM = "PREMIUM"

class Bus(Base):
    __tablename__ = "buses"
    id = Column(Integer, primary_key=True, index=True)
    placa = Column(String, unique=True, nullable=False)
    modelo = Column(String, nullable=False)
    tipo = Column(Enum(BusTipo), default=BusTipo.ECONOMICO)
    capacidad_piso1 = Column(Integer, default=20)
    capacidad_piso2 = Column(Integer, default=40)
    total_asientos = Column(Integer, default=60)

    viajes = relationship("Route", back_populates="bus")
