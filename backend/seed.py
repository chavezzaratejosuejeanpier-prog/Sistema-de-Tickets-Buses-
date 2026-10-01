"""Carga datos de ejemplo para desarrollo.

Uso:  python seed.py

- Crea las tablas si no existen.
- Elimina la restriccion UNIQUE legacy de tickets.codigo_reserva (compartido por compra).
- Inserta buses, rutas y el usuario admin solo si la tabla esta vacia.
"""
from datetime import datetime, timedelta
import sqlite3
from pathlib import Path

from app.database import Base, engine, SessionLocal
from app.models.bus import Bus, BusTipo
from app.models.route import Route
from app.models.user import User, RolUsuario
from app.core.security import hashear_password

DB_PATH = Path(__file__).parent / "buss_conectpro.db"

BUSES = [
    {"placa": "ABC-123", "modelo": "Volvo 9800", "tipo": BusTipo.PREMIUM, "capacidad_piso1": 20, "capacidad_piso2": 40, "total_asientos": 60},
    {"placa": "DEF-456", "modelo": "Mercedes-Benz O500", "tipo": BusTipo.EJECUTIVO, "capacidad_piso1": 18, "capacidad_piso2": 42, "total_asientos": 60},
    {"placa": "GHI-789", "modelo": "Scania K124", "tipo": BusTipo.ECONOMICO, "capacidad_piso1": 22, "capacidad_piso2": 38, "total_asientos": 60},
]

RUTAS = [
    ("Lima", "Cusco", 7, 120.0, 180.0),
    ("Lima", "Arequipa", 6, 90.0, 140.0),
    ("Cusco", "Puno", 4, 60.0, None),
    ("Lima", "Trujillo", 8, 110.0, None),
    ("Arequipa", "Moquegua", 3, 45.0, None),
]


def _reconstruir_tickets(con, conservar_datos=True):
    """Reconstruye la tabla tickets con el esquema actual del modelo.

    SQLite no tiene DROP CONSTRAINT ni ALTER COLUMN, y create_all no modifica
    tablas existentes, asi que la unica forma es crear la tabla de nuevo,
    copiar los datos y tirar la tabla vieja.
    """
    existe = con.execute(
        "select name from sqlite_master where type='table' and name='tickets'"
    ).fetchone()
    filas = columnas = []
    if existe:
        filas = con.execute("select * from tickets").fetchall()
        columnas = [c[1] for c in con.execute("pragma table_info(tickets)").fetchall()]

    con.execute("alter table tickets rename to tickets_legacy")
    for (nombre,) in con.execute(
        "select name from sqlite_master where type='index' and tbl_name='tickets_legacy'"
    ).fetchall():
        con.execute(f'drop index if exists "{nombre}"')

    Base.metadata.create_all(bind=engine)

    if filas and columnas:
        nuevas = [c.name for c in Base.metadata.tables["tickets"].columns]
        comunes = [c for c in columnas if c in nuevas]
        marcadores = ", ".join("?" * len(comunes))
        con.executemany(
            f"insert into tickets ({', '.join(comunes)}) values ({marcadores})",
            [tuple(f[columnas.index(c)] for c in comunes) for f in filas]
        )
    con.execute("drop table tickets_legacy")
    con.commit()


def _esquema_tickets_desactualizado(con):
    """True si la tabla no coincide con el modelo (UNIQUE legacy o sin indices)."""
    sql = con.execute("select sql from sqlite_master where name='tickets'").fetchone()
    if not sql:
        return False
    if "UNIQUE" in sql[0].upper():
        return True
    for indice in Base.metadata.tables["tickets"].indexes:
        if not con.execute(
            "select name from sqlite_master where type='index' and name=?", (indice.name,)
        ).fetchone():
            return True
    return False


def corregir_constraint_legacy():
    """Elimina la restriccion UNIQUE legacy de tickets.codigo_reserva.

    Necesario porque una compra crea N tickets que comparten el mismo
    codigo_reserva; con UNIQUE la segunda compra de 2+ asientos revienta.
    """
    if not DB_PATH.exists():
        return False
    con = sqlite3.connect(DB_PATH)
    try:
        con.execute("drop table if exists tickets_legacy")
        if not _esquema_tickets_desactualizado(con):
            return False
        _reconstruir_tickets(con)
        return True
    finally:
        con.close()


def main():
    Base.metadata.create_all(bind=engine)

    if corregir_constraint_legacy():
        print("Migracion: se elimino UNIQUE de tickets.codigo_reserva")

    db = SessionLocal()
    try:
        if db.query(Bus).count() == 0:
            for datos in BUSES:
                db.add(Bus(**datos))
            db.flush()  # la sesion tiene autoflush=False: hay que forzar el INSERT
            print(f" buses: {len(BUSES)}")

        buses = db.query(Bus).order_by(Bus.id).all()

        if db.query(Route).count() == 0:
            base = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
            for i, (origen, destino, duracion, precio, vip) in enumerate(RUTAS):
                db.add(Route(
                    origen=origen, destino=destino,
                    fecha_salida=base + timedelta(days=i + 1),
                    hora_salida=f"{8 + i:02d}:00",
                    duracion_horas=float(duracion),
                    precio_base=precio, precio_vip=vip,
                    bus_id=buses[i % len(buses)].id
                ))
            print(f" rutas: {len(RUTAS)}")

        if db.query(User).count() == 0:
            db.add(User(
                email="admin@buss.com", nombre="Administrador",
                hashed_password=hashear_password("123456"), rol=RolUsuario.ADMIN
            ))
            print(" usuario admin: admin@buss.com / 123456")

        db.commit()
    finally:
        db.close()

    print("Listo. Datos de ejemplo cargados.")


if __name__ == "__main__":
    main()