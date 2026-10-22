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

# Catalogo de ciudades que operamos: (ciudad, km por carretera desde Lima, region).
# La distancia entre dos ciudades se calcula segun la region: si comparten region
# se van por el mismo corredor (diferencia de km a Lima), si no, se pasa por Lima (suma).
CATALOGO = [
    ("Lima", 0, "costa"), ("Callao", 15, "costa"), ("Arequipa", 780, "sierra"),
    ("Cusco", 1150, "sierra"), ("Trujillo", 560, "costa"), ("Chiclayo", 1010, "costa"),
    ("Piura", 1780, "costa"), ("Huancayo", 350, "sierra"), ("Iquitos", 1000, "selva"),
    ("Puno", 1300, "sierra"), ("Tacna", 980, "costa"), ("Ayacucho", 570, "sierra"),
    ("Cajamarca", 800, "sierra"), ("Huaraz", 380, "sierra"), ("Ica", 340, "costa"),
    ("Chimbote", 610, "costa"), ("Tarapoto", 1300, "selva"), ("Pucallpa", 850, "selva"),
    ("Tumbes", 1030, "costa"), ("Moquegua", 900, "costa"), ("Abancay", 900, "sierra"),
    ("Juliaca", 1000, "sierra"), ("Puerto Maldonado", 1600, "selva"), ("Huánuco", 400, "sierra"),
    ("Cerro de Pasco", 300, "sierra"), ("Huancavelica", 400, "sierra"), ("Chachapoyas", 900, "selva"),
    ("Jaén", 800, "selva"), ("Yurimaguas", 900, "selva"), ("Ilo", 950, "costa"),
    ("Sullana", 1000, "costa"), ("Talara", 1100, "costa"), ("Lambayeque", 1010, "costa"),
    ("Pacasmayo", 850, "costa"), ("Chepén", 870, "costa"), ("Barranca", 180, "costa"),
    ("Huacho", 130, "costa"), ("Cañete", 120, "costa"), ("Nazca", 570, "costa"),
    ("Camaná", 560, "costa"), ("Mollendo", 530, "costa"), ("Oxapampa", 350, "sierra"),
    ("Quillabamba", 570, "sierra"), ("Andahuaylas", 450, "sierra"), ("Pisco", 570, "costa"),
    ("Chincha", 130, "costa"), ("Satipo", 600, "selva"), ("La Merced", 400, "selva"),
    ("Tingo María", 600, "selva"), ("Moyobamba", 900, "selva"), ("Zarumilla", 950, "costa"),
    ("Aguas Verdes", 1050, "costa"), ("Zorritos", 1030, "costa"), ("Máncora", 1020, "costa"),
    ("Paita", 1000, "costa"), ("Sechura", 1000, "costa"), ("Chulucanas", 900, "costa"),
    ("Eten", 1020, "costa"), ("Salaverry", 570, "costa"), ("Virú", 590, "costa"),
    ("Huarmey", 350, "costa"), ("Casma", 330, "costa"), ("Nepeña", 300, "costa"),
    ("Chilca", 45, "costa"), ("Quilca", 70, "costa"), ("Islay", 520, "costa"),
    ("Punta de Bombón", 530, "costa"),
]

# Ciudades con salidas entre si (ademas de Lima, que conecta con todas).
HUBS = ["Arequipa", "Cusco", "Trujillo", "Chiclayo", "Piura", "Huaraz", "Ica", "Puno"]

DIAS_SALIDA = 14  # salidas diarias por par

KM = {ciudad: (km, region) for ciudad, km, region in CATALOGO}


def _pares():
    """Pares (origen, destino) que operamos. Cada par sale en ambos sentidos."""
    pares = set()
    for ciudad, _, _ in CATALOGO:
        if ciudad != "Lima":
            pares.add(("Lima", ciudad))
    hubs = ["Lima"] + HUBS
    for i, a in enumerate(hubs):
        for b in hubs[i + 1:]:
            pares.add((a, b))
    for o, d, *_ in RUTAS:
        pares.add((o, d))
    return sorted(pares)


def _distancia(o, d):
    """Km aproximados entre dos ciudades del catalogo."""
    km_o, reg_o = KM[o]
    km_d, reg_d = KM[d]
    return abs(km_o - km_d) if reg_o == reg_d else km_o + km_d


def _montos(o, d):
    """(duracion_h, precio_base, precio_vip) de un par. Los datos curados ganan."""
    for oo, dd, dur, precio, vip in RUTAS:
        if {oo, dd} == {o, d}:
            return dur, precio, vip
    km = _distancia(o, d)
    dur = round(km / 70 + 0.5, 1)
    precio = float(max(25, round(km * 0.09 / 5) * 5))
    vip = float(round(precio * 1.5 / 5) * 5)
    return dur, precio, vip


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

        base = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
        # Rutas ya sembradas, indexadas por (origen, destino, dia) para no duplicar salidas
        existentes = {
            (r.origen, r.destino, r.fecha_salida.date().isoformat()): r
            for r in db.query(Route).all()
        }
        nuevas = []
        creadas = actualizadas = 0
        n = 0
        for o, d in _pares():
            # Cada par sale en ambos sentidos ( ida y vuelta ).
            for origen, destino in ((o, d), (d, o)):
                duracion, precio, vip = _montos(origen, destino)
                hora = f"{6 + n % 14:02d}:00"
                bus_id = buses[n % len(buses)].id
                n += 1
                for dia in range(DIAS_SALIDA):
                    fecha = base + timedelta(days=dia)
                    clave = (origen, destino, fecha.date().isoformat())
                    ruta = existentes.get(clave)
                    if ruta:
                        ruta.fecha_salida = fecha
                        ruta.hora_salida = hora
                        ruta.duracion_horas = duracion
                        ruta.precio_base = precio
                        ruta.precio_vip = vip
                        ruta.bus_id = bus_id
                        actualizadas += 1
                    else:
                        nuevas.append(Route(
                            origen=origen, destino=destino,
                            fecha_salida=fecha, hora_salida=hora,
                            duracion_horas=duracion,
                            precio_base=precio, precio_vip=vip,
                            bus_id=bus_id
                        ))
                        creadas += 1
        db.bulk_save_objects(nuevas)
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