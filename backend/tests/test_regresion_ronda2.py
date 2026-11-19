"""Regresión defensiva de la segunda ronda del commit 3 (BD SQLite temporal).

Cubre: seed demo solo con opt-in y SQLite explícito, bootstrap de admin sin
tocar cuentas ni esquema, búsqueda de solo lectura con generación explícita,
calendario y corte de salida en hora de Lima, no sobrescritura de horarios y
precios, migración del índice (creación, rollback SQLite y PostgreSQL),
limitador atómico de login/registro, anti-enumeración, no-store en auth,
logs/errores sin datos, errores de configuración sin secretos e IDs fuera
del rango entero.

Archivo propio: no modifica las pruebas de la primera ronda.
"""
import io
import logging
import os
import sqlite3
import threading
import unittest
from contextlib import redirect_stdout
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from tests.apoyo import SessionLocal, directorio_temporal, engine, llamar, reiniciar_bd, token_de

from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import OperationalError

import bootstrap_admin
import seed
from app import migraciones
from app.core import tiempo
from app.core.config import ConfiguracionInvalida, cargar_settings
from app.core.security import hashear_password, verificar_password
from app.esquema import migrar
from app.models.bus import Bus, BusTipo
from app.models.route import Route
from app.models.user import RolUsuario, User
from app.routers import auth as auth_router
from app.routers import routes as routes_router
from app.services import programa

CLAVE = "clave-sintetica-ronda-2"
PASSWORD_ADMIN = "Sintetica-Ronda2-2026!"
MAX_ID = 2_147_483_647


def _pasajero(asiento):
    return {
        "numero_asiento": asiento, "tipo_documento": "DNI", "documento": f"7100000{asiento % 10}",
        "nombres": "Prueba", "apellido_paterno": "Sintetico", "apellido_materno": "Ficticio",
        "sexo": "Femenino", "fecha_nacimiento": "1990-01-01", "telefono": "900000000",
    }


class _Base(unittest.TestCase):
    def setUp(self):
        reiniciar_bd()
        db = SessionLocal()
        try:
            hash_ficticio = hashear_password(CLAVE)
            self.usuarios = {}
            for alias, rol in (("cliente", RolUsuario.CLIENTE), ("admin", RolUsuario.ADMIN),
                               ("vendedor", RolUsuario.VENDEDOR)):
                u = User(email=f"{alias}@example.com", nombre=f"Usuario {alias}",
                         hashed_password=hash_ficticio, rol=rol)
                db.add(u)
                self.usuarios[alias] = u
            bus = Bus(placa="RD2-001", modelo="Sintetico", tipo=BusTipo.ECONOMICO,
                      capacidad_piso1=10, capacidad_piso2=10, total_asientos=20)
            db.add(bus)
            db.flush()
            self.fecha = tiempo.hoy_lima() + timedelta(days=3)
            ruta = Route(origen="Lima", destino="Ica", fecha_salida=datetime.combine(self.fecha, datetime.min.time()),
                         hora_salida="13:15", duracion_horas=5, precio_base=77.0, precio_vip=99.0, bus_id=bus.id)
            db.add(ruta)
            db.commit()
            self.bus_id, self.route_id = bus.id, ruta.id
            self.tokens = {k: token_de(u) for k, u in self.usuarios.items()}
        finally:
            db.close()

    def _rutas(self, **filtro):
        db = SessionLocal()
        try:
            return [(r.origen, r.destino, r.fecha_salida, r.hora_salida, r.precio_base, r.precio_vip, r.bus_id)
                    for r in db.query(Route).filter_by(**filtro).order_by(Route.id).all()]
        finally:
            db.close()

    def _usuarios(self):
        db = SessionLocal()
        try:
            return [(u.id, u.email, u.rol, u.is_active, u.hashed_password)
                    for u in db.query(User).order_by(User.id).all()]
        finally:
            db.close()


