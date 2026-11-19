"""Hora local de operación (Lima, Perú).

Perú usa UTC-5 todo el año (sin horario de verano), así que se usa un
desfase fijo: no depende de la zona del servidor ni del paquete tzdata.
Las fechas/horas de salida se guardan como hora local de Lima sin zona.
"""
from datetime import date, datetime, timedelta, timezone

ZONA_LIMA = timezone(timedelta(hours=-5), "America/Lima")


def ahora_lima() -> datetime:
    """Fecha y hora actuales de Lima, sin tzinfo (como en la base)."""
    return datetime.now(ZONA_LIMA).replace(tzinfo=None)


def hoy_lima() -> date:
    return ahora_lima().date()


def inicio_dia_lima_en_utc(dia: date) -> datetime:
    """Medianoche de `dia` en Lima expresada en UTC sin tzinfo."""
    return datetime.combine(dia, datetime.min.time()) + timedelta(hours=5)
