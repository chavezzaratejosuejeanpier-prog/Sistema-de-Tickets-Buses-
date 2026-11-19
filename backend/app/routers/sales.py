from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from fastapi.security import HTTPAuthorizationCredentials
from ..core.config import settings
from ..core.rate_limit import consumir
from ..core.tiempo import hoy_lima, inicio_dia_lima_en_utc
from ..services import programa
from ..database import get_db
from ..models.ticket import Ticket, EstadoTicket
from ..models.route import Route
from ..models.reserva import Reserva, METODO_PAGO_SIMULADO
from ..schemas.ticket_schema import CheckoutRequest, CheckoutResponse, CheckoutInvitadoResponse, VentaResumen
from ..services.ticket_service import verificar_disponibilidad, calcularMontos, ESTADOS_VENDIDOS
from ..services.boleto_pdf import generar_pdf_boletos
from ..core.deps import require_admin, get_current_user, bearer_scheme
from ..models.user import User, RolUsuario

router = APIRouter()

# Las respuestas con datos de reservas no deben guardarse en cachés
# del navegador ni de intermediarios.
NO_STORE = {"Cache-Control": "no-store, max-age=0", "Pragma": "no-cache"}
# Respuesta idéntica para un código inexistente, ajeno o histórico sin
# titular: no revela si el código existe.
RESERVA_NO_ENCONTRADA = "Reserva no encontrada"
MENSAJE_SIMULADO = "Compra de demostración registrada: pago simulado, no se realizó ningún cobro real."
ESTADOS_RESERVA_ANULADA = ("CANCELADA", "REEMBOLSADA")
MAX_LARGO_CODIGO = 32


def _no_encontrada() -> HTTPException:
    return HTTPException(404, RESERVA_NO_ENCONTRADA, headers=NO_STORE)


def _normalizar_codigo(codigo: str) -> str:
    return (codigo or "").strip().upper()


def _cargar_reserva(db: Session, codigo: str):
    return (
        db.query(Ticket)
        .options(joinedload(Ticket.route).joinedload(Route.bus))
        .filter(Ticket.codigo_reserva == codigo)
        .order_by(Ticket.id)
        .all()
    )


def _reserva_autorizada(db: Session, codigo: str, user: User):
    """Devuelve (codigo, reserva, tickets) si `user` es el titular o ADMIN.

    La titularidad se decide solo por `reserva.user_id` frente al ID del
    usuario autenticado; nunca por email ni por datos enviados por el cliente.
    Reservas históricas (sin titular) y tickets sin reserva: solo ADMIN.
    """
    codigo = _normalizar_codigo(codigo)
    if not codigo or len(codigo) > MAX_LARGO_CODIGO:
        raise _no_encontrada()
    es_admin = user.rol == RolUsuario.ADMIN
    reserva = db.query(Reserva).filter(Reserva.codigo == codigo).first()
    if not es_admin and (reserva is None or reserva.user_id is None or reserva.user_id != user.id):
        raise _no_encontrada()
    tickets = _cargar_reserva(db, codigo)
    if not tickets:
        raise _no_encontrada()
    return codigo, reserva, tickets


def _documento_enmascarado(t: Ticket) -> str | None:
    documento = (t.documento or "").strip()
    if not documento:
        return None
    visibles = documento[-3:] if len(documento) > 4 else ""
    tipo = (t.tipo_documento or "").strip()
    return " ".join(p for p in (tipo, "*" * max(len(documento) - len(visibles), 1) + visibles) if p)


def _datos_pdf(codigo: str, reserva: Reserva | None, tickets: list[Ticket]) -> dict:
    """Datos mínimos para el PDF: sin teléfono, sexo ni fecha de nacimiento,
    documento enmascarado y sin el email del comprador."""
    return {
        "codigo": codigo,
        "pago_simulado": reserva.pago_simulado if reserva else True,
        "total": sum(float(t.precio_pagado or 0) for t in tickets),
        "tickets": [
            {
                "id": t.id,
                "numero_boleto": f"LUX-{t.id:06d}",
                "codigo_reserva": t.codigo_reserva,
                "numero_asiento": t.numero_asiento,
                "piso": t.piso,
                "documento": _documento_enmascarado(t),
                "nombres": t.nombres,
                "apellido_paterno": t.apellido_paterno,
                "apellido_materno": t.apellido_materno,
                "precio_pagado": t.precio_pagado,
                "origen": t.route.origen if t.route else None,
                "destino": t.route.destino if t.route else None,
                "fecha_salida": t.route.fecha_salida if t.route else None,
                "hora_salida": t.route.hora_salida if t.route else None,
                "duracion_horas": t.route.duracion_horas if t.route else None,
                "bus_placa": t.route.bus.placa if t.route and t.route.bus else None,
                "bus_modelo": t.route.bus.modelo if t.route and t.route.bus else None,
                "bus_tipo": t.route.bus.tipo.value if t.route and t.route.bus else None,
            }
            for t in tickets
        ],
    }