# -------------------------------------------------------------- seed demo
class SeedDemoTest(_Base):
    def _main(self, argv, ajustes=None):
        salida = io.StringIO()
        with patch.object(seed, "cargar_demo", side_effect=AssertionError("no debía cargar")), \
             redirect_stdout(salida):
            if ajustes is not None:
                with patch.object(seed, "settings", ajustes):
                    return seed.main(argv), salida.getvalue()
            return seed.main(argv), salida.getvalue()

    def test_sin_opt_in_no_toca_la_base(self):
        codigo, salida = self._main([])
        self.assertEqual(codigo, seed.CODIGO_RECHAZADO)
        self.assertIn("--desarrollo", salida)

    def test_rechaza_destinos_no_sqlite_o_sin_url_explicita(self):
        casos = (
            SimpleNamespace(model_fields_set=set(), DATABASE_URL="sqlite:////tmp/x.db"),
            SimpleNamespace(model_fields_set={"DATABASE_URL"}, DATABASE_URL="postgresql://u@h/db"),
            SimpleNamespace(model_fields_set={"DATABASE_URL"}, DATABASE_URL="sqlite://"),
            SimpleNamespace(model_fields_set={"DATABASE_URL"}, DATABASE_URL="sqlite:///:memory:"),
            SimpleNamespace(model_fields_set={"DATABASE_URL"}, DATABASE_URL="no es una url"),
        )
        for ajustes in casos:
            codigo, salida = self._main(["--desarrollo"], ajustes)
            self.assertEqual(codigo, seed.CODIGO_RECHAZADO, ajustes)
            self.assertNotIn("u@h", salida)

    def test_url_por_defecto_no_cuenta_como_explicita(self):
        entorno = {k: v for k, v in os.environ.items() if k != "DATABASE_URL"}
        with patch.dict(os.environ, entorno, clear=True):
            ajustes = cargar_settings(SECRET_KEY="k" * 40, _env_file=None)
        self.assertNotIn("DATABASE_URL", ajustes.model_fields_set)
        with patch.object(seed, "settings", ajustes):
            with self.assertRaises(seed.SeedRechazado):
                seed.verificar_destino()

    def test_no_modifica_cuentas_existentes_ni_demo_heredada(self):
        db = SessionLocal()
        try:
            db.add(User(email="demo.heredada@example.com", nombre="Demo heredada",
                        hashed_password=hashear_password("clave-demo-conocida"), rol=RolUsuario.ADMIN))
            db.commit()
        finally:
            db.close()
        migrar(engine)  # paso explícito, separado del seed
        antes = self._usuarios()
        salida = io.StringIO()
        with patch.object(seed.programa, "sincronizar_ventana", return_value=0), redirect_stdout(salida):
            self.assertEqual(seed.main(["--desarrollo"]), 0, salida.getvalue())
        self.assertEqual(self._usuarios(), antes)
        r = llamar("POST", "/api/auth/login", {"email": "demo.heredada@example.com", "password": "clave-demo-conocida"})
        self.assertEqual(r.status_code, 200, "el seed no desactiva cuentas por su cuenta")


# --------------------------------------------------------- bootstrap admin
class BootstrapAdminTest(_Base):
    def _main(self, entorno, argv=()):
        limpio = {k: v for k, v in os.environ.items() if not k.startswith("BUSS_ADMIN")}
        limpio.update(entorno)
        salida = io.StringIO()
        with patch.dict(os.environ, limpio, clear=True), redirect_stdout(salida):
            codigo = bootstrap_admin.main(list(argv))
        return codigo, salida.getvalue()

    def test_no_crea_ni_repara_tablas(self):
        ruta = os.path.join(directorio_temporal(), "bootstrap-vacia.db")
        if os.path.exists(ruta):
            os.remove(ruta)
        vacia = create_engine(f"sqlite:///{ruta}")
        try:
            with patch.object(bootstrap_admin, "engine", vacia):
                codigo, salida = self._main({"BUSS_ADMIN_EMAIL": "nuevo.admin@example.com",
                                             "BUSS_ADMIN_PASSWORD": PASSWORD_ADMIN})
            self.assertEqual(codigo, 1)
            self.assertNotIn(PASSWORD_ADMIN, salida)
            self.assertEqual(inspect(vacia).get_table_names(), [])
        finally:
            vacia.dispose()

    def test_no_carga_datos_demo(self):
        antes = self._rutas()
        codigo, _ = self._main({"BUSS_ADMIN_EMAIL": "nuevo.admin@example.com", "BUSS_ADMIN_PASSWORD": PASSWORD_ADMIN})
        self.assertEqual(codigo, 0)
        self.assertEqual(self._rutas(), antes)
        db = SessionLocal()
        try:
            self.assertEqual(db.query(Bus).count(), 1)
        finally:
            db.close()

    def test_email_validado_con_emailstr(self):
        for email in ("sin-arroba", "a@b", "dos@@example.com", "con espacio@example.com", "x" * 250 + "@e.com"):
            codigo, _ = self._main({"BUSS_ADMIN_EMAIL": email, "BUSS_ADMIN_PASSWORD": PASSWORD_ADMIN})
            self.assertEqual(codigo, 1, email)
        self.assertEqual(len(self._usuarios()), 3)

    def test_no_modifica_cuenta_existente_ni_su_rol(self):
        antes = self._usuarios()
        codigo, _ = self._main({"BUSS_ADMIN_EMAIL": "Cliente@Example.com", "BUSS_ADMIN_PASSWORD": PASSWORD_ADMIN})
        self.assertEqual(codigo, 1)
        self.assertEqual(self._usuarios(), antes)


