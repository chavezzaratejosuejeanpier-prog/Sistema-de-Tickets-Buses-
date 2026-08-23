from sqlalchemy.orm import Session
from ..models.ticket import Ticket, EstadoTicket

def verificar_disponibilidad(db: Session, route_id: int, asiento: int) -> bool:
    ocupado = db.query(Ticket).filter(
        Ticket.route_id == route_id,
        Ticket.numero_asiento == asiento,
        Ticket.estado == EstadoTicket.VENDIDO
    ).first()
    return ocupado is None
