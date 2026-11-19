"""Versionado del esquema con Alembic: migración explícita y verificación.

- `migrar()` aplica las revisiones pendientes en UNA transacción: en
  PostgreSQL el DDL es transaccional y se serializa con un bloqueo
  consultivo; en SQLite se usa un motor dedicado con BEGIN IMMEDIATE para
  que el DDL también se revierta ante cualquier error.
- `verificar_esquema()` solo lee `alembic_version`. La API la usa al
  arrancar y en /health/ready: nunca ejecuta DDL por su cuenta.

Uso: `python migrar.py` (ver backend/INICIALIZACION_SEGURA.md).
"""
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

from .core.config import BASE_DIR, settings
from .database import crear_engine

DIR_MIGRACIONES = BASE_DIR / "alembic_migraciones"
# Clave arbitraria del bloqueo consultivo que serializa migraciones.
CLAVE_BLOQUEO_MIGRACION = 0x4255_4D49
# Espera máxima por bloqueos de tablas en uso antes de abortar la migración.
LOCK_TIMEOUT_MIGRACION = "15s"
ORDEN_MIGRAR = "python migrar.py"


class EsquemaDesactualizado(RuntimeError):
    """La base no está en la revisión que requiere el código."""


def configuracion(conexion: Connection | None = None) -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(DIR_MIGRACIONES))
    if conexion is not None:
        cfg.attributes["connection"] = conexion
    return cfg


def revision_head() -> str:
    return ScriptDirectory.from_config(configuracion()).get_current_head()


def revision_actual(conexion: Connection) -> str | None:
    return MigrationContext.configure(conexion).get_current_revision()


def motor_migracion(url: str) -> Engine:
    return crear_engine(url, transaccional_ddl=True)


def preparar_transaccion(conexion: Connection) -> None:
    """Primeras sentencias de la transacción de migración."""
    if conexion.dialect.name == "postgresql":
        conexion.execute(text(f"SET LOCAL lock_timeout = '{LOCK_TIMEOUT_MIGRACION}'"))
        # Dos `migrar.py` simultáneos (p. ej. dos builds) no se pisan.
        conexion.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": CLAVE_BLOQUEO_MIGRACION})


def _motor_destino(destino: str | Engine | None) -> tuple[Engine, bool]:
    """Devuelve (motor, propio). Los motores propios se cierran al terminar."""
    if isinstance(destino, Engine):
        if destino.dialect.name == "sqlite":
            # La transacción explícita requiere el motor dedicado.
            return motor_migracion(destino.url.render_as_string(hide_password=False)), True
        return destino, False
    return motor_migracion(destino or settings.DATABASE_URL), True


def migrar(destino: str | Engine | None = None, revision: str = "head") -> tuple[str | None, str | None]:
    """Aplica las migraciones hasta `revision`. Devuelve (antes, después)."""
    motor, propio = _motor_destino(destino)
    try:
        with motor.begin() as con:
            preparar_transaccion(con)
            antes = revision_actual(con)
            command.upgrade(configuracion(con), revision)
            despues = revision_actual(con)
    finally:
        if propio:
            motor.dispose()
    return antes, despues


def estado(motor: Engine) -> dict:
    with motor.connect() as con:
        actual = revision_actual(con)
    head = revision_head()
    return {"actual": actual, "requerida": head, "al_dia": actual == head}


def verificar_esquema(motor: Engine) -> str:
    """Lanza EsquemaDesactualizado si la base no está en la revisión head."""
    info = estado(motor)
    if not info["al_dia"]:
        raise EsquemaDesactualizado(
            f"La base de datos está en la revisión {info['actual'] or '(sin versionar)'} y el "
            f"código requiere {info['requerida']}. La API no modifica el esquema al arrancar: "
            f"ejecuta `{ORDEN_MIGRAR}` desde backend/ con la misma DATABASE_URL."
        )
    return info["actual"]


__all__ = [
    "DIR_MIGRACIONES",
    "EsquemaDesactualizado",
    "configuracion",
    "estado",
    "migrar",
    "motor_migracion",
    "preparar_transaccion",
    "revision_actual",
    "revision_head",
    "verificar_esquema",
]


if not Path(DIR_MIGRACIONES).is_dir():  # pragma: no cover - instalación incompleta
    raise RuntimeError(f"Falta el directorio de migraciones {DIR_MIGRACIONES}")