# --------------------------------------------------- búsqueda y programa
class BusquedaSoloLecturaTest(_Base):
    def test_get_buscar_no_escribe(self):
        antes = self._rutas()
        fecha = (tiempo.hoy_lima() + timedelta(days=5)).isoformat()
        r = llamar("GET", f"/api/routes/buscar?origen=Lima&destino=Cusco&fecha={fecha}")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json(), [])
        self.assertEqual(self._rutas(), antes)
        # Tampoco escribe el par ya programado ni sin fecha.
        llamar("GET", "/api/routes/buscar?origen=Lima&destino=Ica")
        llamar("GET", f"/api/routes/buscar?origen=Lima&destino=Ica&fecha={self.fecha.isoformat()}")
        self.assertEqual(self._rutas(), antes)

    def test_post_generar_crea_controlado_y_get_lo_encuentra(self):
        fecha = (tiempo.hoy_lima() + timedelta(days=5)).isoformat()
        r = llamar("POST", "/api/routes/generar", {"origen": "lima", "destino": "cusco", "fecha": fecha})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(len(r.json()), 1)
        self.assertEqual(llamar("POST", "/api/routes/generar",
                                {"origen": "Lima", "destino": "Cusco", "fecha": fecha}).status_code, 200)
        self.assertEqual(len(self._rutas(destino="Cusco")), 1, "idempotente: una salida por bus y día")
        g = llamar("GET", f"/api/routes/buscar?origen=Lima&destino=Cusco&fecha={fecha}")
        self.assertEqual([x["id"] for x in g.json()], [x["id"] for x in r.json()])

    def test_post_generar_valida_y_no_crea_fuera_de_catalogo_u_horizonte(self):
        antes = self._rutas()
        hoy = tiempo.hoy_lima()
        for cuerpo, estado in (
            ({"origen": "Ciudad-Inexistente", "destino": "Ica"}, 404),
            ({"origen": "Lima", "destino": "Lima"}, 400),
            ({"origen": "Lima", "destino": "Ica", "fecha": (hoy - timedelta(days=1)).isoformat()}, 400),
            ({"origen": "Lima", "destino": "Ica", "fecha": (hoy + timedelta(days=91)).isoformat()}, 400),
            ({"origen": "Lima", "destino": "Ica", "fecha": "2026-02-30"}, 400),
            ({"origen": "L" * 81, "destino": "Ica"}, 422),
        ):
            r = llamar("POST", "/api/routes/generar", cuerpo)
            self.assertEqual(r.status_code, estado, cuerpo)
            self.assertNotIn(b"Ciudad-Inexistente", r.content)
        self.assertEqual(self._rutas(), antes)

    def test_post_generar_limitado_por_ip(self):
        fecha = (tiempo.hoy_lima() + timedelta(days=6)).isoformat()
        cuerpo = {"origen": "Lima", "destino": "Piura", "fecha": fecha}
        with patch.object(routes_router, "GENERAR_IP_MAX", 2):
            for _ in range(2):
                self.assertEqual(llamar("POST", "/api/routes/generar", cuerpo, cliente="10.9.0.1").status_code, 200)
            r = llamar("POST", "/api/routes/generar", cuerpo, cliente="10.9.0.1")
            self.assertEqual(r.status_code, 429)
            self.assertIn("retry-after", r.headers)
            self.assertEqual(llamar("POST", "/api/routes/generar", cuerpo, cliente="10.9.0.2").status_code, 200)

    def test_nunca_sobrescribe_horarios_ni_precios(self):
        antes = self._rutas(origen="Lima", destino="Ica")
        db = SessionLocal()
        try:
            programa.generar_salidas_faltantes(db, "Lima", "Ica", self.fecha)
            programa.sincronizar_ventana(db)
        finally:
            db.close()
        claves = [(o, d, f.date(), b) for o, d, f, _h, _p, _v, b in self._rutas()]
        self.assertEqual(len(claves), len(set(claves)), "salidas duplicadas por origen, destino, fecha y bus")
        llamar("POST", "/api/routes/generar", {"origen": "Lima", "destino": "Ica", "fecha": self.fecha.isoformat()})
        ida = [f for f in self._rutas(origen="Lima", destino="Ica") if f[2].date() == self.fecha]
        self.assertEqual(ida, antes)
        self.assertEqual((ida[0][3], ida[0][4], ida[0][5]), ("13:15", 77.0, 99.0))

    def test_ruta_por_id_para_seleccion_de_asientos(self):
        r = llamar("GET", f"/api/routes/{self.route_id}")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual((r.json()["id"], r.json()["precio_base"]), (self.route_id, 77.0))
        self.assertEqual(llamar("GET", "/api/routes/999999").status_code, 404)


