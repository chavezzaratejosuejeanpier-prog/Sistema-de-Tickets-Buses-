from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Time
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base

class Route(Base):
    __tablename__ = "routes"
    id = Column(Integer, primary_key=True, index=True)
    origen = Column(String, nullable=False, index=True)
    destino = Column(String, nullable=False, index=True)
    fecha_salida = Column(DateTime, nullable=False)
    hora_salida = Column(String, nullable=False)  # "22:00"
    duracion_horas = Column(Float, default=8.0)
    precio_base = Column(Float, nullable=False)
    precio_vip = Column(Float, nullable=True)
    bus_id = Column(Integer, ForeignKey("buses.id"), nullable=False)
    
    bus = relationship("Bus", back_populates="viajes")
    tickets = relationship("Ticket", back_populates="route")
