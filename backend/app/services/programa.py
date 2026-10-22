from datetime import date, datetime, time, timedelta

from sqlalchemy import func, update
from sqlalchemy.orm import Session

from ..core import catalogo
from ..models.bus import Bus
from ..models.route import Route

HORA_SALIDA_BASE = time(8, 0)


def hora_de_salida(indice_bus: int) -> str:
    return f"{(6 + 6 * indice_bus) % 24:02d}:00"


def _buses(db: Session):
    return db.query(Bus).order_by(Bus.id).all()


def asegurar_salidas(db: Session, origen: str, destino: str, fecha: date):
    buses = _buses(db)
    if not buses:
        return []

    duracion, precio, vip = catalogo.montos(origen, destino)
    existentes = {
        r.bus_id: r
        for r in db.query(Route).filter(
            Route.origen == origen,
            Route.destino == destino,
            func.date(Route.fecha_salida) == fecha.isoformat(),
        ).all()
    }

    for indice, bus in enumerate(buses):
        ruta = existentes.get(bus.id)
        if ruta is None:
            ruta = Route(
                origen=origen,
                destino=destino,
                fecha_salida=datetime.combine(fecha, HORA_SALIDA_BASE),
                hora_salida=hora_de_salida(indice),
                duracion_horas=duracion,
                precio_base=precio,
                precio_vip=vip,
                bus_id=bus.id,
            )
            db.add(ruta)
            existentes[bus.id] = ruta
        else:
            ruta.hora_salida = hora_de_salida(indice)
            ruta.duracion_horas = duracion
            ruta.precio_base = precio
            ruta.precio_vip = vip

    db.commit()
    return sorted(existentes.values(), key=lambda r: r.hora_salida)


def sincronizar_ventana(db: Session, hoy: date = None) -> int:
    hoy = hoy or date.today()
    buses = _buses(db)
    if not buses:
        return 0

    fechas = [hoy + timedelta(days=dia) for dia in range(catalogo.DIAS_SALIDA)]
    pares = [
        par
        for base in catalogo.pares_base()
        for par in (base, (base[1], base[0]))
    ]

    inicio = datetime.combine(hoy, time(0, 0))
    existentes = {
        (origen, destino, dia, bus_id)
        for origen, destino, dia, bus_id in db.query(
            Route.origen, Route.destino, func.date(Route.fecha_salida), Route.bus_id
        ).filter(Route.fecha_salida >= inicio).all()
    }

    nuevas = []
    for origen, destino in pares:
        duracion, precio, vip = catalogo.montos(origen, destino)
        for fecha in fechas:
            for indice, bus in enumerate(buses):
                if (origen, destino, fecha.isoformat(), bus.id) in existentes:
                    continue
                nuevas.append({
                    "origen": origen,
                    "destino": destino,
                    "fecha_salida": datetime.combine(fecha, HORA_SALIDA_BASE),
                    "hora_salida": hora_de_salida(indice),
                    "duracion_horas": duracion,
                    "precio_base": precio,
                    "precio_vip": vip,
                    "bus_id": bus.id,
                })

    if nuevas:
        db.execute(Route.__table__.insert(), nuevas)
    for indice, bus in enumerate(buses):
        db.execute(
            update(Route)
            .where(Route.bus_id == bus.id, Route.fecha_salida >= inicio)
            .values(hora_salida=hora_de_salida(indice))
        )
    db.commit()
    return len(nuevas)


_ultimo_sincronizado: date = None


def sincronizar_si_cambio_el_dia(db: Session) -> None:
    global _ultimo_sincronizado
    hoy = date.today()
    if _ultimo_sincronizado == hoy:
        return
    sincronizar_ventana(db, hoy)
    _ultimo_sincronizado = hoy
