import re
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from datetime import date, datetime, timedelta
from typing import Optional, List

from ..core.tiempo import hoy_lima

# Límites del pedido y de los datos de pasajero. Deben coincidir con las
# reglas de frontend/src/utils/validacion.js.
MAX_PASAJEROS_POR_COMPRA = 60
MAX_NUMERO_ASIENTO = 120
MAX_LARGO_NOMBRE = 80
MAX_PRECIO = 10_000.0
MAX_DURACION_HORAS = 72.0
MAX_DIAS_PROGRAMACION = 365
# Mayor ID representable en una columna INTEGER (PostgreSQL, 32 bits). Un
# ID mayor nunca existe y, sin este tope, SQLite fallaría con OverflowError.
MAX_ID_DB = 2_147_483_647
FECHA_NACIMIENTO_MINIMA = date(1900, 1, 1)

TIPOS_DOCUMENTO = {
    # tipo: (regex sobre el valor normalizado en mayúsculas)
    "DNI": re.compile(r"^\d{8}$"),
    "CE": re.compile(r"^[A-Z0-9-]{9,12}$"),
    "PASAPORTE": re.compile(r"^[A-Z0-9-]{6,12}$"),
}
SEXOS = {"MASCULINO", "FEMENINO"}
TELEFONO_RE = re.compile(r"^\+?\d{6,15}$")
HORA_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
RUC_RE = re.compile(r"^\d{11}$")
CARACTERES_NOMBRE = set(" '.-’")


def _texto_nombre(valor, campo: str, obligatorio: bool = True, minimo: int = 1):
    """Nombres y apellidos: letras (con tildes), espacios, apóstrofo, punto y guion."""
    if valor is None:
        valor = ""
    valor = " ".join(str(valor).split())
    if not valor:
        if obligatorio:
            raise ValueError(f"{campo} es obligatorio")
        return None
    if len(valor) < minimo or len(valor) > MAX_LARGO_NOMBRE:
        raise ValueError(f"{campo} debe tener entre {minimo} y {MAX_LARGO_NOMBRE} caracteres")
    if not all(c.isalpha() or c in CARACTERES_NOMBRE for c in valor):
        raise ValueError(f"{campo} solo admite letras, espacios, apóstrofo, punto y guion")
    if not any(c.isalpha() for c in valor):
        raise ValueError(f"{campo} debe contener letras")
    return valor


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
    numero_asiento: int = Field(ge=1, le=MAX_NUMERO_ASIENTO)
    tipo_documento: str = Field(max_length=20)
    documento: str = Field(max_length=20)
    nombres: str = Field(max_length=200)
    apellido_paterno: str = Field(max_length=200)
    apellido_materno: Optional[str] = Field("", max_length=200)
    sexo: Optional[str] = Field(None, max_length=20)
    fecha_nacimiento: Optional[date] = None
    telefono: Optional[str] = Field(None, max_length=25)

    @field_validator("tipo_documento")
    @classmethod
    def _tipo_documento(cls, valor: str) -> str:
        valor = valor.strip().upper()
        if valor not in TIPOS_DOCUMENTO:
            raise ValueError("Tipo de documento no admitido (DNI, CE o Pasaporte)")
        return valor

    @field_validator("nombres")
    @classmethod
    def _nombres(cls, valor: str) -> str:
        return _texto_nombre(valor, "Nombres", minimo=2)

    @field_validator("apellido_paterno")
    @classmethod
    def _paterno(cls, valor: str) -> str:
        return _texto_nombre(valor, "Apellido paterno")

    @field_validator("apellido_materno")
    @classmethod
    def _materno(cls, valor):
        return _texto_nombre(valor, "Apellido materno", obligatorio=False)

    @field_validator("sexo")
    @classmethod
    def _sexo(cls, valor):
        valor = (valor or "").strip().upper()
        if not valor:
            return None
        if valor not in SEXOS:
            raise ValueError("Sexo no admitido (Masculino o Femenino)")
        return valor

    @field_validator("fecha_nacimiento")
    @classmethod
    def _nacimiento(cls, valor):
        if valor is not None and not FECHA_NACIMIENTO_MINIMA <= valor <= hoy_lima():
            raise ValueError("La fecha de nacimiento no puede ser futura ni anterior a 1900")
        return valor

    @field_validator("telefono")
    @classmethod
    def _telefono(cls, valor):
        valor = re.sub(r"[\s\-()]", "", valor or "")
        if not valor:
            return None
        if not TELEFONO_RE.match(valor):
            raise ValueError("Teléfono inválido (6 a 15 dígitos, opcionalmente con +)")
        return valor

    @model_validator(mode="after")
    def _documento(self):
        valor = (self.documento or "").strip().upper()
        if not valor:
            raise ValueError("El documento es obligatorio")
        regla = TIPOS_DOCUMENTO[self.tipo_documento]
        if not regla.match(valor):
            if self.tipo_documento == "DNI":
                raise ValueError("El DNI debe tener 8 números")
            raise ValueError(f"Documento {self.tipo_documento} inválido")
        self.documento = valor
        return self


