from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
import uuid
from datetime import datetime, time
from ..database import get_db
from ..models.ticket import Ticket, EstadoTicket
from ..models.route import Route
from ..schemas.ticket_schema import CheckoutRequest, CheckoutResponse, VentaResumen
from ..services.ticket_service import verificar_disponibilidad, calcularPrecioTotal
from ..core.deps import require_admin
from ..models.user import User

router = APIRouter()

@router.get("/", response_model=VentaResumen)
def resumen_ventas(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    vendido = Ticket.estado == EstadoTicket.VENDIDO
    inicio_hoy = datetime.combine(datetime.utcnow().date(), time.min)
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
    tickets = db.query(Ticket).filter(Ticket.codigo_reserva == codigo).all()
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
            "pasajero_nombre": t.pasajero_nombre,
            "precio_pagado": t.precio_pagado,
            "origen": ruta.origen if ruta else None,
            "destino": ruta.destino if ruta else None,
            "fecha_salida": ruta.fecha_salida if ruta else None,
            "hora_salida": ruta.hora_salida if ruta else None,
            "bus_placa": ruta.bus.placa if ruta and ruta.bus else None,
        })
    return respuesta