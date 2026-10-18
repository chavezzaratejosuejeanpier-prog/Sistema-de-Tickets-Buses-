from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from jose import jwt
from datetime import datetime, timedelta, timezone
from ..database import get_db
from ..models.user import User
from ..schemas.user_schema import UserCreate, UserLogin, Token
from ..core.config import settings
from ..core.security import hashear_password, verificar_password
from ..core.rate_limit import verificar_limite, registrar_fallo, limpiar

router = APIRouter()

def crear_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

@router.post("/register", status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Email ya registrado")
    user = User(email=data.email, nombre=data.nombre, hashed_password=hashear_password(data.password))
    db.add(user); db.commit(); db.refresh(user)
    return {"id": user.id, "email": user.email}

@router.post("/login", response_model=Token)
def login(data: UserLogin, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "desconocido"
    clave = f"login:{ip}"
    verificar_limite(clave)
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verificar_password(data.password, user.hashed_password):
        registrar_fallo(clave)
        raise HTTPException(401, "Credenciales inválidas")
    limpiar(clave)
    token = crear_token({"sub": user.email, "rol": user.rol.value})
    return {"access_token": token, "token_type": "bearer", "rol": user.rol.value, "nombre": user.nombre}
