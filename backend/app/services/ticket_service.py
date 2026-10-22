from sqlalchemy.orm import Session
from ..models.ticket import Ticket, EstadoTicket

IGV = 0.18

# Un asiento queda libre si su ticket esta DISPONIBLE o fue CANCELADO.
# Todo lo demas (RESERVADO, VENDIDO, USADO) sigue ocupando el asiento.
ESTADOS_LIBRES = (EstadoTicket.DISPONIBLE, EstadoTicket.CANCELADO)
# Tickets emitidos y no devueltos: cuentan como venta mientras no se cancelen.
ESTADOS_VENDIDOS = (EstadoTicket.VENDIDO, EstadoTicket.USADO)


def calcularMontos(precio_base: float, cantidad: int = 1):
    """Unico lugar donde vive la cuenta del IGV.

    Devuelve (precio_unitario, subtotal, igv, total). El precio_unitario es lo que
    se cobra por cada asiento (base + IGV) y el total es exactamente la suma de los
    asientos, para que el total de la reserva y el de los tickets nunca difieran.
    """
    unitario = round(precio_base * (1 + IGV), 2)
    subtotal = round(precio_base * cantidad, 2)
    total = round(unitario * cantidad, 2)
    igv = round(total - subtotal, 2)  # == subtotal * IGV, salvo redondeo a 2 decimales
    return unitario, subtotal, igv, total

def verificar_disponibilidad(db: Session, route_id: int, asiento: int) -> bool:
    # El asiento se libera solo si su ticket esta DISPONIBLE o CANCELADO.
    # Un ticket USADO sigue ocupando el asiento: el pasajero ya abordo.
    ocupado = db.query(Ticket).filter(
        Ticket.route_id == route_id,
        Ticket.numero_asiento == asiento,
        Ticket.estado.notin_(ESTADOS_LIBRES),
    ).first()
    return ocupado is None
