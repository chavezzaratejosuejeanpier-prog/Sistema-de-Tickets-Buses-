from sqlalchemy.orm import Session
from ..models.ticket import Ticket, EstadoTicket

IGV = 0.18

# Definición única del inventario: un asiento está libre si no tiene ticket
# o si su ticket está DISPONIBLE o CANCELADO. El índice único parcial
# `uq_ticket_ruta_asiento` (models/ticket.py) usa el mismo criterio.
ESTADOS_LIBRES = (EstadoTicket.DISPONIBLE, EstadoTicket.CANCELADO)
ESTADOS_VENDIDOS = (EstadoTicket.VENDIDO, EstadoTicket.USADO)


def calcularMontos(precio_base: float, cantidad: int = 1):
    unitario = round(precio_base * (1 + IGV), 2)
    subtotal = round(precio_base * cantidad, 2)
    total = round(unitario * cantidad, 2)
    igv = round(total - subtotal, 2)
    return unitario, subtotal, igv, total


def asientos_ocupados(db: Session, route_id: int) -> list[int]:
    """Asientos ocupados de un viaje, ordenados y sin repetir."""
    filas = (
        db.query(Ticket.numero_asiento)
        .filter(Ticket.route_id == route_id, Ticket.estado.notin_(ESTADOS_LIBRES))
        .distinct()
        .order_by(Ticket.numero_asiento)
        .all()
    )
    return [numero for (numero,) in filas]


def verificar_disponibilidad(db: Session, route_id: int, asiento: int) -> bool:
    ocupado = db.query(Ticket.id).filter(
        Ticket.route_id == route_id,
        Ticket.numero_asiento == asiento,
        Ticket.estado.notin_(ESTADOS_LIBRES),
    ).first()
    return ocupado is None
