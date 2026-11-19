import re
from pydantic import BaseModel, Field, field_validator, model_validator
from enum import Enum

PLACA_RE = re.compile(r"^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$")
MAX_ASIENTOS_POR_PISO = 60


class BusTipo(str, Enum):
    ECONOMICO = "ECONOMICO"
    EJECUTIVO = "EJECUTIVO"
    PREMIUM = "PREMIUM"

class BusCreate(BaseModel):
    placa: str = Field(min_length=4, max_length=10)
    modelo: str = Field(min_length=2, max_length=80)
    tipo: BusTipo = BusTipo.ECONOMICO
    capacidad_piso1: int = Field(20, ge=0, le=MAX_ASIENTOS_POR_PISO)
    capacidad_piso2: int = Field(40, ge=0, le=MAX_ASIENTOS_POR_PISO)

    @field_validator("placa")
    @classmethod
    def _placa(cls, valor: str) -> str:
        valor = valor.strip().upper()
        if not PLACA_RE.match(valor):
            raise ValueError("Placa inválida (ej. ABC-123)")
        return valor

    @field_validator("modelo")
    @classmethod
    def _modelo(cls, valor: str) -> str:
        valor = " ".join(valor.split())
        if len(valor) < 2 or any(not c.isprintable() for c in valor):
            raise ValueError("Modelo inválido")
        return valor

    @model_validator(mode="after")
    def _capacidad(self):
        if self.capacidad_piso1 + self.capacidad_piso2 < 1:
            raise ValueError("El bus debe tener al menos un asiento")
        return self


class BusResponse(BaseModel):
    # Sin validaciones de entrada: debe poder serializar buses existentes.
    id: int
    placa: str
    modelo: str
    tipo: BusTipo = BusTipo.ECONOMICO
    capacidad_piso1: int | None = None
    capacidad_piso2: int | None = None
    total_asientos: int | None = None
    class Config:
        from_attributes = True
