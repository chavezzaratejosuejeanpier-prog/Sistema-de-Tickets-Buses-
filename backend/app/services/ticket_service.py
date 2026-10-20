from sqlalchemy.orm import Session
from ..models.ticket import Ticket, EstadoTicket

IGV = 0.18

def calcularPrecioTotal(precio_base: float, cantidad: int = 1) -> float:
    """Precio final del pedido. IGV y descuento se aplican en ramas separadas."""
    return precio_base * cantidad * (1 + IGV)

def verificar_disponibilidad(db: Session, route_id: int, asiento: int) -> bool:
    # Un asiento no disponible es cualquiera que no este DISPONIBLE
    # (misma regla que el mapa de asientos). Evita que un RESERVADO se venda.
    ocupado = db.query(Ticket).filter(
        Ticket.route_id == route_id,
        Ticket.numero_asiento == asiento,
        Ticket.estado != EstadoTicket.DISPONIBLE
    ).first()
    return ocupado is None