class CalendarioLimaTest(_Base):
    AHORA = datetime(2030, 1, 10, 12, 0)

    def _ruta(self, dia, hora):
        db = SessionLocal()
        try:
            r = Route(origen="Lima", destino="Huaraz", fecha_salida=datetime.combine(dia, datetime.min.time()).replace(hour=8),
                      hora_salida=hora, duracion_horas=8, precio_base=80.0, bus_id=self.bus_id)
            db.add(r)
            db.commit()
            return r.id
        finally:
            db.close()

    def test_ahora_lima_es_utc_menos_5(self):
        esperado = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=5)
        self.assertLess(abs((tiempo.ahora_lima() - esperado).total_seconds()), 5)
        self.assertEqual(tiempo.inicio_dia_lima_en_utc(date(2030, 1, 10)), datetime(2030, 1, 10, 5, 0))

    def test_corte_real_por_hora_de_salida(self):
        dia = self.AHORA.date()
        salida_temprano = self._ruta(dia, "06:00")
        salida_tarde = self._ruta(dia, "18:00")
        with patch.object(programa, "ahora_lima", return_value=self.AHORA), \
             patch.object(routes_router, "hoy_lima", return_value=dia):
            r = llamar("GET", f"/api/routes/buscar?origen=Lima&destino=Huaraz&fecha={dia.isoformat()}")
            self.assertEqual(r.status_code, 200, r.content)
            self.assertEqual([x["id"] for x in r.json()], [salida_tarde])
            ya = llamar("POST", "/api/sales/checkout",
                        {"route_id": salida_temprano, "email": "c@example.com", "pasajeros": [_pasajero(1)]},
                        self.tokens["cliente"])
            self.assertEqual(ya.status_code, 400, ya.content)
            ok = llamar("POST", "/api/sales/checkout",
                        {"route_id": salida_tarde, "email": "c@example.com", "pasajeros": [_pasajero(1)]},
                        self.tokens["cliente"])
            self.assertEqual(ok.status_code, 200, ok.content)
            ayer = llamar("GET", f"/api/routes/buscar?origen=Lima&destino=Huaraz&fecha={(dia - timedelta(days=1)).isoformat()}")
            self.assertEqual(ayer.status_code, 400)

    def test_salida_con_hora_invalida_usa_fecha_salida(self):
        ruta = Route(fecha_salida=datetime(2030, 1, 10, 9, 30), hora_salida="??")
        self.assertEqual(programa.salida_real(ruta), datetime(2030, 1, 10, 9, 30))
        self.assertTrue(programa.ya_salio(Route(fecha_salida=None, hora_salida="10:00")))


# --------------------------------------------------------------- migración
_TICKETS = """
CREATE TABLE tickets (id INTEGER PRIMARY KEY, route_id INTEGER NOT NULL,
    numero_asiento INTEGER NOT NULL, estado VARCHAR(10), codigo_reserva VARCHAR);
"""


