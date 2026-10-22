from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.deps import require_admin, require_staff
from ..database import get_db
from ..models.reserva import Reserva
from ..models.ticket import Ticket, EstadoTicket
from ..models.user import User
from ..services.ticket_service import ESTADOS_VENDIDOS

router = APIRouter()


class CheckinRequest(BaseModel):
    ticket_id: int
    codigo_reserva: str


@router.get("/")
def listar_reservas(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    reservas = db.query(Reserva).order_by(Reserva.id.desc()).all()
    return [
        {
            "id": r.id,
            "codigo": r.codigo,
            "email": r.email,
            "ruc": r.ruc,
            "cantidad_asientos": r.cantidad_asientos,
            "total_pagado": r.total_pagado,
            "estado": r.estado,
            "fecha_emision": r.fecha_emision,
        }
        for r in reservas
    ]


@router.post("/{codigo}/cancelar")
def cancelar_reserva(codigo: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    codigo = codigo.strip().upper()
    reserva = db.query(Reserva).filter(Reserva.codigo == codigo).first()
    if not reserva:
        raise HTTPException(404, f"No existe la reserva {codigo}")
    if reserva.estado == "CANCELADA":
        raise HTTPException(400, f"La reserva {codigo} ya estaba cancelada")

    tickets = db.query(Ticket).filter(Ticket.codigo_reserva == codigo).all()
    if any(t.estado == EstadoTicket.USADO for t in tickets):
        raise HTTPException(400, f"La reserva {codigo} ya tiene un viaje en curso (check-in realizado)")

    reserva.estado = "CANCELADA"
    for t in tickets:
        t.estado = EstadoTicket.CANCELADO
    db.commit()

    return {
        "mensaje": f"Reserva {codigo} cancelada",
        "codigo": codigo,
        "estado": reserva.estado,
        "tickets_cancelados": len(tickets),
        "asientos_libres": [t.numero_asiento for t in tickets],
    }


@router.post("/checkin")
def checkin(data: CheckinRequest, db: Session = Depends(get_db), _staff: User = Depends(require_staff)):
    codigo = data.codigo_reserva.strip().upper()
    ticket = db.query(Ticket).filter(Ticket.id == data.ticket_id).first()
    if not ticket:
        raise HTTPException(404, f"No existe el ticket {data.ticket_id}")
    if (ticket.codigo_reserva or "").strip().upper() != codigo:
        raise HTTPException(400, f"El ticket {ticket.id} no pertenece a la reserva {codigo}")
    if ticket.estado == EstadoTicket.USADO:
        raise HTTPException(400, f"El ticket {ticket.id} ya fue usado (check-in previo)")
    if ticket.estado == EstadoTicket.CANCELADO:
        raise HTTPException(400, f"El ticket {ticket.id} esta cancelado")
    if ticket.estado not in ESTADOS_VENDIDOS:
        raise HTTPException(400, f"El ticket {ticket.id} no esta vendido (estado: {ticket.estado.value})")

    ticket.estado = EstadoTicket.USADO
    db.commit()

    pendientes = (
        db.query(Ticket)
        .filter(Ticket.codigo_reserva == codigo, Ticket.estado != EstadoTicket.USADO)
        .count()
    )
    reserva = db.query(Reserva).filter(Reserva.codigo == codigo).first()
    if reserva and reserva.estado == "PAGADA" and pendientes == 0:
        reserva.estado = "USADA"
        db.commit()

    return {
        "mensaje": "Check-in realizado",
        "ticket_id": ticket.id,
        "codigo_reserva": codigo,
        "estado": ticket.estado.value,
        "pasajero": ticket.nombre_completo,
        "asiento": ticket.numero_asiento,
        "piso": ticket.piso,
    }