class CheckoutRequest(BaseModel):
    route_id: int = Field(ge=1, le=MAX_ID_DB)
    pasajeros: List[PasajeroCheckout] = Field(max_length=MAX_PASAJEROS_POR_COMPRA)
    email: EmailStr = Field(max_length=254)
    ruc: Optional[str] = Field(None, max_length=20)

    @field_validator("ruc")
    @classmethod
    def _ruc(cls, valor):
        valor = (valor or "").strip()
        if not valor:
            return None
        if not RUC_RE.match(valor):
            raise ValueError("El RUC debe tener 11 números")
        return valor


def _ciudad(valor: str, campo: str) -> str:
    valor = " ".join((valor or "").split())
    if not 2 <= len(valor) <= MAX_LARGO_NOMBRE or not all(c.isalpha() or c in CARACTERES_NOMBRE for c in valor):
        raise ValueError(f"{campo} inválido")
    return valor


class RouteCreate(BaseModel):
    origen: str = Field(max_length=MAX_LARGO_NOMBRE)
    destino: str = Field(max_length=MAX_LARGO_NOMBRE)
    fecha_salida: datetime
    hora_salida: str = Field(max_length=5)
    duracion_horas: float = Field(gt=0, le=MAX_DURACION_HORAS, allow_inf_nan=False)
    precio_base: float = Field(gt=0, le=MAX_PRECIO, allow_inf_nan=False)
    precio_vip: Optional[float] = Field(None, gt=0, le=MAX_PRECIO, allow_inf_nan=False)
    bus_id: int = Field(ge=1, le=MAX_ID_DB)

    @field_validator("origen")
    @classmethod
    def _origen(cls, valor: str) -> str:
        return _ciudad(valor, "Origen")

    @field_validator("destino")
    @classmethod
    def _destino(cls, valor: str) -> str:
        return _ciudad(valor, "Destino")

    @field_validator("hora_salida")
    @classmethod
    def _hora(cls, valor: str) -> str:
        valor = valor.strip()
        if not HORA_RE.match(valor):
            raise ValueError("Hora de salida inválida (HH:MM)")
        return valor

    @field_validator("fecha_salida")
    @classmethod
    def _fecha(cls, valor: datetime) -> datetime:
        if valor.tzinfo is not None:
            raise ValueError("La fecha de salida no debe incluir zona horaria")
        # Calendario de Lima (hora local de las salidas), no el del servidor.
        hoy = hoy_lima()
        if not hoy <= valor.date() <= hoy + timedelta(days=MAX_DIAS_PROGRAMACION):
            raise ValueError(f"La fecha de salida debe estar entre hoy y {MAX_DIAS_PROGRAMACION} días")
        return valor

    @model_validator(mode="after")
    def _par(self):
        if self.origen.casefold() == self.destino.casefold():
            raise ValueError("Origen y destino no pueden ser iguales")
        return self


class RouteResponse(BaseModel):
    # Sin las validaciones de entrada: debe serializar viajes existentes.
    id: int
    origen: str
    destino: str
    fecha_salida: datetime
    hora_salida: str
    duracion_horas: Optional[float] = None
    precio_base: float
    precio_vip: Optional[float] = None
    bus_id: int
    class Config:
        from_attributes = True

class RouteSearchResponse(BaseModel):
    id: int
    origen: str
    destino: str
    fecha_salida: datetime
    hora_salida: str
    precio_base: float
    duracion_horas: Optional[float] = None
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
    estado: str
    # Siempre True: no existe integración con una pasarela de pago real.
    pago_simulado: bool = True

class VentaResumen(BaseModel):
    total_ventas: int
    ventas_hoy: int
    recaudacion_total: float
    recaudacion_hoy: float
