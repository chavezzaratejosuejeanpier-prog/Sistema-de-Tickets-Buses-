"""Carga datos de ejemplo para desarrollo.

Uso:  python seed.py

- Crea las tablas si no existen.
- Elimina la restriccion UNIQUE legacy de tickets.codigo_reserva (compartido por compra).
- Inserta buses y el usuario admin solo si la tabla esta vacia.
- Crea o actualiza las rutas de demo por (origen, destino) sin duplicarlas.
"""
from datetime import datetime, timedelta
import re
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
    ("Lima", "Trujillo", 9, 50.0, 90.0),
    ("Lima", "Chiclayo", 13, 90.0, 130.0),
    ("Lima", "Piura", 17, 100.0, 150.0),
    ("Lima", "Arequipa", 17, 90.0, 140.0),
    ("Lima", "Cusco", 22, 120.0, 180.0),
    ("Lima", "Huaraz", 8, 80.0, 120.0),
    ("Lima", "Ica", 4, 40.0, 70.0),
    ("Arequipa", "Cusco", 10, 85.0, 130.0),
    ("Cusco", "Puno", 7, 60.0, 90.0),
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
        # Los autoindices pertenecen a una constraint y SQLite no deja borrarlos.
        if nombre.startswith("sqlite_autoindex"):
            continue
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
    ddl = sql[0].upper()
    # Falta la restriccion que impide vender dos veces el mismo asiento
    if "UQ_TICKET_RUTA_ASIENTO" not in ddl:
        return True
    # Esquema legacy: UNIQUE sobre codigo_reserva (rompe compras de 2+ asientos)
    if re.search(r"UNIQUE\s*\(\s*CODIGO_RESERVA\s*\)", ddl):
        return True
    for indice in Base.metadata.tables["tickets"].indexes:
        if not con.execute(
            "select name from sqlite_master where type='index' and name=? and tbl_name='tickets'",
            (indice.name,),
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
        tablas = {
            nombre for (nombre,) in con.execute(
                "select name from sqlite_master where type='table'"
            ).fetchall()
        }
        # Recupera una reconstruccion interrumpida sin perder los tickets.
        if "tickets" not in tablas and "tickets_legacy" in tablas:
            con.execute("alter table tickets_legacy rename to tickets")
            con.commit()
        elif "tickets" in tablas and "tickets_legacy" in tablas:
            if con.execute("select count(*) from tickets").fetchone()[0] == 0:
                con.execute("drop table tickets")
                con.execute("alter table tickets_legacy rename to tickets")
            else:
                con.execute("drop table tickets_legacy")
            con.commit()

        if not _esquema_tickets_desactualizado(con):
            return False
        _reconstruir_tickets(con)
        return True
    finally:
        con.close()


def main():
    # Antes de create_all: si quedo una tabla tickets_legacy de una ejecucion
    # interrumpida, sus indices chocan con los de la tabla tickets nueva.
    if corregir_constraint_legacy():
        print("Migracion: esquema de la tabla tickets actualizado")

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(Bus).count() == 0:
            for datos in BUSES:
                db.add(Bus(**datos))
            db.flush()  # la sesion tiene autoflush=False: hay que forzar el INSERT
            print(f" buses: {len(BUSES)}")

        buses = db.query(Bus).order_by(Bus.id).all()

        base = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        creadas = actualizadas = 0
        for i, (origen, destino, duracion, precio, vip) in enumerate(RUTAS):
            ruta = db.query(Route).filter(
                Route.origen == origen, Route.destino == destino
            ).first()
            if ruta:
                ruta.duracion_horas = float(duracion)
                ruta.precio_base = precio
                ruta.precio_vip = vip
                ruta.fecha_salida = base + timedelta(days=i + 1)
                ruta.hora_salida = f"{8 + i:02d}:00"
                actualizadas += 1
            else:
                db.add(Route(
                    origen=origen, destino=destino,
                    fecha_salida=base + timedelta(days=i + 1),
                    hora_salida=f"{8 + i:02d}:00",
                    duracion_horas=float(duracion),
                    precio_base=precio, precio_vip=vip,
                    bus_id=buses[i % len(buses)].id
                ))
                creadas += 1
        print(f" rutas: {creadas} nuevas, {actualizadas} actualizadas")

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