from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from jose import jwt
from datetime import datetime, timedelta, timezone
from ..database import get_db
from ..models.user import User
from ..schemas.user_schema import UserCreate, UserLogin, Token
from ..core.config import settings
from ..core.security import hashear_password, verificar_password, verificar_relleno
from ..core.rate_limit import consumir, marcar, reembolsar, vigente

router = APIRouter()

# Límites de intentos (en memoria, por proceso). Cache-Control: no-store
# para todo /api/auth lo añade SecurityHeadersMiddleware (core/http.py).
LOGIN_IP_MAX, LOGIN_IP_VENTANA = 5, 60
# Por cuenta y origen: un atacante desde otra IP no bloquea al titular.
LOGIN_CUENTA_IP_MAX, LOGIN_CUENTA_IP_VENTANA = 10, 15 * 60
# Tope global por cuenta contra ataques distribuidos. No se aplica a las IP
# desde las que el titular ya inició sesión correctamente (IP de confianza).
LOGIN_CUENTA_MAX, LOGIN_CUENTA_VENTANA = 50, 15 * 60
CONFIANZA_VENTANA = 7 * 24 * 60 * 60
REGISTRO_IP_MAX, REGISTRO_IP_VENTANA = 10, 60 * 60

CREDENCIALES_INVALIDAS = "Credenciales inválidas"
# Misma respuesta exista o no el correo: el registro no permite enumerar cuentas.
REGISTRO_RECIBIDO = (
    "Si el correo no estaba registrado, la cuenta quedó creada. "
    "Inicia sesión con tu correo y contraseña."
)


def _ip(request: Request) -> str:
    # Detrás de un proxy, ProxyConfiableMiddleware (PROXY_IPS_CONFIABLES y
    # PROXY_SALTOS) sustituye la IP del proxy por la del cliente.
    return request.client.host if request.client else "desconocido"


def crear_token(data: dict):
    to_encode = data.copy()
    ahora = datetime.now(timezone.utc)
    to_encode.update({"iat": ahora, "exp": ahora + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


@router.post("/register", status_code=201)
def register(data: UserCreate, request: Request, db: Session = Depends(get_db)):
    # Todo intento de registro consume presupuesto de la IP (atómico).
    consumir(
        [(f"registro:{_ip(request)}", REGISTRO_IP_MAX, REGISTRO_IP_VENTANA)],
        "Demasiados registros desde esta conexión. Inténtalo más tarde.",
    )
    # El hash se calcula siempre para que el tiempo no delate si existe.
    hashed = hashear_password(data.password)
    if db.query(User.id).filter(User.email == data.email).first() is None:
        db.add(User(email=data.email, nombre=data.nombre, hashed_password=hashed))
        try:
            db.commit()
        except IntegrityError:
            # Registro simultáneo del mismo correo: misma respuesta.
            db.rollback()
    return {"mensaje": REGISTRO_RECIBIDO}


@router.post("/login", response_model=Token)
def login(data: UserLogin, request: Request, db: Session = Depends(get_db)):
    ip = _ip(request)
    cuenta = data.email.lower()
    clave_confianza = f"login:confianza:{cuenta}:{ip}"
    confiable = vigente(clave_confianza, CONFIANZA_VENTANA)
    # Cada intento reserva su cupo antes de verificar la contraseña, de
    # forma atómica: peticiones concurrentes no superan el límite.
    marca = consumir([
        (f"login:ip:{ip}", LOGIN_IP_MAX, LOGIN_IP_VENTANA),
        (f"login:cuenta-ip:{cuenta}:{ip}", LOGIN_CUENTA_IP_MAX, LOGIN_CUENTA_IP_VENTANA),
        (f"login:cuenta:{cuenta}", None if confiable else LOGIN_CUENTA_MAX, LOGIN_CUENTA_VENTANA),
    ])

    user = db.query(User).filter(User.email == data.email).first()
    if user is None:
        verificar_relleno(data.password)
        valido = False
    else:
        valido = verificar_password(data.password, user.hashed_password)
    if not valido:
        # El cupo reservado queda como fallo.
        raise HTTPException(401, CREDENCIALES_INVALIDAS)
    # Contraseña correcta: solo se devuelve el cupo de este intento; los
    # fallos previos de la IP siguen contando.
    reembolsar(marca)
    if not user.is_active:
        # Nunca se emite token a una cuenta desactivada.
        raise HTTPException(403, "Cuenta desactivada. Contacta al administrador.")
    marcar(clave_confianza, CONFIANZA_VENTANA)
    token = crear_token({"sub": user.email, "rol": user.rol.value})
    return {"access_token": token, "token_type": "bearer", "rol": user.rol.value, "nombre": user.nombre}
