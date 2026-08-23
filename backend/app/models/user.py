from sqlalchemy import Column, Integer, String, Boolean, Enum
from ..database import Base
import enum

class RolUsuario(str, enum.Enum):
    ADMIN = "ADMIN"
    VENDEDOR = "VENDEDOR"
    CLIENTE = "CLIENTE"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    nombre = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    rol = Column(Enum(RolUsuario), default=RolUsuario.CLIENTE)
    is_active = Column(Boolean, default=True)
