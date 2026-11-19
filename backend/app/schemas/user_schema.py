from pydantic import BaseModel, EmailStr, Field, field_validator

from ..core.security import MAX_BYTES_PASSWORD, MIN_LARGO_PASSWORD, password_demasiado_larga


class UserCreate(BaseModel):
    email: EmailStr = Field(max_length=254)
    nombre: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=MIN_LARGO_PASSWORD, max_length=128)

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, valor: str) -> str:
        valor = " ".join(valor.split())
        if len(valor) < 3:
            raise ValueError("El nombre debe tener al menos 3 caracteres")
        if any(not c.isprintable() for c in valor):
            raise ValueError("El nombre contiene caracteres no permitidos")
        return valor

    @field_validator("password")
    @classmethod
    def _password(cls, valor: str) -> str:
        if password_demasiado_larga(valor):
            raise ValueError(f"La contraseña no puede superar {MAX_BYTES_PASSWORD} bytes")
        if not valor.strip():
            raise ValueError("La contraseña no puede estar vacía")
        return valor


class UserLogin(BaseModel):
    email: EmailStr = Field(max_length=254)
    # Sin política aquí: cuentas antiguas pueden tener contraseñas cortas.
    password: str = Field(min_length=1, max_length=256)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    rol: str
    nombre: str

class UserResponse(BaseModel):
    id: int
    email: str
    nombre: str
    rol: str
    class Config:
        from_attributes = True
