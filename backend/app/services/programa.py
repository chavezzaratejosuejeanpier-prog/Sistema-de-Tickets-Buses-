"""Programa de salidas.

Reglas:
- Solo se insertan salidas que faltan; nunca se modifican horarios ni
  precios de salidas existentes (pueden tener boletos vendidos o haber sido
  ajustadas por un administrador).
- El calendario es el de Lima (`core.tiempo`), no el del servidor.
- La generación se serializa (bloqueo de escritura en SQLite, bloqueo
  consultivo en PostgreSQL) para que dos procesos no dupliquen salidas.
"""
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from ..core import catalogo
from ..core.tiempo import ahora_lima, hoy_lima
from ..models.bus import Bus
from ..models.route import Route

HORA_SALIDA_BASE = time(8, 0)
# Clave arbitraria del bloqueo consultivo de PostgreSQL para la generación.
_CLAVE_BLOQUEO_PG = 0x4255_5353


def hora_de_salida(indice_bus: int) -> str:
    return f"{(6 + 6 * indice_bus) % 24:02d}:00"


def _dia_iso(valor) -> str:
    if isinstance(valor, (date, datetime)):
        return valor.strftime("%Y-%m-%d")
    return str(valor)[:10]


def salida_real(ruta: Route) -> datetime | None:
    """Fecha y hora reales de salida (hora local de Lima).

    `fecha_salida` aporta el día y `hora_salida` (HH:MM) la hora. Si la hora
    guardada no es válida se usa la hora de `fecha_salida`.
    """
    if ruta.fecha_salida is None:
        return None
    try:
        horas, minutos = (int(p) for p in str(ruta.hora_salida or "").strip().split(":"))
        return datetime.combine(ruta.fecha_salida.date(), time(horas, minutos))
    except (TypeError, ValueError):
        return ruta.fecha_salida


def ya_salio(ruta: Route, ahora: datetime | None = None) -> bool:
    salida = salida_real(ruta)
    return salida is None or salida <= (ahora or ahora_lima())


def _buses(db: Session):
    return db.query(Bus).order_by(Bus.id).all()


def _serializar_generacion(db: Session) -> None:
    """Toma el bloqueo de escritura antes de leer qué salidas faltan."""
    dialecto = db.get_bind().dialect.name
    if dialecto == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _CLAVE_BLOQUEO_PG})
    elif dialecto == "sqlite":
        # Primera sentencia de escritura de la transacción: SQLite toma el
        # bloqueo RESERVED y los demás escritores esperan al commit.
        db.execute(text("UPDATE routes SET id = id WHERE 1 = 0"))


def _rango_dia(fecha: date):
    return (
        Route.fecha_salida >= datetime.combine(fecha, time.min),
        Route.fecha_salida < datetime.combine(fecha + timedelta(days=1), time.min),
    )


def salidas_del_dia(db: Session, origen: str, destino: str, fecha: date) -> list[Route]:
    """Solo lectura: salidas existentes del par y día que aún no partieron."""
    ahora = ahora_lima()
    rutas = (
        db.query(Route)
        .filter(Route.origen == origen, Route.destino == destino, *_rango_dia(fecha))
        .all()
    )
    vigentes = [r for r in rutas if not ya_salio(r, ahora)]
    return sorted(vigentes, key=lambda r: (salida_real(r), r.id))


def generar_salidas_faltantes(db: Session, origen: str, destino: str, fecha: date) -> int:
    """Crea las salidas que faltan del par y día; no modifica las existentes.

    Devuelve cuántas se crearon. Hace commit.
    """
    try:
        _serializar_generacion(db)
        buses = _buses(db)
        if not buses:
            db.rollback()
            return 0
        con_salida = {
            bus_id
            for (bus_id,) in db.query(Route.bus_id).filter(
                Route.origen == origen, Route.destino == destino, *_rango_dia(fecha)
            ).all()
        }
        duracion, precio, vip = catalogo.montos(origen, destino)
        nuevas = [
            {
                "origen": origen,
                "destino": destino,
                "fecha_salida": datetime.combine(fecha, HORA_SALIDA_BASE),
                "hora_salida": hora_de_salida(indice),
                "duracion_horas": duracion,
                "precio_base": precio,
                "precio_vip": vip,
                "bus_id": bus.id,
            }
            for indice, bus in enumerate(buses)
            if bus.id not in con_salida
        ]
        if nuevas:
            db.execute(Route.__table__.insert(), nuevas)
        db.commit()
        return len(nuevas)
    except Exception:
        db.rollback()
        raise


def sincronizar_ventana(db: Session, hoy: date = None) -> int:
    """Inserta las salidas faltantes de los pares base en la ventana.

    Nunca actualiza salidas existentes. Devuelve cuántas se crearon.
    """
    hoy = hoy or hoy_lima()
    try:
        _serializar_generacion(db)
        buses = _buses(db)
        if not buses:
            db.rollback()
            return 0

        fechas = [hoy + timedelta(days=dia) for dia in range(catalogo.DIAS_SALIDA)]
        # Se deduplican los pares dirigidos: pares_base puede traer ambas
        # orientaciones de un mismo par (p. ej. Arequipa/Cusco y Cusco/Arequipa).
        pares = list(dict.fromkeys(
            par
            for base in catalogo.pares_base()
            for par in (base, (base[1], base[0]))
        ))

        inicio = datetime.combine(hoy, time(0, 0))
        # func.date() devuelve texto en SQLite y un objeto date en PostgreSQL:
        # se normaliza a 'YYYY-MM-DD' para que la comparación funcione en ambos.
        existentes = {
            (origen, destino, _dia_iso(dia), bus_id)
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
        db.commit()
        return len(nuevas)
    except Exception:
        db.rollback()
        raise