class MigracionIndiceRonda2Test(unittest.TestCase):
    def _base(self, sql):
        ruta = os.path.join(directorio_temporal(), f"r2-{self._testMethodName}.db")
        if os.path.exists(ruta):
            os.remove(ruta)
        con = sqlite3.connect(ruta)
        con.executescript(_TICKETS + sql)
        con.commit()
        con.close()
        self.ruta = ruta
        self.engine = create_engine(f"sqlite:///{ruta}")
        self.addCleanup(self.engine.dispose)

    def _sql_indice(self):
        con = sqlite3.connect(self.ruta)
        try:
            fila = con.execute("select sql from sqlite_master where name='uq_ticket_ruta_asiento'").fetchone()
            return fila[0] if fila else None
        finally:
            con.close()

    def test_crea_indice_si_falta(self):
        self._base("INSERT INTO tickets VALUES (1, 1, 1, 'VENDIDO', 'BC-A');")
        self.assertEqual(migraciones.aplicar_migraciones(self.engine), ["uq_ticket_ruta_asiento"])
        self.assertIn("NOT IN ('CANCELADO', 'DISPONIBLE')", self._sql_indice())
        self.assertEqual(migraciones.aplicar_migraciones(self.engine), [])

    def test_rollback_sqlite_conserva_indice_anterior(self):
        self._base("""
            CREATE UNIQUE INDEX uq_ticket_ruta_asiento ON tickets (route_id, numero_asiento)
                WHERE estado != 'CANCELADO';
            INSERT INTO tickets VALUES (1, 1, 1, 'VENDIDO', 'BC-A');
        """)
        anterior = self._sql_indice()
        with patch.object(migraciones, "_sql_crear_indice",
                          return_value="CREATE UNIQUE INDEX uq_ticket_ruta_asiento ON tabla_inexistente (x)"):
            with self.assertRaises(migraciones.MigracionFallida):
                migraciones.aplicar_migraciones(self.engine)
        self.assertEqual(self._sql_indice(), anterior, "el DROP se revirtió")
        with self.assertRaises(sqlite3.IntegrityError):
            con = sqlite3.connect(self.ruta)
            try:
                con.execute("insert into tickets values (2, 1, 1, 'VENDIDO', 'BC-B')")
            finally:
                con.close()

    def test_duplicados_impiden_crear_y_no_alteran_datos(self):
        self._base("""
            INSERT INTO tickets VALUES (1, 1, 1, 'VENDIDO', 'BC-A');
            INSERT INTO tickets VALUES (2, 1, 1, 'USADO', 'BC-B');
        """)
        with self.assertRaises(migraciones.MigracionFallida) as ctx:
            migraciones.aplicar_migraciones(self.engine)
        self.assertNotIn("BC-A", str(ctx.exception))
        self.assertIsNone(self._sql_indice())
        con = sqlite3.connect(self.ruta)
        try:
            self.assertEqual(con.execute("select count(*) from tickets").fetchone()[0], 2)
        finally:
            con.close()

    def test_detecta_restricciones_heredadas_sin_repararlas(self):
        self._base("CREATE UNIQUE INDEX legado_codigo ON tickets (codigo_reserva);")
        migraciones.aplicar_migraciones(self.engine)
        self.assertEqual(migraciones.restricciones_heredadas(self.engine), ["legado_codigo"])


class _ConPG:
    def __init__(self, fila):
        self.fila = fila
        self.sql = []

    def execute(self, sentencia, parametros=None):
        self.sql.append(str(sentencia))
        return SimpleNamespace(fetchone=lambda: self.fila)


class MigracionPostgresTest(unittest.TestCase):
    def _aplicar(self, fila):
        con = _ConPG(fila)
        with patch.object(migraciones, "inspect", return_value=SimpleNamespace(has_table=lambda _t: True)):
            cambiado = migraciones._indice_asiento_postgresql(con)
        ddl = [s for s in con.sql if s.lstrip().upper().startswith(("DROP", "CREATE"))]
        return cambiado, ddl

    def test_crea_si_falta(self):
        cambiado, ddl = self._aplicar(None)
        self.assertTrue(cambiado)
        self.assertEqual(len(ddl), 1)
        self.assertIn("NOT IN ('CANCELADO', 'DISPONIBLE')", ddl[0])

    def test_actualiza_predicado_antiguo(self):
        cambiado, ddl = self._aplicar((True, "((estado)::text <> 'CANCELADO'::text)", ["route_id", "numero_asiento"]))
        self.assertTrue(cambiado)
        self.assertTrue(ddl[0].upper().startswith("DROP INDEX"))
        self.assertTrue(ddl[1].upper().startswith("CREATE UNIQUE INDEX"))

    def test_respeta_indice_correcto(self):
        fila = (True, "(estado <> ALL (ARRAY['CANCELADO'::estadoticket, 'DISPONIBLE'::estadoticket]))",
                ["route_id", "numero_asiento"])
        self.assertEqual(self._aplicar(fila), (False, []))


