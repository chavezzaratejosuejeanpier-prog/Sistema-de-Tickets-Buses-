from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from .core.config import settings

ES_SQLITE = settings.DATABASE_URL.startswith("sqlite")

engine = create_engine(
    settings.DATABASE_URL,
    # timeout: espera a que otro escritor libere el bloqueo en lugar de
    # fallar de inmediato con "database is locked".
    connect_args={"check_same_thread": False, "timeout": 15} if ES_SQLITE else {},
    pool_pre_ping=not ES_SQLITE,
)

if ES_SQLITE:
    @event.listens_for(engine, "connect")
    def _activar_fk_sqlite(dbapi_connection, _record):
        # SQLite no aplica las FOREIGN KEY salvo que se active por conexión.
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
