import re
import sqlite3
from pathlib import Path

from app.database import Base, engine, SessionLocal
from app.models.bus import Bus, BusTipo
from app.models.user import User, RolUsuario
from app.core.catalogo import BUSES
from app.core.config import settings
from app.core.security import hashear_password
from app.services import programa

DB_PATH = (
    Path(settings.DATABASE_URL.replace("sqlite:///", "", 1)).resolve()
    if settings.DATABASE_URL.startswith("sqlite:///")
    else Path(__file__).parent / "buss_conectpro.db"
)

def _reconstruir_tickets(con, conservar_datos=True):
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
        if nombre.startswith("sqlite_autoindex"):
            continue
        con.execute(f'drop index if exists "{nombre}"')

    Base.metadata.create_all(bind=engine)

    if filas and columnas:
        nuevas = [c.name for c in Base.metadata.tables["tickets"].columns]
        marcadores = ", ".join("?" * len(nuevas))
        con.executemany(
            f"insert into tickets ({', '.join(nuevas)}) values ({marcadores})",
            [tuple(_convertir_fila(f, columnas).get(c) for c in nuevas) for f in filas]
        )
    con.execute("drop table tickets_legacy")
    con.commit()


def _convertir_fila(fila, columnas):
    datos = {c: fila[columnas.index(c)] for c in columnas}
    nombre = (datos.get("pasajero_nombre") or "").strip()
    if nombre and "nombres" not in columnas:
        partes = nombre.split()
        if len(partes) >= 3:
            datos["nombres"] = " ".join(partes[:-2])
            datos["apellido_paterno"], datos["apellido_materno"] = partes[-2], partes[-1]
        elif len(partes) == 2:
            datos["nombres"], datos["apellido_paterno"] = partes
        else:
            datos["nombres"] = nombre
    if datos.get("pasajero_dni") and not datos.get("documento"):
        datos["documento"] = datos["pasajero_dni"]
    return datos


def _esquema_tickets_desactualizado(con):
    sql = con.execute("select sql from sqlite_master where name='tickets'").fetchone()
    if not sql:
        return False
    ddl = sql[0].upper()
    if "UQ_TICKET_RUTA_ASIENTO" not in ddl:
        return True
    if re.search(r"UNIQUE\s*\(\s*CODIGO_RESERVA\s*\)", ddl):
        return True
    for indice in Base.metadata.tables["tickets"].indexes:
        if not con.execute(
            "select name from sqlite_master where type='index' and name=? and tbl_name='tickets'",
            (indice.name,),
        ).fetchone():
            return True
    actuales = {c[1] for c in con.execute("pragma table_info(tickets)").fetchall()}
    if {c.name for c in Base.metadata.tables["tickets"].columns} - actuales:
        return True
    return False


def _agregar_ruc_reservas(con):
    columnas = {c[1] for c in con.execute("pragma table_info(reservas)").fetchall()}
    if columnas and "ruc" not in columnas:
        con.execute("alter table reservas add column ruc varchar")
        con.commit()
        return True
    return False


def corregir_constraint_legacy():
    if not DB_PATH.exists():
        return False
    con = sqlite3.connect(DB_PATH)
    try:
        tablas = {
            nombre for (nombre,) in con.execute(
                "select name from sqlite_master where type='table'"
            ).fetchall()
        }
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

        cambiado = _agregar_ruc_reservas(con)
        if _esquema_tickets_desactualizado(con):
            _reconstruir_tickets(con)
            cambiado = True
        return cambiado
    finally:
        con.close()


def main():
    if corregir_constraint_legacy():
        print("Migracion: esquema de la base actualizado")

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(Bus).count() == 0:
            for datos in BUSES:
                db.add(Bus(**{**datos, "tipo": BusTipo(datos["tipo"])}))
            db.flush()
            print(f" buses: {len(BUSES)}")

        if db.query(User).count() == 0:
            db.add(User(
                email="admin@buss.com", nombre="Administrador",
                hashed_password=hashear_password("123456"), rol=RolUsuario.ADMIN
            ))
            print(" usuario admin: admin@buss.com / 123456")
        db.commit()

        nuevas = programa.sincronizar_ventana(db)
        print(f" salidas: {nuevas} creadas")
    finally:
        db.close()

    print("Listo. Datos de ejemplo cargados.")


if __name__ == "__main__":
    main()