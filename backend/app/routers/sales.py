from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
import uuid
from datetime import datetime, time, timedelta, timezone
from ..database import get_db
from ..models.ticket import Ticket, EstadoTicket
from ..models.route import Route
from ..schemas.ticket_schema import CheckoutRequest, CheckoutResponse, VentaResumen
from ..services.ticket_service import verificar_disponibilidad, calcularPrecioTotal
from ..services.boleto_pdf import generar_pdf_boletos
from ..core.deps import require_admin
from ..models.user import User

router = APIRouter()


def _cargar_reserva(db: Session, codigo: str):
    """Tickets de una reserva (con ruta y bus cargados) por codigo de reserva."""
    return (
        db.query(Ticket)
        .options(joinedload(Ticket.route).joinedload(Route.bus))
        .filter(Ticket.codigo_reserva == codigo.strip().upper())
        .all()
    )


@router.get("/", response_model=VentaResumen)
def resumen_ventas(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    vendido = Ticket.estado == EstadoTicket.VENDIDO
    # "Hoy" en hora de Peru (UTC-5). creado_en se guarda en UTC naive.
    hoy_peru = (datetime.now(timezone.utc) - timedelta(hours=5)).date()
    inicio_hoy = datetime.combine(hoy_peru, time.min) + timedelta(hours=5)
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
def checkout(data: CheckoutRequest, db: Session = Depends(get_db)):
    ruta = db.query(Route).filter(Route.id == data.route_id).first()
    if not ruta:
        raise HTTPException(404, "Ruta no encontrada")

    if not data.pasajeros:
        raise HTTPException(400, "Debe elegir al menos un asiento")

    vistos = set()
    for pasajero in data.pasajeros:
        if pasajero.numero_asiento in vistos:
            raise HTTPException(400, f"Asiento {pasajero.numero_asiento} duplicado en la solicitud")
        vistos.add(pasajero.numero_asiento)
        if not verificar_disponibilidad(db, data.route_id, pasajero.numero_asiento):
            raise HTTPException(409, f"Asiento {pasajero.numero_asiento} ya vendido")

    capacidad = (ruta.bus.capacidad_piso1 or 0) + (ruta.bus.capacidad_piso2 or 0)
    for pasajero in data.pasajeros:
        if not 1 <= pasajero.numero_asiento <= capacidad:
            raise HTTPException(400, f"Asiento {pasajero.numero_asiento} fuera del bus")

    codigo = f"BC-{uuid.uuid4().hex[:8].upper()}"
    for pasajero in data.pasajeros:
        db.add(Ticket(
            route_id=data.route_id,
            numero_asiento=pasajero.numero_asiento,
            piso=1 if pasajero.numero_asiento <= (ruta.bus.capacidad_piso1 or 0) else 2,
            pasajero_nombre=pasajero.nombre.strip(),
            pasajero_dni=pasajero.dni.strip(),
            precio_pagado=ruta.precio_base,
            estado=EstadoTicket.VENDIDO,
            codigo_reserva=codigo
        ))
    try:
        db.commit()
    except IntegrityError:
        # Alguien compro el mismo asiento entre la validacion y el commit
        db.rollback()
        raise HTTPException(409, "Uno de los asientos ya fue vendido por otra persona")

    return {
        "mensaje": "Compra exitosa",
        "codigo_reserva": codigo,
        "email": data.email,
        "asientos": [p.numero_asiento for p in data.pasajeros],
        "total": calcularPrecioTotal(ruta.precio_base, len(data.pasajeros))
    }

@router.get("/tickets/{codigo}")
def obtener_ticket(codigo: str, db: Session = Depends(get_db)):
    tickets = _cargar_reserva(db, codigo)
    if not tickets:
        raise HTTPException(404, "Reserva no encontrada")
    respuesta = []
    for t in tickets:
        ruta = t.route
        respuesta.append({
            "id": t.id,
            "route_id": t.route_id,
            "numero_asiento": t.numero_asiento,
            "piso": t.piso,
            "estado": t.estado.value,
            "codigo_reserva": t.codigo_reserva,
            "pasajero_nombre": t.pasajero_nombre,
            "precio_pagado": t.precio_pagado,
            "origen": ruta.origen if ruta else None,
            "destino": ruta.destino if ruta else None,
            "fecha_salida": ruta.fecha_salida if ruta else None,
            "hora_salida": ruta.hora_salida if ruta else None,
            "bus_placa": ruta.bus.placa if ruta and ruta.bus else None,
        })
    return respuesta


@router.get("/tickets/{codigo}/pdf")
def pdf_ticket(codigo: str, db: Session = Depends(get_db)):
    codigo = codigo.strip().upper()
    tickets = _cargar_reserva(db, codigo)
    if not tickets:
        raise HTTPException(404, "Reserva no encontrada")

    datos = {
        "codigo": codigo,
        "email": None,  # el email del comprador no se guarda (se descarta en checkout)
        "total": sum(float(t.precio_pagado or 0) for t in tickets),
        "tickets": [
            {
                "id": t.id,
                "numero_boleto": f"LUX-{t.id:06d}",
                "codigo_reserva": t.codigo_reserva,
                "numero_asiento": t.numero_asiento,
                "piso": t.piso,
                "pasajero_nombre": t.pasajero_nombre,
                "pasajero_dni": t.pasajero_dni,
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

    return Response(
        content=generar_pdf_boletos(datos),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="boleto-{codigo}.pdf"'},
    )
