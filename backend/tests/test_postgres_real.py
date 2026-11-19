"""Integración con un servidor PostgreSQL REAL y aislado (ver tests/postgres_real.py).

Se omite si no hay servidor de prueba configurado. Con uno disponible
verifica, contra el motor real:

- migración explícita (Alembic) desde vacío, idempotencia y esquema igual
  al de los modelos; índice único parcial con el predicado correcto;
- adopción de un esquema heredado con índice único total y reversión
  completa (DDL incluido) ante asientos duplicados;
- ciclo completo por HTTP con checkout de demostración (pago simulado):
  registro, login, programación, asientos, compra, consulta, PDF,
  cancelación, recompra, check-in, resumen y readiness;
- concurrencia: un asiento vendido una sola vez, generación de salidas sin
  duplicados (bloqueo consultivo), check-in simultáneo y sincronización
  de la ventana idempotente con fechas del dialecto.

Solo datos sintéticos; cada clase usa su propio esquema y lo elimina.
"""
import threading
import unittest
from datetime import datetime, timedelta

from tests.apoyo import app, llamar
from tests.postgres_real import EsquemaAislado, PostgresNoDisponible

from sqlalchemy import func, text
from sqlalchemy.orm import sessionmaker

from app import esquema, migraciones
from app.core import rate_limit, tiempo
from app.core.security import hashear_password
from app.database import Base, get_db
from app.models.bus import Bus, BusTipo
from app.models.reserva import Reserva
from app.models.route import Route
from app.models.ticket import EstadoTicket, Ticket
from app.models.user import RolUsuario, User
from app.services import programa
from tests.test_migracion_alembic import firma_esquema

PASSWORD = "Sintetica-PG-2026!"
TABLAS = "tickets, reservas, routes, buses, users"


def _esquema_o_skip(prefijo="buss_prueba"):
    try:
        return EsquemaAislado(prefijo)
    except PostgresNoDisponible as exc:
        raise unittest.SkipTest(f"PostgreSQL real no disponible: {exc}") from None


def _pasajero(asiento, nombre="Prueba"):
    return {
        "numero_asiento": asiento, "tipo_documento": "DNI", "documento": f"7200000{asiento % 10}",
        "nombres": nombre, "apellido_paterno": "Sintetico", "apellido_materno": "Ficticio",
        "sexo": "Femenino", "fecha_nacimiento": "1990-01-01", "telefono": "900000000",
    }


