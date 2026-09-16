import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from jose import jwt
from datetime import datetime, timedelta
from ..database import get_db
from ..models.user import User
from ..schemas.user_schema import UserCreate, UserLogin, Token
from ..core.config import settings

router = APIRouter()

def hashear_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verificar_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

def crear_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
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
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verificar_password(data.password, user.hashed_password):
        raise HTTPException(401, "Credenciales inválidas")
    token = crear_token({"sub": user.email, "rol": user.rol.value})
    return {"access_token": token, "token_type": "bearer"}
