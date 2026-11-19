"""Motor y sesiones de SQLAlchemy para SQLite (desarrollo) y PostgreSQL.

Este módulo no ejecuta DDL: el esquema se crea y actualiza solo con el
comando explícito `python migrar.py` (ver `app/esquema.py`).
"""
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import declarative_base, sessionmaker

from .core.config import settings

ES_SQLITE = settings.DATABASE_URL.startswith("sqlite")
NOMBRE_APLICACION = "buss-connectpro-api"


def _pragmas_sqlite(engine: Engine, wal: bool) -> None:
    @event.listens_for(engine, "connect")
    def _al_conectar(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        try:
            # SQLite no aplica las FOREIGN KEY salvo que se active por conexión.
            cursor.execute("PRAGMA foreign_keys=ON")
            if wal:
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.execute("PRAGMA synchronous=NORMAL")
        finally:
            cursor.close()


def crear_engine(url: str, ajustes=settings, *, transaccional_ddl: bool = False) -> Engine:
    """Crea un motor con la configuración de pool, tiempos y TLS.

    `transaccional_ddl` (solo SQLite, para migraciones): el driver deja de
    abrir y confirmar transacciones por su cuenta y cada transacción empieza
    con BEGIN IMMEDIATE, de modo que el DDL también se revierte ante error.
    """
    url_obj = make_url(url)
    if url_obj.get_backend_name() == "sqlite":
        engine = create_engine(
            url,
            # timeout: espera a que otro escritor libere el bloqueo en lugar
            # de fallar de inmediato con "database is locked".
            connect_args={"check_same_thread": False, "timeout": 15},
            hide_parameters=True,
        )
        _pragmas_sqlite(engine, wal=bool(getattr(ajustes, "SQLITE_WAL", False)))
        if transaccional_ddl:
            @event.listens_for(engine, "connect")
            def _sin_transacciones_implicitas(dbapi_connection, _record):
                dbapi_connection.isolation_level = None

            @event.listens_for(engine, "begin")
            def _begin_immediate(conexion):
                conexion.exec_driver_sql("BEGIN IMMEDIATE")
        return engine

    connect_args = {
        "connect_timeout": ajustes.DB_CONNECT_TIMEOUT,
        "application_name": NOMBRE_APLICACION,
    }
    if ajustes.DB_STATEMENT_TIMEOUT_MS:
        connect_args["options"] = f"-c statement_timeout={int(ajustes.DB_STATEMENT_TIMEOUT_MS)}"
    # sslmode, sslrootcert y channel_binding viajan en la propia URL (libpq).
    return create_engine(
        url,
        connect_args=connect_args,
        pool_size=ajustes.DB_POOL_SIZE,
        max_overflow=ajustes.DB_MAX_OVERFLOW,
        pool_timeout=ajustes.DB_POOL_TIMEOUT,
        pool_recycle=ajustes.DB_POOL_RECYCLE,
        pool_pre_ping=True,
        # Sin parámetros SQL en mensajes de excepción ni en logs.
        hide_parameters=True,
    )


engine = crear_engine(settings.DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