class _BasePG(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pg = _esquema_o_skip()
        try:
            cls.revision_inicial = esquema.migrar(cls.pg.engine)
        except Exception:
            cls.pg.eliminar()
            raise
        cls.Sesion = sessionmaker(bind=cls.pg.engine, autoflush=False)

        def obtener():
            db = cls.Sesion()
            try:
                yield db
            finally:
                db.close()

        cls._anterior = app.dependency_overrides.get(get_db)
        app.dependency_overrides[get_db] = obtener

    @classmethod
    def tearDownClass(cls):
        if cls._anterior is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = cls._anterior
        cls.pg.eliminar()

    def setUp(self):
        rate_limit.reiniciar()
        with self.pg.engine.begin() as con:
            con.execute(text(f"TRUNCATE {TABLAS} RESTART IDENTITY CASCADE"))
        self._ip = 0

    def ip(self) -> str:
        self._ip += 1
        return f"198.51.100.{self._ip % 250 + 1}"

    def crear_usuario(self, email, rol=RolUsuario.CLIENTE):
        with self.Sesion() as db:
            db.add(User(email=email, nombre="Usuario Sintetico", hashed_password=hashear_password(PASSWORD), rol=rol))
            db.commit()

    def login(self, email):
        r = llamar("POST", "/api/auth/login", {"email": email, "password": PASSWORD}, cliente=self.ip())
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()["access_token"]

    def crear_ruta(self, capacidad=(10, 10), dias=3, hora="10:30"):
        with self.Sesion() as db:
            bus = Bus(placa=f"PG{db.query(Bus).count():02d}-001", modelo="Sintetico", tipo=BusTipo.ECONOMICO,
                      capacidad_piso1=capacidad[0], capacidad_piso2=capacidad[1],
                      total_asientos=sum(capacidad))
            db.add(bus)
            db.flush()
            fecha = tiempo.hoy_lima() + timedelta(days=dias)
            ruta = Route(origen="Lima", destino="Ica", fecha_salida=datetime.combine(fecha, programa.HORA_SALIDA_BASE),
                         hora_salida=hora, duracion_horas=4, precio_base=40.0, precio_vip=70.0, bus_id=bus.id)
            db.add(ruta)
            db.commit()
            return ruta.id

    def comprar(self, token, route_id, asientos, cliente=None):
        cuerpo = {"route_id": route_id, "email": "contacto@example.com",
                  "pasajeros": [_pasajero(a) for a in asientos]}
        return llamar("POST", "/api/sales/checkout", cuerpo, token, cliente=cliente or self.ip())


class EsquemaPostgresTest(_BasePG):
    def test_migracion_desde_vacio_idempotente_y_fiel_a_los_modelos(self):
        self.assertEqual(self.revision_inicial, (None, esquema.revision_head()))
        self.assertEqual(esquema.migrar(self.pg.engine), (esquema.revision_head(),) * 2)
        self.assertEqual(esquema.verificar_esquema(self.pg.engine), esquema.revision_head())

        referencia = _esquema_o_skip("buss_modelos")
        try:
            Base.metadata.create_all(bind=referencia.engine)
            self.assertEqual(firma_esquema(self.pg.engine), firma_esquema(referencia.engine))
        finally:
            referencia.eliminar()

        with self.pg.engine.connect() as con:
            self.assertEqual(migraciones._estado_indice_postgresql(con), "ok")
            predicado = con.execute(text(
                "SELECT pg_get_expr(i.indpred, i.indrelid) FROM pg_index i "
                "JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = 'uq_ticket_ruta_asiento' "
                "AND pg_table_is_visible(i.indrelid)"
            )).scalar()
        self.assertIn("CANCELADO", predicado)
        self.assertIn("DISPONIBLE", predicado)


class LegadoPostgresTest(unittest.TestCase):
    """Esquemas heredados creados a mano en un esquema aislado propio."""

    _DDL = """
        CREATE TABLE buses (id SERIAL PRIMARY KEY, placa VARCHAR NOT NULL UNIQUE, modelo VARCHAR NOT NULL,
            tipo VARCHAR(9), capacidad_piso1 INTEGER, capacidad_piso2 INTEGER, total_asientos INTEGER);
        CREATE TABLE routes (id SERIAL PRIMARY KEY, origen VARCHAR NOT NULL, destino VARCHAR NOT NULL,
            fecha_salida TIMESTAMP NOT NULL, hora_salida VARCHAR NOT NULL, duracion_horas FLOAT,
            precio_base FLOAT NOT NULL, precio_vip FLOAT, bus_id INTEGER NOT NULL REFERENCES buses(id));
        CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR NOT NULL, nombre VARCHAR NOT NULL,
            hashed_password VARCHAR NOT NULL, rol VARCHAR(8), is_active BOOLEAN);
        CREATE TABLE reservas (id SERIAL PRIMARY KEY, codigo VARCHAR NOT NULL, email VARCHAR,
            subtotal FLOAT NOT NULL, igv FLOAT NOT NULL, total_pagado FLOAT NOT NULL,
            cantidad_asientos INTEGER NOT NULL, estado VARCHAR NOT NULL, fecha_emision TIMESTAMP);
        CREATE TABLE tickets (id SERIAL PRIMARY KEY, route_id INTEGER NOT NULL REFERENCES routes(id),
            numero_asiento INTEGER NOT NULL, piso INTEGER, tipo_documento VARCHAR, documento VARCHAR,
            nombres VARCHAR, apellido_paterno VARCHAR, apellido_materno VARCHAR, sexo VARCHAR,
            fecha_nacimiento DATE, telefono VARCHAR, precio_pagado FLOAT, estado VARCHAR(10) NOT NULL,
            codigo_reserva VARCHAR, creado_en TIMESTAMP);
        INSERT INTO buses (placa, modelo, tipo, capacidad_piso1, capacidad_piso2, total_asientos)
            VALUES ('LEG-001', 'Sintetico', 'ECONOMICO', 10, 10, 20);
        INSERT INTO routes (origen, destino, fecha_salida, hora_salida, duracion_horas, precio_base, bus_id)
            VALUES ('Lima', 'Ica', '2030-01-10 08:00', '08:00', 4, 40, 1);
        INSERT INTO reservas (codigo, email, subtotal, igv, total_pagado, cantidad_asientos, estado)
            VALUES ('BC-LEGPG01', 'legado@example.com', 40, 7.2, 47.2, 1, 'PAGADA');
        INSERT INTO tickets (route_id, numero_asiento, piso, nombres, estado, codigo_reserva)
            VALUES (1, 1, 1, 'Prueba', 'VENDIDO', 'BC-LEGPG01');
    """

    def _crear(self, extra=""):
        pg = _esquema_o_skip("buss_legado")
        self.addCleanup(pg.eliminar)
        with pg.engine.begin() as con:
            con.exec_driver_sql(self._DDL + extra)
        return pg

    def test_adopta_indice_total_heredado(self):
        pg = self._crear("CREATE UNIQUE INDEX uq_ticket_ruta_asiento ON tickets (route_id, numero_asiento);")
        antes, despues = esquema.migrar(pg.engine)
        self.assertEqual((antes, despues), (None, esquema.revision_head()))
        with pg.engine.begin() as con:
            self.assertEqual(migraciones._estado_indice_postgresql(con), "ok")
            columnas = {r[0] for r in con.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = 'reservas'"))}
            self.assertTrue({"ruc", "user_id", "metodo_pago"} <= columnas)
            self.assertIsNone(con.execute(text("SELECT user_id FROM reservas")).scalar())
            # El asiento cancelado se puede revender tras la migración.
            con.execute(text("UPDATE tickets SET estado = 'CANCELADO'"))
            con.execute(text("INSERT INTO tickets (route_id, numero_asiento, estado) VALUES (1, 1, 'VENDIDO')"))
        self.assertEqual(esquema.migrar(pg.engine), (despues, despues))

    def test_duplicados_revierten_toda_la_migracion(self):
        pg = self._crear(
            "INSERT INTO tickets (route_id, numero_asiento, piso, nombres, estado, codigo_reserva) "
            "VALUES (1, 1, 1, 'Prueba', 'USADO', 'BC-LEGPG02');"
        )
        with self.assertRaises(migraciones.MigracionFallida) as ctx:
            esquema.migrar(pg.engine)
        self.assertNotIn("BC-LEGPG02", str(ctx.exception))
        with pg.engine.connect() as con:
            tablas = {r[0] for r in con.execute(text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()"))}
            columnas = {r[0] for r in con.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = 'reservas'"))}
            self.assertEqual(con.execute(text("SELECT count(*) FROM tickets")).scalar(), 2)
        self.assertNotIn("alembic_version", tablas)
        self.assertNotIn("ruc", columnas)


class CicloCompletoPostgresTest(_BasePG):
    def test_ciclo_completo_checkout_de_demostracion(self):
        for alias, rol in (("admin", RolUsuario.ADMIN), ("vendedor", RolUsuario.VENDEDOR)):
            self.crear_usuario(f"{alias}@example.com", rol)
        self.assertEqual(llamar("GET", "/health/ready").status_code, 200)

        # Registro y login de clientes (respuesta idéntica para correo repetido).
        for email in ("cliente@example.com", "otro@example.com", "cliente@example.com"):
            r = llamar("POST", "/api/auth/register",
                       {"email": email, "nombre": "Cliente Sintetico", "password": PASSWORD}, cliente=self.ip())
            self.assertEqual(r.status_code, 201, r.content)
        cliente, otro = self.login("cliente@example.com"), self.login("otro@example.com")
        admin, vendedor = self.login("admin@example.com"), self.login("vendedor@example.com")

        # Flota y programación explícita de la demo.
        r = llamar("POST", "/api/buses/", {"placa": "PGX-101", "modelo": "Sintetico", "tipo": "EJECUTIVO",
                                            "capacidad_piso1": 10, "capacidad_piso2": 10}, admin)
        self.assertEqual(r.status_code, 201, r.content)
        fecha = (tiempo.hoy_lima() + timedelta(days=5)).isoformat()
        r = llamar("GET", f"/api/routes/buscar?origen=Lima&destino=Ica&fecha={fecha}")
        self.assertEqual((r.status_code, r.json()), (200, []), "la búsqueda no escribe")
        r = llamar("POST", "/api/routes/generar", {"origen": "Lima", "destino": "Ica", "fecha": fecha}, cliente=self.ip())
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(len(r.json()), 1)
        route_id = r.json()[0]["id"]
        self.assertEqual(llamar("GET", f"/api/routes/{route_id}").status_code, 200)

        # Compra de demostración: pago simulado, sin cobro.
        r = self.comprar(cliente, route_id, (1, 2))
        self.assertEqual(r.status_code, 200, r.content)
        compra = r.json()
        self.assertTrue(compra["pago_simulado"])
        self.assertEqual(sorted(compra["asientos"]), [1, 2])
        codigo = compra["codigo_reserva"]
        with self.Sesion() as db:
            self.assertEqual(db.query(Reserva).filter_by(codigo=codigo).one().metodo_pago, "SIMULADO")
        self.assertEqual(sorted(llamar("GET", f"/api/routes/{route_id}/asientos").json()["ocupados"]), [1, 2])
        self.assertEqual(self.comprar(otro, route_id, (2,)).status_code, 409)

        # Consulta y PDF: titular sí, otro cliente no.
        r = llamar("GET", f"/api/sales/tickets/{codigo}", token=cliente)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()), 2)
        self.assertEqual(llamar("GET", f"/api/sales/tickets/{codigo}", token=otro).status_code, 404)
        r = llamar("GET", f"/api/sales/tickets/{codigo}/pdf", token=cliente)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.content.startswith(b"%PDF"))

        # Check-in de un boleto y cancelación de otra compra.
        ticket_id = llamar("GET", f"/api/sales/tickets/{codigo}", token=cliente).json()[0]["id"]
        r = llamar("POST", "/api/reservas/checkin", {"ticket_id": ticket_id, "codigo_reserva": codigo}, vendedor)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(
            llamar("POST", "/api/reservas/checkin", {"ticket_id": ticket_id, "codigo_reserva": codigo}, vendedor).status_code,
            400,
        )
        self.assertEqual(
            llamar("POST", "/api/reservas/checkin", {"ticket_id": ticket_id, "codigo_reserva": codigo}, cliente).status_code,
            403,
        )

        r = self.comprar(otro, route_id, (5,))
        self.assertEqual(r.status_code, 200, r.content)
        codigo_otro = r.json()["codigo_reserva"]
        self.assertEqual(llamar("POST", f"/api/reservas/{codigo_otro}/cancelar", token=admin).status_code, 200)
        self.assertEqual(llamar("GET", f"/api/sales/tickets/{codigo_otro}/pdf", token=otro).status_code, 409)
        # El asiento liberado se revende.
        self.assertEqual(self.comprar(cliente, route_id, (5,)).status_code, 200)

        resumen = llamar("GET", "/api/sales/", token=admin)
        self.assertEqual(resumen.status_code, 200)
        self.assertEqual(resumen.json()["total_ventas"], 3)
        self.assertEqual(llamar("GET", "/api/sales/", token=cliente).status_code, 403)
        self.assertEqual(llamar("GET", "/api/reservas/", token=admin).status_code, 200)


class ConcurrenciaPostgresTest(_BasePG):
    def _en_paralelo(self, funciones):
        resultados = [None] * len(funciones)
        barrera = threading.Barrier(len(funciones))

        def correr(i, f):
            barrera.wait()
            resultados[i] = f()

        hilos = [threading.Thread(target=correr, args=(i, f)) for i, f in enumerate(funciones)]
        for h in hilos:
            h.start()
        for h in hilos:
            h.join(timeout=60)
        return resultados

    def test_un_asiento_se_vende_una_sola_vez(self):
        route_id = self.crear_ruta()
        tokens = []
        for i in range(8):
            email = f"comprador{i}@example.com"
            self.crear_usuario(email)
            tokens.append(self.login(email))
        ips = [self.ip() for _ in tokens]
        estados = [r.status_code for r in self._en_paralelo(
            [lambda t=t, ip=ip: self.comprar(t, route_id, (7,), cliente=ip) for t, ip in zip(tokens, ips)]
        )]
        self.assertEqual(estados.count(200), 1, estados)
        self.assertEqual(estados.count(409), len(estados) - 1, estados)
        with self.Sesion() as db:
            activos = db.query(Ticket).filter(
                Ticket.route_id == route_id, Ticket.numero_asiento == 7,
                Ticket.estado.notin_([EstadoTicket.CANCELADO, EstadoTicket.DISPONIBLE]),
            ).count()
            self.assertEqual(activos, 1)
            self.assertEqual(db.query(Reserva).count(), 1, "sin reservas huérfanas")

    def test_generacion_simultanea_sin_duplicados(self):
        with self.Sesion() as db:
            for i in range(3):
                db.add(Bus(placa=f"GEN-00{i}", modelo="Sintetico", tipo=BusTipo.ECONOMICO,
                           capacidad_piso1=10, capacidad_piso2=10, total_asientos=20))
            db.commit()
        fecha = (tiempo.hoy_lima() + timedelta(days=6)).isoformat()
        ips = [self.ip() for _ in range(6)]
        respuestas = self._en_paralelo([
            lambda ip=ip: llamar("POST", "/api/routes/generar",
                                 {"origen": "Lima", "destino": "Cusco", "fecha": fecha}, cliente=ip)
            for ip in ips
        ])
        self.assertTrue(all(r.status_code == 200 for r in respuestas), [r.status_code for r in respuestas])
        with self.Sesion() as db:
            por_bus = db.query(Route.bus_id, func.count(Route.id)).filter(
                Route.origen == "Lima", Route.destino == "Cusco").group_by(Route.bus_id).all()
        self.assertEqual(sorted(n for _, n in por_bus), [1, 1, 1])

    def test_checkin_simultaneo_una_sola_vez(self):
        route_id = self.crear_ruta()
        self.crear_usuario("cliente@example.com")
        self.crear_usuario("vendedor@example.com", RolUsuario.VENDEDOR)
        cliente, vendedor = self.login("cliente@example.com"), self.login("vendedor@example.com")
        r = self.comprar(cliente, route_id, (3,))
        self.assertEqual(r.status_code, 200, r.content)
        codigo = r.json()["codigo_reserva"]
        ticket_id = llamar("GET", f"/api/sales/tickets/{codigo}", token=cliente).json()[0]["id"]
        cuerpo = {"ticket_id": ticket_id, "codigo_reserva": codigo}
        estados = [r.status_code for r in self._en_paralelo(
            [lambda: llamar("POST", "/api/reservas/checkin", cuerpo, vendedor) for _ in range(4)]
        )]
        self.assertEqual(estados.count(200), 1, estados)
        self.assertTrue(all(e in (400, 409) for e in estados if e != 200), estados)
        with self.Sesion() as db:
            self.assertEqual(db.query(Reserva).filter_by(codigo=codigo).one().estado, "USADA")

    def test_sincronizacion_de_ventana_idempotente_en_postgres(self):
        with self.Sesion() as db:
            db.add(Bus(placa="SYN-001", modelo="Sintetico", tipo=BusTipo.ECONOMICO,
                       capacidad_piso1=10, capacidad_piso2=10, total_asientos=20))
            db.commit()
        with self.Sesion() as db:
            primera = programa.sincronizar_ventana(db)
        self.assertGreater(primera, 0)
        with self.Sesion() as db:
            self.assertEqual(programa.sincronizar_ventana(db), 0, "compara fechas del dialecto correctamente")
            total = db.query(Route).count()
        self.assertEqual(total, primera)


if __name__ == "__main__":
    unittest.main()
