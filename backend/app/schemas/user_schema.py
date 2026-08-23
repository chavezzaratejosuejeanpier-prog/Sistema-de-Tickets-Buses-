from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    nombre: str
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: int
    email: str
    nombre: str
    rol: str
    class Config:
        from_attributes = True
