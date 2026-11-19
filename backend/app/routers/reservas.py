from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import exists, update
from sqlalchemy.orm import Session

from ..core.deps import require_admin, require_staff
from ..database import get_db
from ..models.reserva import Reserva
from ..models.ticket import Ticket, EstadoTicket
from ..models.user import User
from ..schemas.ticket_schema import MAX_ID_DB
from .sales import MAX_LARGO_CODIGO, NO_STORE

router = APIRouter()


class CheckinRequest(BaseModel):
    ticket_id: int = Field(ge=1, le=MAX_ID_DB)
    codigo_reserva: str = Field(min_length=1, max_length=MAX_LARGO_CODIGO)


def _conflicto(db: Session, mensaje: str) -> HTTPException:
    db.rollback()
    return HTTPException(409, mensaje)


@router.get("/")
def listar_reservas(response: Response, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    # Incluye email y RUC: no debe quedar en cachés.
    response.headers.update(NO_STORE)
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
            "user_id": r.user_id,
            "pago_simulado": r.pago_simulado,
        }
        for r in reservas
    ]


@router.post("/{codigo}/cancelar")
def cancelar_reserva(codigo: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    codigo = codigo.strip().upper()
    if not codigo or len(codigo) > MAX_LARGO_CODIGO:
        raise HTTPException(404, "No existe la reserva indicada")
    # Bloquea la fila de la reserva (FOR UPDATE en PostgreSQL; SQLite
    # serializa las escrituras) y aplica la transición de forma condicional.
    reserva = db.query(Reserva).filter(Reserva.codigo == codigo).with_for_update().first()
    if not reserva:
        raise HTTPException(404, f"No existe la reserva {codigo}")
    if reserva.estado == "CANCELADA":
        raise HTTPException(400, f"La reserva {codigo} ya estaba cancelada")
    if reserva.estado != "PAGADA":
        raise HTTPException(400, f"La reserva {codigo} no se puede cancelar (estado: {reserva.estado})")

    tickets = db.query(Ticket).filter(Ticket.codigo_reserva == codigo).with_for_update().all()
    if any(t.estado == EstadoTicket.USADO for t in tickets):
        raise HTTPException(400, f"La reserva {codigo} ya tiene un viaje en curso (check-in realizado)")
    if not tickets or any(t.estado != EstadoTicket.VENDIDO for t in tickets):
        raise _conflicto(db, f"La reserva {codigo} tiene boletos en un estado inconsistente; revísala antes de cancelar")

    cambio_reserva = db.execute(
        update(Reserva)
        .where(Reserva.id == reserva.id, Reserva.estado == "PAGADA")
        .values(estado="CANCELADA")
        .execution_options(synchronize_session=False)
    )
    if cambio_reserva.rowcount != 1:
        raise _conflicto(db, f"La reserva {codigo} cambió de estado durante la operación; vuelve a intentarlo")
    cambio_tickets = db.execute(
        update(Ticket)
        .where(Ticket.codigo_reserva == codigo, Ticket.estado == EstadoTicket.VENDIDO)
        .values(estado=EstadoTicket.CANCELADO)
        .execution_options(synchronize_session=False)
    )
    if cambio_tickets.rowcount != len(tickets):
        raise _conflicto(db, f"La reserva {codigo} cambió de estado durante la operación; vuelve a intentarlo")
    db.commit()

    return {
        "mensaje": f"Reserva {codigo} cancelada",
        "codigo": codigo,
        "estado": "CANCELADA",
        "tickets_cancelados": len(tickets),
        "asientos_libres": [t.numero_asiento for t in tickets],
    }


@router.post("/checkin")
def checkin(
    data: CheckinRequest,
    response: Response,
    db: Session = Depends(get_db),
    _staff: User = Depends(require_staff),
):
    # La respuesta incluye el nombre del pasajero: no debe quedar en cachés.
    response.headers.update(NO_STORE)
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
    if ticket.estado != EstadoTicket.VENDIDO:
        raise HTTPException(400, f"El ticket {ticket.id} no esta vendido (estado: {ticket.estado.value})")

    reserva = db.query(Reserva).filter(Reserva.codigo == codigo).with_for_update().first()
    # Tickets históricos sin fila de reserva conservan el check-in; si la
    # reserva existe, debe estar vigente.
    if reserva is not None and reserva.estado != "PAGADA":
        raise _conflicto(db, f"La reserva {codigo} no está vigente (estado: {reserva.estado}); no se puede hacer check-in")

    condiciones = [Ticket.id == ticket.id, Ticket.estado == EstadoTicket.VENDIDO]
    if reserva is not None:
        condiciones.append(exists().where(Reserva.id == reserva.id, Reserva.estado == "PAGADA"))
    cambio = db.execute(
        update(Ticket)
        .where(*condiciones)
        .values(estado=EstadoTicket.USADO)
        .execution_options(synchronize_session=False)
    )
    if cambio.rowcount != 1:
        raise _conflicto(db, f"El ticket {ticket.id} cambió de estado durante la operación; vuelve a intentarlo")

    if reserva is not None:
        pendientes = (
            db.query(Ticket)
            .filter(Ticket.codigo_reserva == codigo, Ticket.estado != EstadoTicket.USADO)
            .count()
        )
        if pendientes == 0:
            db.execute(
                update(Reserva)
                .where(Reserva.id == reserva.id, Reserva.estado == "PAGADA")
                .values(estado="USADA")
                .execution_options(synchronize_session=False)
            )
    # Un único commit: ticket y reserva cambian juntos o no cambian.
    db.commit()

    return {
        "mensaje": "Check-in realizado",
        "ticket_id": ticket.id,
        "codigo_reserva": codigo,
        "estado": EstadoTicket.USADO.value,
        "pasajero": ticket.nombre_completo,
        "asiento": ticket.numero_asiento,
        "piso": ticket.piso,
    }