# ------------------------------------------------------ login y registro
class AutenticacionRonda2Test(_Base):
    def _login(self, email, password, ip):
        return llamar("POST", "/api/auth/login", {"email": email, "password": password}, cliente=ip)

    def test_conteo_atomico_bajo_concurrencia(self):
        resultados = []
        candado = threading.Lock()
        barrera = threading.Barrier(12)

        def intento():
            barrera.wait(timeout=10)
            r = self._login("cliente@example.com", "incorrecta-123", "10.7.0.1")
            with candado:
                resultados.append(r.status_code)

        hilos = [threading.Thread(target=intento) for _ in range(12)]
        for h in hilos:
            h.start()
        for h in hilos:
            h.join(timeout=60)
        self.assertEqual(len(resultados), 12)
        self.assertLessEqual(resultados.count(401), auth_router.LOGIN_IP_MAX)
        self.assertEqual(resultados.count(401) + resultados.count(429), 12)

    def test_atacante_desde_otra_ip_no_bloquea_al_titular(self):
        # Varias IP del atacante, sin agotar el límite por IP de ninguna.
        ips = [f"10.8.0.{i}" for i in range(1, 4)]
        fallos = 0
        for ip in ips:
            for _ in range(4):
                self.assertEqual(self._login("cliente@example.com", "incorrecta-123", ip).status_code, 401)
                fallos += 1
        self.assertGreaterEqual(fallos, auth_router.LOGIN_CUENTA_IP_MAX)
        self.assertEqual(self._login("cliente@example.com", CLAVE, "10.8.1.1").status_code, 200)

    def test_cuenta_ip_limitada_para_el_atacante(self):
        with patch.object(auth_router, "LOGIN_IP_MAX", 100):
            for _ in range(auth_router.LOGIN_CUENTA_IP_MAX):
                self.assertEqual(self._login("cliente@example.com", "incorrecta-123", "10.8.2.1").status_code, 401)
            self.assertEqual(self._login("cliente@example.com", CLAVE, "10.8.2.1").status_code, 429)
        self.assertEqual(self._login("cliente@example.com", CLAVE, "10.8.2.2").status_code, 200)

    def test_registro_no_enumera(self):
        nuevo = llamar("POST", "/api/auth/register",
                       {"email": "nueva@example.com", "nombre": "Cuenta Nueva", "password": "valida-123"})
        existente = llamar("POST", "/api/auth/register",
                           {"email": "cliente@example.com", "nombre": "Intruso", "password": "otra-clave-1"})
        self.assertEqual((nuevo.status_code, nuevo.json()), (existente.status_code, existente.json()))
        self.assertNotIn("id", nuevo.json())
        self.assertNotIn("email", nuevo.json())
        db = SessionLocal()
        try:
            cliente = db.query(User).filter(User.email == "cliente@example.com").one()
            self.assertEqual(cliente.nombre, "Usuario cliente")
            self.assertTrue(verificar_password(CLAVE, cliente.hashed_password))
        finally:
            db.close()

    def test_auth_sin_cache_tambien_en_errores(self):
        respuestas = [
            self._login("cliente@example.com", CLAVE, "10.6.0.1"),
            self._login("cliente@example.com", "incorrecta-123", "10.6.0.1"),
            llamar("POST", "/api/auth/login", {"email": "no-correo"}),
            llamar("POST", "/api/auth/register", {"email": "z@example.com", "nombre": "Zeta", "password": "valida-123"}),
        ]
        with patch.object(auth_router, "LOGIN_IP_MAX", 1):
            respuestas.append(self._login("cliente@example.com", "incorrecta-123", "10.6.0.2"))
            respuestas.append(self._login("cliente@example.com", CLAVE, "10.6.0.2"))
        self.assertEqual([r.status_code for r in respuestas], [200, 401, 422, 201, 401, 429])
        for r in respuestas:
            self.assertIn("no-store", r.headers.get("cache-control", ""), r.status_code)
        self.assertNotIn("no-store", llamar("GET", "/api/routes/ciudades").headers.get("cache-control", ""))


