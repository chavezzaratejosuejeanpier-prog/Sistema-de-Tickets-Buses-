from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from datetime import datetime
from ..database import get_db
from ..models.ticket import Ticket, EstadoTicket
from ..models.route import Route
from ..schemas.ticket_schema import CheckoutRequest
from ..services.ticket_service import verificar_disponibilidad, calcularPrecioTotal

router = APIRouter()

@router.get("/")
def resumen_ventas(db: Session = Depends(get_db)):
    ventas = db.query(Ticket).filter(Ticket.estado == EstadoTicket.VENDIDO).all()
    hoy = datetime.utcnow().date()
    ventas_hoy = [v for v in ventas if v.creado_en.date() == hoy]
    return {
        "total_ventas": len(ventas),
        "ventas_hoy": len(ventas_hoy),
        "recaudacion_total": round(sum(v.precio_pagado or 0 for v in ventas), 2),
        "recaudacion_hoy": round(sum(v.precio_pagado or 0 for v in ventas_hoy), 2),
    }

@router.post("/checkout")
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
    db.commit()
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
    return [{
        "id": t.id,
        "route_id": t.route_id,
        "numero_asiento": t.numero_asiento,
        "piso": t.piso,
        "estado": t.estado.value,
        "pasajero_nombre": t.pasajero_nombre,
        "precio_pagado": t.precio_pagado,
    } for t in tickets]