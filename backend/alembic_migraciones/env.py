"""Entorno de Alembic del proyecto.

Lo normal es invocarlo con `python migrar.py`, que abre la transacción
(con bloqueo en PostgreSQL y BEGIN IMMEDIATE en SQLite) y la pasa en
`config.attributes["connection"]`. Si se usa la CLI `alembic` desde
backend/, se crea esa misma transacción aquí con la DATABASE_URL de la
configuración. El modo offline (--sql) no se admite: la revisión base
inspecciona la base para adoptar esquemas anteriores.
"""
from alembic import context

import app.models  # noqa: F401  (registra los modelos en Base.metadata)
from app.database import Base

config = context.config
target_metadata = Base.metadata


def _ejecutar(conexion) -> None:
    context.configure(
        connection=conexion,
        target_metadata=target_metadata,
        # Toda la actualización en la transacción de quien llama.
        transaction_per_migration=False,
        render_as_batch=conexion.dialect.name == "sqlite",
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _online() -> None:
    conexion = config.attributes.get("connection")
    if conexion is not None:
        _ejecutar(conexion)
        return
    from app.core.config import settings
    from app.esquema import motor_migracion, preparar_transaccion

    motor = motor_migracion(settings.DATABASE_URL)
    try:
        with motor.begin() as con:
            preparar_transaccion(con)
            _ejecutar(con)
    finally:
        motor.dispose()


if context.is_offline_mode():
    raise SystemExit("Modo offline no admitido: usa `python migrar.py` contra una base de prueba.")
_online()