# ------------------------------------------------- errores, logs y config
class ErroresSinDatosTest(_Base):
    CODIGO = "BC-SECRETO1"

    def test_500_generico_y_log_sin_ruta_real_ni_mensaje(self):
        with patch("app.routers.sales._reserva_autorizada",
                   side_effect=RuntimeError(f"detalle-interno {self.CODIGO}")), \
             self.assertLogs("buss.api", level=logging.ERROR) as logs:
            r = llamar("GET", f"/api/sales/tickets/{self.CODIGO}?correo=x@example.com", token=self.tokens["cliente"])
        self.assertEqual(r.status_code, 500)
        self.assertEqual(r.headers.get("x-content-type-options"), "nosniff")
        self.assertNotIn(self.CODIGO.encode(), r.content)
        texto = "\n".join(logs.output)
        self.assertIn("/api/sales/tickets/{codigo}", texto)
        for prohibido in (self.CODIGO, "detalle-interno", "x@example.com", "correo="):
            self.assertNotIn(prohibido, texto)

    def test_503_bd_log_sin_sql_ni_parametros(self):
        error = OperationalError(f"SELECT * FROM reservas WHERE codigo = '{self.CODIGO}'", {"c": self.CODIGO},
                                 Exception("fallo"))
        with patch("app.routers.sales._reserva_autorizada", side_effect=error), \
             self.assertLogs("buss.api", level=logging.ERROR) as logs:
            r = llamar("GET", f"/api/sales/tickets/{self.CODIGO}", token=self.tokens["cliente"])
        self.assertEqual(r.status_code, 503)
        self.assertNotIn(self.CODIGO, "\n".join(logs.output))
        self.assertNotIn(b"SELECT", r.content)

    def test_busqueda_no_repite_parametros_en_errores(self):
        r = llamar("GET", "/api/routes/buscar?origen=CiudadInventadaXYZ&destino=Ica")
        self.assertEqual(r.status_code, 404)
        self.assertNotIn(b"CiudadInventadaXYZ", r.content)

    def test_error_de_configuracion_sin_secret_key(self):
        secreto = "valor-secreto-corto"
        with self.assertRaises(ConfiguracionInvalida) as ctx:
            cargar_settings(SECRET_KEY=secreto, _env_file=None)
        self.assertNotIn(secreto, str(ctx.exception))
        self.assertIn("SECRET_KEY", str(ctx.exception))
        self.assertIsNone(ctx.exception.__cause__)
        self.assertTrue(ctx.exception.__suppress_context__)
        with self.assertRaises(ConfiguracionInvalida) as ctx:
            cargar_settings(SECRET_KEY="k" * 40, ALGORITHM="none-secreto", _env_file=None)
        self.assertNotIn("none-secreto", str(ctx.exception))


class IdsFueraDeRangoTest(_Base):
    def test_ids_mayores_que_integer_responden_422(self):
        enorme = MAX_ID + 1
        gigante = 10 ** 30
        for ruta in (f"/api/routes/{enorme}", f"/api/routes/{gigante}/asientos",
                     f"/api/buses/{gigante}/asientos?route_id=1", f"/api/buses/1/asientos?route_id={enorme}"):
            self.assertEqual(llamar("GET", ruta).status_code, 422, ruta)
        r = llamar("POST", "/api/sales/checkout",
                   {"route_id": gigante, "email": "c@example.com", "pasajeros": [_pasajero(1)]},
                   self.tokens["cliente"])
        self.assertEqual(r.status_code, 422)
        r = llamar("POST", "/api/reservas/checkin", {"ticket_id": gigante, "codigo_reserva": "BC-1"},
                   self.tokens["vendedor"])
        self.assertEqual(r.status_code, 422)
        fecha = (datetime.now() + timedelta(days=5)).replace(microsecond=0).isoformat()
        r = llamar("POST", "/api/routes/", {"origen": "Lima", "destino": "Cusco", "fecha_salida": fecha,
                                            "hora_salida": "10:00", "duracion_horas": 20, "precio_base": 100,
                                            "bus_id": gigante}, self.tokens["admin"])
        self.assertEqual(r.status_code, 422)

    def test_id_maximo_valido_responde_404(self):
        self.assertEqual(llamar("GET", f"/api/routes/{MAX_ID}/asientos").status_code, 404)


if __name__ == "__main__":
    unittest.main()
