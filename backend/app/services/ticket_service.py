from sqlalchemy.orm import Session
from ..models.ticket import Ticket, EstadoTicket

IGV = 0.18

def calcularPrecioTotal(precio_base: float, cantidad: int = 1) -> float:
    """Precio final del pedido. IGV y descuento se aplican en ramas separadas."""
    return precio_base * cantidad

def verificar_disponibilidad(db: Session, route_id: int, asiento: int) -> bool:
    ocupado = db.query(Ticket).filter(
        Ticket.route_id == route_id,
        Ticket.numero_asiento == asiento,
        Ticket.estado == EstadoTicket.VENDIDO
    ).first()
    return ocupado is None
