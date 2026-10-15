from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    nombre: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=6, max_length=128)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

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
