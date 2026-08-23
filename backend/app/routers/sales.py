from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from ..database import get_db
from ..models.ticket import Ticket, EstadoTicket
from ..models.route import Route
from ..schemas.ticket_schema import CheckoutRequest
from ..services.ticket_service import verificar_disponibilidad

router = APIRouter()

@router.post("/checkout")
def checkout(data: CheckoutRequest, db: Session = Depends(get_db)):
    ruta = db.query(Route).filter(Route.id == data.route_id).first()
    if not ruta: raise HTTPException(404, "Ruta no encontrada")
    
    # Verificar cada asiento no esté vendido
    for asiento in data.asientos:
        ocupado = db.query(Ticket).filter(
            Ticket.route_id == data.route_id,
            Ticket.numero_asiento == asiento,
            Ticket.estado == EstadoTicket.VENDIDO
        ).first()
        if ocupado:
            raise HTTPException(409, f"Asiento {asiento} ya vendido")
    
    codigo = f"BC-{uuid.uuid4().hex[:8].upper()}"
    tickets_creados = []
    for asiento in data.asientos:
        t = Ticket(
            route_id=data.route_id, numero_asiento=asiento,
            piso=1 if asiento <= ruta.bus.capacidad_piso1 else 2,
            pasajero_nombre=data.pasajero_nombre, pasajero_dni=data.pasajero_dni,
            precio_pagado=ruta.precio_base, estado=EstadoTicket.VENDIDO,
            codigo_reserva=codigo
        )
        db.add(t)
        tickets_creados.append(t)
    db.commit()
    return {"mensaje": "Compra exitosa", "codigo_reserva": codigo, "asientos": data.asientos, "total": ruta.precio_base * len(data.asientos)}

@router.get("/tickets/{codigo}")
def obtener_ticket(codigo: str, db: Session = Depends(get_db)):
    tickets = db.query(Ticket).filter(Ticket.codigo_reserva == codigo).all()
    if not tickets: raise HTTPException(404, "Reserva no encontrada")
    return tickets