@router.get("/", response_model=VentaResumen)
def resumen_ventas(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    vendido = Ticket.estado.in_(ESTADOS_VENDIDOS)
    # creado_en se guarda en UTC: medianoche de Lima expresada en UTC.
    inicio_hoy = inicio_dia_lima_en_utc(hoy_lima())
    total_ventas = db.query(func.count(Ticket.id)).filter(vendido).scalar() or 0
    recaudacion_total = db.query(func.coalesce(func.sum(Ticket.precio_pagado), 0.0)).filter(vendido).scalar() or 0.0
    ventas_hoy = db.query(func.count(Ticket.id)).filter(vendido, Ticket.creado_en >= inicio_hoy).scalar() or 0
    recaudacion_hoy = db.query(func.coalesce(func.sum(Ticket.precio_pagado), 0.0)).filter(vendido, Ticket.creado_en >= inicio_hoy).scalar() or 0.0
    return {
        "total_ventas": total_ventas,
        "ventas_hoy": ventas_hoy,
        "recaudacion_total": round(float(recaudacion_total), 2),
        "recaudacion_hoy": round(float(recaudacion_hoy), 2),
    }

@router.post("/checkout", response_model=CheckoutResponse)
def checkout(
    data: CheckoutRequest,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    response.headers.update(NO_STORE)
    return _registrar_compra(data, db, user)


AUDIENCIA_PDF = "lux:pdf-invitado"


def _limitar_invitado(request: Request, operacion: str, maximo: int):
    ip = request.client.host if request.client else "desconocido"
    consumir([(f"invitado:{operacion}:{ip}", maximo, 60)], "Demasiadas solicitudes. Inténtalo en un minuto.")


@router.post("/checkout/invitado", response_model=CheckoutInvitadoResponse)
def checkout_invitado(data: CheckoutRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    response.headers.update(NO_STORE)
    if "authorization" in request.headers:
        raise HTTPException(400, "Usa el checkout de tu cuenta para comprar con sesión.")
    _limitar_invitado(request, "compra", 6)
    return _registrar_compra(data, db, None)


def _registrar_compra(data: CheckoutRequest, db: Session, user: User | None):
    # Los formatos (documento, nombres, teléfono, RUC, límites) los valida
    # CheckoutRequest; aquí van las reglas que dependen de la base de datos.
    ruta = db.query(Route).filter(Route.id == data.route_id).first()
    if not ruta or ruta.bus is None:
        raise HTTPException(404, "Ruta no encontrada")
    # Corte real: fecha y hora de salida frente a la hora actual de Lima.
    if programa.ya_salio(ruta):
        raise HTTPException(400, "Este viaje ya salió; elige otra fecha")

    if not data.pasajeros:
        raise HTTPException(400, "Debe elegir al menos un asiento")

    capacidad_piso1 = ruta.bus.capacidad_piso1 or 0
    capacidad = capacidad_piso1 + (ruta.bus.capacidad_piso2 or 0)
    vistos = set()
    for pasajero in data.pasajeros:
        if pasajero.numero_asiento in vistos:
            raise HTTPException(400, f"Asiento {pasajero.numero_asiento} duplicado en la solicitud")
        vistos.add(pasajero.numero_asiento)
        if not 1 <= pasajero.numero_asiento <= capacidad:
            raise HTTPException(400, f"Asiento {pasajero.numero_asiento} fuera del bus")
    for pasajero in data.pasajeros:
        if not verificar_disponibilidad(db, data.route_id, pasajero.numero_asiento):
            raise HTTPException(409, f"Asiento {pasajero.numero_asiento} ya vendido")

    ruc = data.ruc
    codigo = f"BC-{uuid.uuid4().hex[:8].upper()}"
    # Un código histórico puede tener boletos sin fila en reservas.
    if db.query(Ticket.id).filter_by(codigo_reserva=codigo).first():
        raise HTTPException(409, "No se pudo asignar el código de reserva. Inténtalo de nuevo.")
    precio_unitario, subtotal, igv, total = calcularMontos(ruta.precio_base, len(data.pasajeros))

    reserva = Reserva(
        codigo=codigo,
        email=data.email,
        ruc=ruc or None,
        subtotal=subtotal,
        igv=igv,
        total_pagado=total,
        cantidad_asientos=len(data.pasajeros),
        estado="PAGADA",
        # Titular = usuario autenticado del token; nunca un dato del cliente.
        user_id=user.id if user else None,
        metodo_pago=METODO_PAGO_SIMULADO,
    )
    db.add(reserva)

    for pasajero in data.pasajeros:
        # Valores ya normalizados por PasajeroCheckout.
        db.add(Ticket(
            route_id=data.route_id,
            numero_asiento=pasajero.numero_asiento,
            piso=1 if pasajero.numero_asiento <= capacidad_piso1 else 2,
            tipo_documento=pasajero.tipo_documento,
            documento=pasajero.documento,
            nombres=pasajero.nombres,
            apellido_paterno=pasajero.apellido_paterno,
            apellido_materno=pasajero.apellido_materno,
            sexo=pasajero.sexo,
            fecha_nacimiento=pasajero.fecha_nacimiento,
            telefono=pasajero.telefono,
            precio_pagado=precio_unitario,
            estado=EstadoTicket.VENDIDO,
            codigo_reserva=codigo
        ))
    # Reserva y tickets se confirman en un único commit: o se registra todo
    # o nada. El índice único parcial resuelve la carrera por un asiento.
    try:
        permiso = {}
        if user is None:
            db.flush()
            # Se firma antes del commit y solo se entrega si este tiene éxito.
            permiso["token_pdf"] = jwt.encode({
                "aud": AUDIENCIA_PDF, "reserva_id": reserva.id, "codigo": codigo,
                "jti": uuid.uuid4().hex,
                "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
            }, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        db.commit()
    except IntegrityError:
        db.rollback()
        tomados = [p.numero_asiento for p in data.pasajeros
                   if not verificar_disponibilidad(db, data.route_id, p.numero_asiento)]
        if tomados:
            raise HTTPException(409, f"Asiento {', '.join(map(str, tomados))} ya vendido por otra persona")
        raise HTTPException(409, "No se pudo registrar la compra por un conflicto de datos; vuelve a intentarlo")

    return {
        **permiso,
        "mensaje": MENSAJE_SIMULADO,
        "codigo_reserva": codigo,
        "email": data.email,
        "asientos": [p.numero_asiento for p in data.pasajeros],
        "total": total,
        "estado": "PAGADA",
        "pago_simulado": True,
    }

@router.get("/mis-reservas")
def mis_reservas(response: Response, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    response.headers.update(NO_STORE)
    filas = (db.query(Reserva.codigo, Reserva.estado)
             .filter(Reserva.user_id == user.id).order_by(Reserva.id.desc()).all())
    return [{"codigo": codigo, "estado": estado} for codigo, estado in filas]


@router.post("/invitado/pdf")
def pdf_invitado(request: Request, db: Session = Depends(get_db),
                 permiso: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    _limitar_invitado(request, "pdf", 30)
    if permiso is None or len(permiso.credentials) > 1024:
        raise _no_encontrada()
    try:
        claims = jwt.decode(permiso.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM],
                            audience=AUDIENCIA_PDF, options={"require_exp": True, "require_aud": True,
                                                             "require_reserva_id": True, "require_codigo": True})
    except JWTError:
        raise _no_encontrada() from None
    reserva = db.query(Reserva).filter_by(id=claims["reserva_id"], codigo=claims["codigo"], user_id=None).first()
    if reserva is None:
        raise _no_encontrada()
    return _pdf_vigente(reserva.codigo, reserva, _cargar_reserva(db, reserva.codigo))


@router.get("/tickets/{codigo}")
def obtener_ticket(
    codigo: str,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    response.headers.update(NO_STORE)
    codigo, reserva, tickets = _reserva_autorizada(db, codigo, user)
    estado_reserva = reserva.estado if reserva else None
    pago_simulado = reserva.pago_simulado if reserva else True
    respuesta = []
    for t in tickets:
        ruta = t.route
        # Datos mínimos para mostrar el pasaje: sin documento, teléfono,
        # sexo ni fecha de nacimiento.
        respuesta.append({
            "id": t.id,
            "route_id": t.route_id,
            "numero_asiento": t.numero_asiento,
            "piso": t.piso,
            "estado": t.estado.value,
            "codigo_reserva": t.codigo_reserva,
            "estado_reserva": estado_reserva,
            "pago_simulado": pago_simulado,
            "pasajero_nombre": t.nombre_completo,
            "precio_pagado": t.precio_pagado,
            "origen": ruta.origen if ruta else None,
            "destino": ruta.destino if ruta else None,
            "fecha_salida": ruta.fecha_salida if ruta else None,
            "hora_salida": ruta.hora_salida if ruta else None,
            "bus_placa": ruta.bus.placa if ruta and ruta.bus else None,
        })
    return respuesta


@router.get("/tickets/{codigo}/pdf")
def pdf_ticket(
    codigo: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    codigo, reserva, tickets = _reserva_autorizada(db, codigo, user)

    return _pdf_vigente(codigo, reserva, tickets)


def _pdf_vigente(codigo, reserva, tickets):
    vigentes = [t for t in tickets if t.estado in ESTADOS_VENDIDOS]
    if (reserva is not None and reserva.estado in ESTADOS_RESERVA_ANULADA) or not vigentes:
        raise HTTPException(
            409,
            "La reserva está cancelada: el boleto ya no es válido y no se puede descargar.",
            headers=NO_STORE,
        )

    return Response(
        content=generar_pdf_boletos(_datos_pdf(codigo, reserva, vigentes)),
        media_type="application/pdf",
        headers={**NO_STORE, "Content-Disposition": f'attachment; filename="boleto-{codigo}.pdf"'},
    )
