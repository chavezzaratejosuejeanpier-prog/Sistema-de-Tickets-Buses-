"""Endurecimiento (commit 3 de seguridad) con BD temporal y datos sintéticos.

Cubre: seed sin administrador fijo, disponibilidad tras cancelar, login,
registro y limitador, tokens, configuración, cabeceras, límite de cuerpo,
errores y validación, FK, índice de asientos, transacciones y salud.
Solo aserciones defensivas: no se usan datos reales ni servicios externos.
"""
import base64
import io
import json
import os
import sqlite3
import unittest
from contextlib import redirect_stdout
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from tests.apoyo import SessionLocal, app, directorio_temporal, engine, llamar, reiniciar_bd, token_de

from jose import jwt
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError, OperationalError

import bootstrap_admin
import seed
from app.core import rate_limit
from app.core.config import Settings, settings
from app.core.security import hashear_password, verificar_password
from app.core.tiempo import hoy_lima
from app.database import get_db
from app.esquema import migrar
from app.migraciones import aplicar_migraciones
from app.models.bus import Bus, BusTipo
from app.models.reserva import Reserva
from app.models.route import Route
from app.models.ticket import EstadoTicket, Ticket
from app.models.user import RolUsuario, User
from app.services import programa

CLAVE_FICTICIA = "clave-sintetica-de-prueba-123"
ADMIN_FICTICIO = "admin.sintetico@example.com"
PASSWORD_ADMIN_FICTICIA = "Sintetica-Prueba-2026!"


def _ahora_utc():
    return datetime.now(timezone.utc)


def _pasajero(asiento, **cambios):
    datos = {
        "numero_asiento": asiento,
        "tipo_documento": "DNI",
        "documento": f"7000000{asiento % 10}",
        "nombres": "Prueba",
        "apellido_paterno": "Sintetico",
        "apellido_materno": "Ficticio",
        "sexo": "Femenino",
        "fecha_nacimiento": "1990-01-01",
        "telefono": "900000000",
    }
    datos.update(cambios)
    return datos


class BaseEndurecimiento(unittest.TestCase):
    def setUp(self):
        reiniciar_bd()
        db = SessionLocal()
        try:
            hash_ficticio = hashear_password(CLAVE_FICTICIA)
            self.usuarios = {}
            for alias, rol in (
                ("cliente", RolUsuario.CLIENTE),
                ("otro", RolUsuario.CLIENTE),
                ("admin", RolUsuario.ADMIN),
                ("vendedor", RolUsuario.VENDEDOR),
            ):
                u = User(email=f"{alias}@example.com", nombre=f"Usuario {alias}",
                         hashed_password=hash_ficticio, rol=rol)
                db.add(u)
                self.usuarios[alias] = u
            bus = Bus(placa="TST-001", modelo="Sintetico", tipo=BusTipo.ECONOMICO,
                      capacidad_piso1=10, capacidad_piso2=10, total_asientos=20)
            db.add(bus)
            db.flush()
            ruta = Route(origen="Lima", destino="Ica", fecha_salida=datetime.now() + timedelta(days=3),
                         hora_salida="08:00", duracion_horas=5, precio_base=50.0, bus_id=bus.id)
            db.add(ruta)
            db.commit()
            self.bus_id = bus.id
            self.route_id = ruta.id
            self.tokens = {k: token_de(u) for k, u in self.usuarios.items()}
        finally:
            db.close()

    def _checkout(self, pasajeros, alias="cliente", route_id=None, **extra):
        cuerpo = {"route_id": route_id or self.route_id, "email": "contacto@example.com",
                  "pasajeros": pasajeros, **extra}
        return llamar("POST", "/api/sales/checkout", cuerpo, self.tokens[alias])

    def _comprar(self, asientos, alias="cliente"):
        r = self._checkout([_pasajero(a) for a in asientos], alias)
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()["codigo_reserva"]


# --------------------------------------------------------------------- seed
class SeedSeguroTest(BaseEndurecimiento):
    """Seed de demostración (solo desarrollo) y bootstrap de administrador."""

    def _sin_admin_env(self, entorno=None):
        limpio = {k: v for k, v in os.environ.items() if not k.startswith("BUSS_ADMIN")}
        limpio.update(entorno or {})
        return limpio

    def _ejecutar_seed(self, argv=("--desarrollo",)):
        salida = io.StringIO()
        with patch.object(seed.programa, "sincronizar_ventana", return_value=0), redirect_stdout(salida):
            codigo = seed.main(list(argv))
        return codigo, salida.getvalue()

    def _ejecutar_bootstrap(self, argv=(), entorno=None, getpass_valores=None):
        salida = io.StringIO()
        with patch.dict(os.environ, self._sin_admin_env(entorno), clear=True), \
             patch.object(bootstrap_admin.getpass, "getpass", side_effect=list(getpass_valores or [])), \
             redirect_stdout(salida):
            codigo = bootstrap_admin.main(list(argv))
        return codigo, salida.getvalue()

    def _usuario(self, email):
        db = SessionLocal()
        try:
            return db.query(User).filter(User.email == email).first()
        finally:
            db.close()

    def _usuarios(self):
        db = SessionLocal()
        try:
            return [(u.email, u.rol, u.is_active, u.hashed_password)
                    for u in db.query(User).order_by(User.id).all()]
        finally:
            db.close()

    def test_codigo_sin_credencial_fija(self):
        for modulo in (seed, bootstrap_admin):
            fuente = Path(modulo.__file__).read_text(encoding="utf-8")
            self.assertNotIn("123456", fuente, modulo.__name__)
            self.assertNotIn("admin@buss.com", fuente, modulo.__name__)
        self.assertFalse(hasattr(seed, "desactivar_admin_demo"))
        self.assertFalse(hasattr(seed, "crear_admin"))

    def test_seed_exige_opt_in_de_desarrollo(self):
        reiniciar_bd()
        codigo, salida = self._ejecutar_seed(argv=())
        self.assertEqual(codigo, seed.CODIGO_RECHAZADO)
        self.assertIn("--desarrollo", salida)
        db = SessionLocal()
        try:
            self.assertEqual(db.query(Bus).count(), 0)
        finally:
            db.close()

    def test_seed_demo_no_crea_ni_modifica_usuarios(self):
        db = SessionLocal()
        try:
            db.query(Route).delete()
            db.query(Bus).delete()
            db.commit()
        finally:
            db.close()
        # La migración es un paso explícito y separado del seed.
        migrar(engine)
        antes = self._usuarios()
        codigo, salida = self._ejecutar_seed()
        self.assertEqual(codigo, 0, salida)
        self.assertEqual(self._usuarios(), antes)
        db = SessionLocal()
        try:
            self.assertGreater(db.query(Bus).count(), 0)
        finally:
            db.close()

    def test_bootstrap_desde_entorno_sin_mostrar_password(self):
        codigo, salida = self._ejecutar_bootstrap(entorno={
            "BUSS_ADMIN_EMAIL": ADMIN_FICTICIO, "BUSS_ADMIN_PASSWORD": PASSWORD_ADMIN_FICTICIA,
        })
        self.assertEqual(codigo, 0, salida)
        self.assertNotIn(PASSWORD_ADMIN_FICTICIA, salida)
        admin = self._usuario(ADMIN_FICTICIO)
        self.assertEqual(admin.rol, RolUsuario.ADMIN)
        self.assertTrue(verificar_password(PASSWORD_ADMIN_FICTICIA, admin.hashed_password))
        self.assertNotEqual(admin.hashed_password, PASSWORD_ADMIN_FICTICIA)

    def test_bootstrap_interactivo_con_getpass(self):
        codigo, salida = self._ejecutar_bootstrap(
            argv=["--email", ADMIN_FICTICIO],
            getpass_valores=[PASSWORD_ADMIN_FICTICIA, PASSWORD_ADMIN_FICTICIA],
        )
        self.assertEqual(codigo, 0, salida)
        self.assertNotIn(PASSWORD_ADMIN_FICTICIA, salida)
        self.assertEqual(self._usuario(ADMIN_FICTICIO).rol, RolUsuario.ADMIN)

    def test_bootstrap_rechaza_passwords_debiles_o_incompletas(self):
        for entorno in (
            {"BUSS_ADMIN_EMAIL": ADMIN_FICTICIO, "BUSS_ADMIN_PASSWORD": "corta"},
            {"BUSS_ADMIN_EMAIL": ADMIN_FICTICIO, "BUSS_ADMIN_PASSWORD": "aaaaaaaaaaaaaaaa"},
            {"BUSS_ADMIN_EMAIL": ADMIN_FICTICIO, "BUSS_ADMIN_PASSWORD": "admin.sintetico-2026"},
            {"BUSS_ADMIN_EMAIL": ADMIN_FICTICIO, "BUSS_ADMIN_PASSWORD": "ñ" * 40},
            {"BUSS_ADMIN_EMAIL": ADMIN_FICTICIO, "BUSS_ADMIN_PASSWORD": " " + PASSWORD_ADMIN_FICTICIA},
            {"BUSS_ADMIN_EMAIL": "no-es-correo", "BUSS_ADMIN_PASSWORD": PASSWORD_ADMIN_FICTICIA},
            {"BUSS_ADMIN_EMAIL": ADMIN_FICTICIO},
            {},
        ):
            codigo, salida = self._ejecutar_bootstrap(entorno=entorno)
            self.assertEqual(codigo, 1, entorno)
            self.assertIsNone(self._usuario(ADMIN_FICTICIO), entorno)
            if "BUSS_ADMIN_PASSWORD" in entorno:
                self.assertNotIn(entorno["BUSS_ADMIN_PASSWORD"].strip(), salida)

    def test_bootstrap_no_modifica_cuenta_existente(self):
        antes = self._usuarios()
        for email in ("cliente@example.com", "CLIENTE@example.com"):
            codigo, _ = self._ejecutar_bootstrap(entorno={
                "BUSS_ADMIN_EMAIL": email, "BUSS_ADMIN_PASSWORD": PASSWORD_ADMIN_FICTICIA,
            })
            self.assertEqual(codigo, 1, email)
        self.assertEqual(self._usuarios(), antes)
        self.assertTrue(verificar_password(CLAVE_FICTICIA, self._usuario("cliente@example.com").hashed_password))

    def test_getpass_distintas_no_crea(self):
        codigo, _ = self._ejecutar_bootstrap(
            argv=["--email", ADMIN_FICTICIO],
            getpass_valores=[PASSWORD_ADMIN_FICTICIA, PASSWORD_ADMIN_FICTICIA + "x"],
        )
        self.assertEqual(codigo, 1)
        self.assertIsNone(self._usuario(ADMIN_FICTICIO))


# ------------------------------------------------------------ disponibilidad
class DisponibilidadTest(BaseEndurecimiento):
    def _ocupados_bus(self):
        r = llamar("GET", f"/api/buses/{self.bus_id}/asientos?route_id={self.route_id}")
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()["ocupados"]

    def _ocupados_ruta(self):
        r = llamar("GET", f"/api/routes/{self.route_id}/asientos")
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()["ocupados"]

    def test_bus_libera_asientos_tras_cancelar(self):
        codigo = self._comprar((3, 4))
        self.assertEqual(self._ocupados_bus(), [3, 4])
        r = llamar("POST", f"/api/reservas/{codigo}/cancelar", token=self.tokens["admin"])
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self._ocupados_bus(), [])
        self.assertEqual(self._ocupados_ruta(), [])
        self._comprar((3,), "otro")
        self.assertEqual(self._ocupados_bus(), [3])
        self.assertEqual(self._ocupados_bus(), self._ocupados_ruta())

    def test_disponible_no_ocupa_ni_bloquea_compra(self):
        db = SessionLocal()
        try:
            db.add(Ticket(route_id=self.route_id, numero_asiento=7, estado=EstadoTicket.DISPONIBLE))
            db.commit()
        finally:
            db.close()
        self.assertNotIn(7, self._ocupados_bus())
        self.assertNotIn(7, self._ocupados_ruta())
        self._comprar((7,))
        self.assertEqual(self._ocupados_bus(), [7])

    def test_usado_sigue_ocupado(self):
        codigo = self._comprar((5,))
        db = SessionLocal()
        try:
            ticket = db.query(Ticket).filter(Ticket.codigo_reserva == codigo).one()
            ticket_id = ticket.id
        finally:
            db.close()
        r = llamar("POST", "/api/reservas/checkin", {"ticket_id": ticket_id, "codigo_reserva": codigo},
                   self.tokens["vendedor"])
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self._ocupados_bus(), [5])
        self.assertEqual(self._ocupados_ruta(), [5])

    def test_ruta_de_otro_bus_y_parametros_invalidos(self):
        self.assertEqual(llamar("GET", f"/api/buses/9999/asientos?route_id={self.route_id}").status_code, 404)
        self.assertEqual(llamar("GET", f"/api/buses/{self.bus_id}/asientos?route_id=0").status_code, 422)
        self.assertEqual(llamar("GET", f"/api/buses/{self.bus_id}/asientos").status_code, 422)


# ----------------------------------------------------- autenticación/limitador
class AutenticacionTest(BaseEndurecimiento):
    def _login(self, email, password, ip="127.0.0.1"):
        return llamar("POST", "/api/auth/login", {"email": email, "password": password}, cliente=ip)

    def test_login_correcto_y_token_con_exp_iat(self):
        r = self._login("cliente@example.com", CLAVE_FICTICIA)
        self.assertEqual(r.status_code, 200, r.content)
        claims = jwt.get_unverified_claims(r.json()["access_token"])
        self.assertIn("exp", claims)
        self.assertIn("iat", claims)
        self.assertEqual(claims["sub"], "cliente@example.com")

    def test_credenciales_invalidas_y_correo_inexistente_iguales(self):
        malo = self._login("cliente@example.com", "incorrecta-123")
        inexistente = self._login("nadie@example.com", "incorrecta-123")
        self.assertEqual(malo.status_code, 401)
        self.assertEqual(inexistente.status_code, 401)
        self.assertEqual(malo.json(), inexistente.json())

    def test_cuenta_inactiva_no_recibe_token(self):
        db = SessionLocal()
        try:
            db.query(User).filter(User.email == "cliente@example.com").update({"is_active": False})
            db.commit()
        finally:
            db.close()
        r = self._login("cliente@example.com", CLAVE_FICTICIA)
        self.assertEqual(r.status_code, 403)
        self.assertNotIn("access_token", r.json())
        # Un token emitido antes de desactivar tampoco sirve.
        r = llamar("GET", "/api/sales/tickets/BC-00000000", token=self.tokens["cliente"])
        self.assertEqual(r.status_code, 403)

    def test_password_larga_no_provoca_error_interno(self):
        r = self._login("cliente@example.com", "a" * 200)
        self.assertEqual(r.status_code, 401)
        r = self._login("cliente@example.com", "ñ" * 100)
        self.assertEqual(r.status_code, 401)
        self.assertEqual(self._login("cliente@example.com", "x" * 300).status_code, 422)

    def test_limite_por_ip(self):
        for _ in range(5):
            self.assertEqual(self._login("cliente@example.com", "incorrecta-123", "10.1.0.1").status_code, 401)
        r = self._login("cliente@example.com", CLAVE_FICTICIA, "10.1.0.1")
        self.assertEqual(r.status_code, 429)
        self.assertTrue(int(r.headers["retry-after"]) >= 1)
        # Otra IP con la contraseña correcta sí entra (no se superó el límite por cuenta).
        self.assertEqual(self._login("cliente@example.com", CLAVE_FICTICIA, "10.1.0.2").status_code, 200)

    def test_limite_global_por_cuenta_respeta_ip_de_confianza(self):
        from app.routers import auth as auth_router

        with patch.object(auth_router, "LOGIN_CUENTA_MAX", 3):
            # El titular entra desde su IP habitual: queda como IP de confianza.
            self.assertEqual(self._login("otro@example.com", CLAVE_FICTICIA, "10.2.0.100").status_code, 200)
            for i in range(3):
                self.assertEqual(self._login("otro@example.com", "incorrecta-123", f"10.2.0.{i + 1}").status_code, 401)
            self.assertEqual(self._login("otro@example.com", CLAVE_FICTICIA, "10.2.0.200").status_code, 429)
            # Ataque distribuido no bloquea al titular desde su IP de confianza.
            self.assertEqual(self._login("otro@example.com", CLAVE_FICTICIA, "10.2.0.100").status_code, 200)
            # Otras cuentas no se ven afectadas.
            self.assertEqual(self._login("cliente@example.com", CLAVE_FICTICIA, "10.2.0.201").status_code, 200)

    def test_login_exitoso_no_borra_fallos_previos_de_la_ip(self):
        for _ in range(4):
            self.assertEqual(self._login("cliente@example.com", "incorrecta-123", "10.3.0.1").status_code, 401)
        self.assertEqual(self._login("cliente@example.com", CLAVE_FICTICIA, "10.3.0.1").status_code, 200)
        self.assertEqual(self._login("cliente@example.com", "incorrecta-123", "10.3.0.1").status_code, 401)
        self.assertEqual(self._login("cliente@example.com", CLAVE_FICTICIA, "10.3.0.1").status_code, 429)

    def test_registro_valida_password_y_duplicado(self):
        base = {"email": "nuevo@example.com", "nombre": "Usuario Nuevo"}
        self.assertEqual(llamar("POST", "/api/auth/register", {**base, "password": "corta12"}).status_code, 422)
        # 40 caracteres pero 80 bytes: supera el límite de bcrypt.
        self.assertEqual(llamar("POST", "/api/auth/register", {**base, "password": "ñ" * 40}).status_code, 422)
        self.assertEqual(llamar("POST", "/api/auth/register", {**base, "password": "        "}).status_code, 422)
        r = llamar("POST", "/api/auth/register", {**base, "password": "valida-123"})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertNotIn("password", r.json())
        # Duplicado: misma respuesta (no permite enumerar) y la cuenta no cambia.
        dup = llamar("POST", "/api/auth/register", {**base, "nombre": "Otro Nombre", "password": "distinta-456"})
        self.assertEqual(dup.status_code, r.status_code)
        self.assertEqual(dup.json(), r.json())
        db = SessionLocal()
        try:
            u = db.query(User).filter(User.email == "nuevo@example.com").one()
            self.assertEqual(u.rol, RolUsuario.CLIENTE)
            self.assertEqual(u.nombre, "Usuario Nuevo")
            self.assertTrue(verificar_password("valida-123", u.hashed_password))
        finally:
            db.close()

    def test_registro_ignora_rol_enviado(self):
        r = llamar("POST", "/api/auth/register", {"email": "rol@example.com", "nombre": "Con Rol",
                                                  "password": "valida-123", "rol": "ADMIN"})
        self.assertEqual(r.status_code, 201)
        db = SessionLocal()
        try:
            self.assertEqual(db.query(User).filter(User.email == "rol@example.com").one().rol, RolUsuario.CLIENTE)
        finally:
            db.close()

    def test_registro_concurrente_sin_error_interno(self):
        # Otra petición inserta el mismo correo durante el registro.
        from app.routers import auth as auth_router

        original = auth_router.hashear_password

        def insertar_competidor(password):
            db = SessionLocal()
            try:
                db.add(User(email="carrera@example.com", nombre="Competidor", hashed_password="x"))
                db.commit()
            finally:
                db.close()
            return original(password)

        with patch.object(auth_router, "hashear_password", side_effect=insertar_competidor):
            r = llamar("POST", "/api/auth/register",
                       {"email": "carrera@example.com", "nombre": "Usuario Carrera", "password": "valida-123"})
        self.assertEqual(r.status_code, 201)
        db = SessionLocal()
        try:
            filas = db.query(User).filter(User.email == "carrera@example.com").all()
            self.assertEqual([u.nombre for u in filas], ["Competidor"])
        finally:
            db.close()

    def test_limite_de_registro_por_ip(self):
        for i in range(10):
            r = llamar("POST", "/api/auth/register",
                       {"email": f"r{i}@example.com", "nombre": "Usuario Registro", "password": "valida-123"},
                       cliente="10.4.0.1")
            self.assertEqual(r.status_code, 201, r.content)
        r = llamar("POST", "/api/auth/register",
                   {"email": "r10@example.com", "nombre": "Usuario Registro", "password": "valida-123"},
                   cliente="10.4.0.1")
        self.assertEqual(r.status_code, 429)


class TokensTest(BaseEndurecimiento):
    def _consultar(self, token):
        return llamar("GET", "/api/sales/", token=token)

    def test_token_sin_exp_rechazado(self):
        token = jwt.encode({"sub": "admin@example.com", "rol": "ADMIN"}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        self.assertEqual(self._consultar(token).status_code, 401)

    def test_token_sin_sub_rechazado(self):
        exp = _ahora_utc() + timedelta(minutes=5)
        token = jwt.encode({"rol": "ADMIN", "exp": exp}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        self.assertEqual(self._consultar(token).status_code, 401)

    def test_token_alg_none_rechazado(self):
        def b64(d):
            return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()
        exp = int((_ahora_utc() + timedelta(minutes=5)).timestamp())
        token = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'sub': 'admin@example.com', 'exp': exp})}."
        self.assertEqual(self._consultar(token).status_code, 401)

    def test_token_de_usuario_inexistente(self):
        exp = _ahora_utc() + timedelta(minutes=5)
        token = jwt.encode({"sub": "borrado@example.com", "exp": exp}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        r = self._consultar(token)
        self.assertEqual(r.status_code, 401)
        self.assertNotIn("borrado", r.content.decode())

    def test_rol_del_token_no_eleva_privilegios(self):
        exp = _ahora_utc() + timedelta(minutes=5)
        token = jwt.encode({"sub": "cliente@example.com", "rol": "ADMIN", "exp": exp},
                           settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        self.assertEqual(self._consultar(token).status_code, 403)


class ConfiguracionTest(unittest.TestCase):
    def test_rechaza_claves_debiles(self):
        for clave in ("", "corta", "tu-clave-secreta-aqui", "x" * 31):
            with self.assertRaises(ValidationError, msg=clave):
                Settings(SECRET_KEY=clave, _env_file=None)

    def test_rechaza_algoritmos_no_hmac(self):
        for alg in ("none", "RS256", "ES256"):
            with self.assertRaises(ValidationError, msg=alg):
                Settings(SECRET_KEY="k" * 40, ALGORITHM=alg, _env_file=None)

    def test_rechaza_expiracion_fuera_de_rango(self):
        for minutos in (0, -1, 100000):
            with self.assertRaises(ValidationError):
                Settings(SECRET_KEY="k" * 40, ACCESS_TOKEN_EXPIRE_MINUTES=minutos, _env_file=None)

    def test_valores_validos(self):
        s = Settings(SECRET_KEY="k" * 40, ALGORITHM="hs256", _env_file=None)
        self.assertEqual(s.ALGORITHM, "HS256")


class LimitadorTest(unittest.TestCase):
    def setUp(self):
        rate_limit.reiniciar()

    def tearDown(self):
        rate_limit.reiniciar()

    def test_caduca_tras_la_ventana(self):
        with patch.object(rate_limit, "time") as reloj:
            reloj.time.return_value = 1000.0
            for _ in range(3):
                rate_limit.registrar_fallo("k", ventana=60)
            with self.assertRaises(Exception) as ctx:
                rate_limit.verificar_limite("k", maximo=3, ventana=60)
            self.assertEqual(ctx.exception.status_code, 429)
            reloj.time.return_value = 1061.0
            rate_limit.verificar_limite("k", maximo=3, ventana=60)

    def test_purga_claves_y_acota_memoria(self):
        with patch.object(rate_limit, "MAX_CLAVES", 3):
            for i in range(8):
                rate_limit.registrar_fallo(f"clave-{i}")
            self.assertLessEqual(rate_limit.claves_activas(), 3)
        with patch.object(rate_limit, "time") as reloj:
            # Muy en el futuro: todas las claves anteriores han caducado.
            reloj.time.return_value = 1e11
            rate_limit.registrar_fallo("nueva")
            self.assertEqual(rate_limit.claves_activas(), 1)


# ------------------------------------------------------------------ cabeceras
class CabecerasTest(BaseEndurecimiento):
    def test_cabeceras_de_seguridad(self):
        for ruta in ("/", "/health", "/api/routes/ciudades", "/no-existe"):
            r = llamar("GET", ruta)
            self.assertEqual(r.headers.get("x-content-type-options"), "nosniff", ruta)
            self.assertEqual(r.headers.get("x-frame-options"), "DENY", ruta)
            self.assertEqual(r.headers.get("referrer-policy"), "no-referrer", ruta)
            self.assertIn("frame-ancestors 'none'", r.headers.get("content-security-policy", ""), ruta)
            self.assertIn("permissions-policy", r.headers)
            self.assertNotIn("strict-transport-security", r.headers)

    def test_hsts_solo_con_https(self):
        r = llamar("GET", "/health", esquema="https")
        self.assertIn("max-age=", r.headers.get("strict-transport-security", ""))

    def test_cabeceras_en_errores(self):
        r = llamar("GET", "/api/sales/")
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.headers.get("x-content-type-options"), "nosniff")

    def test_docs_sin_csp_estricta(self):
        if not settings.DOCS_ENABLED:
            self.skipTest("DOCS_ENABLED=false en este entorno")
        r = llamar("GET", "/docs")
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("content-security-policy", r.headers)
        self.assertEqual(r.headers.get("x-content-type-options"), "nosniff")

    def test_cors_solo_loopback_y_sin_credenciales(self):
        preflight = {"origin": "http://localhost:5173", "access-control-request-method": "POST",
                     "access-control-request-headers": "authorization,content-type"}
        r = llamar("OPTIONS", "/api/sales/checkout", cabeceras=preflight)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers.get("access-control-allow-origin"), "http://localhost:5173")
        self.assertNotIn("access-control-allow-credentials", r.headers)
        r = llamar("OPTIONS", "/api/sales/checkout", cabeceras={**preflight, "origin": "https://externo.example"})
        self.assertNotIn("access-control-allow-origin", r.headers)
        r = llamar("OPTIONS", "/api/sales/checkout",
                   cabeceras={**preflight, "origin": "http://localhost.externo.example"})
        self.assertNotIn("access-control-allow-origin", r.headers)


# ------------------------------------------------------ errores y validación
class ErroresYValidacionTest(BaseEndurecimiento):
    def test_cuerpo_excesivo_413(self):
        enorme = b'{"email":"a@example.com","password":"' + b"x" * 70_000 + b'"}'
        r = llamar("POST", "/api/auth/login", crudo=enorme)
        self.assertEqual(r.status_code, 413)
        self.assertEqual(r.headers.get("x-content-type-options"), "nosniff")
        r = llamar("POST", "/api/auth/login", crudo=enorme, cabeceras={"content-length": len(enorme)})
        self.assertEqual(r.status_code, 413)

    def test_422_en_espanol_sin_eco_de_datos(self):
        r = self._checkout([_pasajero(1, documento="SECRETO99X")])
        self.assertEqual(r.status_code, 422)
        cuerpo = r.json()
        self.assertIsInstance(cuerpo["detail"], str)
        self.assertTrue(cuerpo["detail"].startswith("Datos inválidos"))
        self.assertIsInstance(cuerpo["errores"], list)
        self.assertNotIn(b"SECRETO99X", r.content)
        self.assertNotIn(b'"input"', r.content)

    def test_json_malformado_422(self):
        r = llamar("POST", "/api/auth/login", crudo=b'{"email": ')
        self.assertEqual(r.status_code, 422)
        self.assertIsInstance(r.json()["detail"], str)

    def test_checkout_rechaza_datos_invalidos(self):
        manana = (date.today() + timedelta(days=1)).isoformat()
        casos = {
            "dni corto": [_pasajero(1, documento="1234567")],
            "dni con letras": [_pasajero(1, documento="1234567A")],
            "tipo desconocido": [_pasajero(1, tipo_documento="LICENCIA")],
            "ce corto": [_pasajero(1, tipo_documento="CE", documento="12345")],
            "nombre con dígitos": [_pasajero(1, nombres="Ana1")],
            "nombre con html": [_pasajero(1, nombres="<b>Ana</b>")],
            "nombre muy largo": [_pasajero(1, nombres="A" * 81)],
            "paterno vacío": [_pasajero(1, apellido_paterno="   ")],
            "sexo inválido": [_pasajero(1, sexo="X")],
            "nacimiento futuro": [_pasajero(1, fecha_nacimiento=manana)],
            "nacimiento antiguo": [_pasajero(1, fecha_nacimiento="1800-01-01")],
            "teléfono corto": [_pasajero(1, telefono="12")],
            "teléfono con letras": [_pasajero(1, telefono="9000abc00")],
            "asiento cero": [_pasajero(0)],
            "asiento negativo": [_pasajero(-3)],
        }
        for nombre, pasajeros in casos.items():
            r = self._checkout(pasajeros)
            self.assertEqual(r.status_code, 422, f"{nombre}: {r.content}")
        self.assertEqual(self._checkout([_pasajero(1)], ruc="123").status_code, 422)
        self.assertEqual(self._checkout([_pasajero(1)], email="no-es-correo").status_code, 422)
        demasiados = [_pasajero(i) for i in range(1, 62)]
        self.assertEqual(self._checkout(demasiados).status_code, 422)
        db = SessionLocal()
        try:
            self.assertEqual(db.query(Reserva).count(), 0)
            self.assertEqual(db.query(Ticket).count(), 0)
        finally:
            db.close()

    def test_checkout_reglas_de_negocio(self):
        self.assertEqual(self._checkout([_pasajero(1)], route_id=99999).status_code, 404)
        self.assertEqual(self._checkout([_pasajero(25)]).status_code, 400)
        self.assertEqual(self._checkout([_pasajero(2), _pasajero(2)]).status_code, 400)
        self.assertEqual(self._checkout([]).status_code, 400)
        db = SessionLocal()
        try:
            pasada = Route(origen="Lima", destino="Ica", fecha_salida=datetime.now() - timedelta(days=3),
                           hora_salida="08:00", duracion_horas=5, precio_base=50.0, bus_id=self.bus_id)
            db.add(pasada)
            db.commit()
            pasada_id = pasada.id
        finally:
            db.close()
        r = self._checkout([_pasajero(1)], route_id=pasada_id)
        self.assertEqual(r.status_code, 400)
        self.assertIn("salió", r.json()["detail"])

    def test_checkout_compatible_con_el_frontend_demo(self):
        # Mismo formato que envía frontend/src/pages/Checkout.jsx.
        pasajeros = [
            {"numero_asiento": 1, "tipo_documento": "DNI", "documento": "76543210", "nombres": "María José",
             "apellido_paterno": "Pérez", "apellido_materno": "", "sexo": "Femenino",
             "fecha_nacimiento": "1995-05-20", "telefono": "987 654-321"},
            {"numero_asiento": 2, "tipo_documento": "Pasaporte", "documento": "a1234567", "nombres": "John",
             "apellido_paterno": "O'Neil", "apellido_materno": "De la Cruz", "sexo": "Masculino",
             "fecha_nacimiento": None, "telefono": "+51987654321"},
            {"numero_asiento": 11, "tipo_documento": "CE", "documento": "001234567", "nombres": "Ñuñez Ángel",
             "apellido_paterno": "Quispe-Mamani", "apellido_materno": "", "sexo": "Masculino",
             "fecha_nacimiento": "2010-12-31", "telefono": "987654321"},
        ]
        r = self._checkout(pasajeros, ruc=None)
        self.assertEqual(r.status_code, 200, r.content)
        datos = r.json()
        self.assertTrue(datos["pago_simulado"])
        self.assertEqual(datos["asientos"], [1, 2, 11])
        db = SessionLocal()
        try:
            tickets = {t.numero_asiento: t for t in db.query(Ticket).filter(
                Ticket.codigo_reserva == datos["codigo_reserva"]).all()}
            self.assertEqual(tickets[1].telefono, "987654321")
            self.assertIsNone(tickets[1].apellido_materno)
            self.assertEqual(tickets[1].sexo, "FEMENINO")
            self.assertEqual(tickets[1].nombres, "María José")
            self.assertEqual(tickets[2].tipo_documento, "PASAPORTE")
            self.assertEqual(tickets[2].documento, "A1234567")
            self.assertIsNone(tickets[2].fecha_nacimiento)
            self.assertEqual(tickets[11].piso, 2)
            self.assertEqual(tickets[1].piso, 1)
        finally:
            db.close()
        # RUC vacío (casilla desmarcada) y RUC válido.
        self.assertEqual(self._checkout([_pasajero(3)], ruc="").status_code, 200)
        self.assertEqual(self._checkout([_pasajero(4)], ruc="20123456789").status_code, 200)

    def test_alta_de_bus_validada(self):
        admin = self.tokens["admin"]
        ok = llamar("POST", "/api/buses/", {"placa": "xyz-987", "modelo": "Modelo Sintetico",
                                             "capacidad_piso1": 20, "capacidad_piso2": 0}, admin)
        self.assertEqual(ok.status_code, 201, ok.content)
        self.assertEqual(ok.json()["placa"], "XYZ-987")
        self.assertEqual(ok.json()["total_asientos"], 20)
        self.assertEqual(llamar("POST", "/api/buses/", {"placa": "XYZ-987", "modelo": "Otro"}, admin).status_code, 400)
        for cuerpo in (
            {"placa": "!!", "modelo": "Modelo"},
            {"placa": "AAA-111", "modelo": "Modelo", "capacidad_piso1": 0, "capacidad_piso2": 0},
            {"placa": "AAA-112", "modelo": "Modelo", "capacidad_piso1": 500},
            {"placa": "AAA-113", "modelo": "Modelo", "capacidad_piso1": -1},
            {"placa": "AAA-114", "modelo": ""},
        ):
            self.assertEqual(llamar("POST", "/api/buses/", cuerpo, admin).status_code, 422, cuerpo)
        self.assertEqual(llamar("POST", "/api/buses/", {"placa": "CLI-001", "modelo": "Modelo"},
                                self.tokens["cliente"]).status_code, 403)

    def test_alta_de_ruta_validada(self):
        admin = self.tokens["admin"]
        fecha = (datetime.now() + timedelta(days=5)).replace(microsecond=0).isoformat()
        base = {"origen": "Lima", "destino": "Cusco", "fecha_salida": fecha, "hora_salida": "21:30",
                "duracion_horas": 20, "precio_base": 120.5, "bus_id": self.bus_id}
        r = llamar("POST", "/api/routes/", base, admin)
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(llamar("POST", "/api/routes/", {**base, "bus_id": 99999}, admin).status_code, 400)
        lejana = (datetime.now() + timedelta(days=400)).replace(microsecond=0).isoformat()
        pasada = (datetime.now() - timedelta(days=10)).replace(microsecond=0).isoformat()
        for cambio in (
            {"hora_salida": "25:00"}, {"hora_salida": "8am"}, {"precio_base": 0}, {"precio_base": -5},
            {"precio_base": 1e9}, {"duracion_horas": 0}, {"duracion_horas": 500}, {"destino": "lima"},
            {"origen": "<script>"}, {"fecha_salida": lejana}, {"fecha_salida": pasada}, {"bus_id": 0},
        ):
            self.assertEqual(llamar("POST", "/api/routes/", {**base, **cambio}, admin).status_code, 422, cambio)
        # JSON con Infinity/NaN: rechazado aunque el parser lo acepte.
        crudo = json.dumps({**base, "precio_base": float("inf")}).encode()
        self.assertEqual(llamar("POST", "/api/routes/", crudo=crudo, token=admin).status_code, 422)
        crudo = json.dumps({**base, "duracion_horas": float("nan")}).encode()
        self.assertEqual(llamar("POST", "/api/routes/", crudo=crudo, token=admin).status_code, 422)

    def test_busqueda_acota_fechas_y_parametros(self):
        # Calendario de Lima, como el backend.
        ayer2 = (hoy_lima() - timedelta(days=2)).isoformat()
        lejana = (hoy_lima() + timedelta(days=91)).isoformat()
        for fecha in (ayer2, lejana, "2026-13-01", "mañana"):
            r = llamar("GET", f"/api/routes/buscar?origen=Lima&destino=Ica&fecha={fecha}")
            self.assertEqual(r.status_code, 400, fecha)
        r = llamar("GET", f"/api/routes/buscar?origen={'L' * 81}&destino=Ica")
        self.assertEqual(r.status_code, 422)
        db = SessionLocal()
        try:
            self.assertEqual(db.query(Route).count(), 1, "una búsqueda rechazada no crea viajes")
        finally:
            db.close()

    def test_checkin_y_cancelacion_validan_entrada(self):
        vendedor = self.tokens["vendedor"]
        self.assertEqual(llamar("POST", "/api/reservas/checkin", {"ticket_id": 0, "codigo_reserva": "BC-1"},
                                vendedor).status_code, 422)
        self.assertEqual(llamar("POST", "/api/reservas/checkin", {"ticket_id": 1, "codigo_reserva": "X" * 40},
                                vendedor).status_code, 422)
        r = llamar("POST", f"/api/reservas/{'X' * 40}/cancelar", token=self.tokens["admin"])
        self.assertEqual(r.status_code, 404)


# ------------------------------------------------------ FK, índice, transacción
class IntegridadTest(BaseEndurecimiento):
    def test_fk_activas_en_sqlite(self):
        db = SessionLocal()
        try:
            self.assertEqual(db.execute(text("PRAGMA foreign_keys")).scalar(), 1)
            db.add(Ticket(route_id=99999, numero_asiento=1, estado=EstadoTicket.VENDIDO))
            with self.assertRaises(IntegrityError):
                db.commit()
            db.rollback()
            db.add(Reserva(codigo="BC-FKFK0001", subtotal=1, igv=0, total_pagado=1, cantidad_asientos=1,
                           estado="PAGADA", user_id=99999))
            with self.assertRaises(IntegrityError):
                db.commit()
            db.rollback()
        finally:
            db.close()

    def test_indice_unico_coherente_con_inventario(self):
        db = SessionLocal()
        try:
            sql = db.execute(text(
                "SELECT sql FROM sqlite_master WHERE type='index' AND name='uq_ticket_ruta_asiento'"
            )).scalar()
        finally:
            db.close()
        self.assertIn("NOT IN ('CANCELADO', 'DISPONIBLE')", sql)

    def test_indice_impide_doble_venta_directa(self):
        db = SessionLocal()
        try:
            db.add(Ticket(route_id=self.route_id, numero_asiento=1, estado=EstadoTicket.VENDIDO))
            db.commit()
            db.add(Ticket(route_id=self.route_id, numero_asiento=1, estado=EstadoTicket.USADO))
            with self.assertRaises(IntegrityError):
                db.commit()
            db.rollback()
            db.add(Ticket(route_id=self.route_id, numero_asiento=1, estado=EstadoTicket.CANCELADO))
            db.add(Ticket(route_id=self.route_id, numero_asiento=1, estado=EstadoTicket.DISPONIBLE))
            db.commit()
        finally:
            db.close()

    def test_checkout_es_atomico_ante_conflicto(self):
        # Otro proceso vendió el asiento 1 tras la comprobación previa: el
        # índice rechaza el commit y no queda ni la reserva ni el asiento 2.
        db = SessionLocal()
        try:
            db.add(Ticket(route_id=self.route_id, numero_asiento=1, estado=EstadoTicket.VENDIDO,
                          codigo_reserva="BC-AJENO001"))
            db.commit()
        finally:
            db.close()
        with patch("app.routers.sales.verificar_disponibilidad", return_value=True):
            r = self._checkout([_pasajero(2), _pasajero(1)])
        self.assertEqual(r.status_code, 409)
        db = SessionLocal()
        try:
            self.assertEqual(db.query(Reserva).count(), 0)
            self.assertEqual(db.query(Ticket).filter(Ticket.numero_asiento == 2).count(), 0)
        finally:
            db.close()

    def test_conflicto_informa_asiento_tomado(self):
        db = SessionLocal()
        try:
            db.add(Ticket(route_id=self.route_id, numero_asiento=1, estado=EstadoTicket.VENDIDO,
                          codigo_reserva="BC-AJENO002"))
            db.commit()
        finally:
            db.close()
        llamadas = {"n": 0}

        def primero_libre(db, route_id, asiento):
            llamadas["n"] += 1
            if llamadas["n"] <= 2:  # comprobación previa: aún "libre"
                return True
            from app.services.ticket_service import verificar_disponibilidad as real
            return real(db, route_id, asiento)

        with patch("app.routers.sales.verificar_disponibilidad", side_effect=primero_libre):
            r = self._checkout([_pasajero(2), _pasajero(1)])
        self.assertEqual(r.status_code, 409)
        self.assertIn("1", r.json()["detail"])

    def test_estado_de_ticket_obligatorio_en_esquema_nuevo(self):
        self.assertFalse(Ticket.__table__.c.estado.nullable)

    def test_programa_normaliza_fechas(self):
        self.assertEqual(programa._dia_iso(date(2026, 1, 2)), "2026-01-02")
        self.assertEqual(programa._dia_iso(datetime(2026, 1, 2, 8, 0)), "2026-01-02")
        self.assertEqual(programa._dia_iso("2026-01-02"), "2026-01-02")

    def test_generar_salidas_no_duplica(self):
        fecha = (datetime.now() + timedelta(days=3)).date()
        db = SessionLocal()
        try:
            # El bus ya tiene salida ese día (creada en setUp): no se agrega otra.
            self.assertEqual(programa.generar_salidas_faltantes(db, "Lima", "Ica", fecha), 0)
            self.assertEqual(programa.generar_salidas_faltantes(db, "Lima", "Cusco", fecha), 1)
            self.assertEqual(programa.generar_salidas_faltantes(db, "Lima", "Cusco", fecha), 0)
            n = db.query(Route).filter(Route.origen == "Lima", Route.destino.in_(("Ica", "Cusco"))).count()
        finally:
            db.close()
        self.assertEqual(n, 2)

    def test_sincronizar_ventana_idempotente(self):
        db = SessionLocal()
        try:
            primera = programa.sincronizar_ventana(db)
            self.assertGreater(primera, 0)
            self.assertEqual(programa.sincronizar_ventana(db), 0)
        finally:
            db.close()


class MigracionIndiceTest(unittest.TestCase):
    def setUp(self):
        self.ruta = os.path.join(directorio_temporal(), f"indice-{self._testMethodName}.db")
        if os.path.exists(self.ruta):
            os.remove(self.ruta)
        con = sqlite3.connect(self.ruta)
        con.executescript("""
            CREATE TABLE tickets (id INTEGER PRIMARY KEY, route_id INTEGER NOT NULL,
                numero_asiento INTEGER NOT NULL, estado VARCHAR(10), codigo_reserva VARCHAR);
            CREATE UNIQUE INDEX uq_ticket_ruta_asiento ON tickets (route_id, numero_asiento)
                WHERE estado != 'CANCELADO';
            INSERT INTO tickets VALUES (1, 1, 1, 'VENDIDO', 'BC-A');
            INSERT INTO tickets VALUES (2, 1, 1, 'CANCELADO', 'BC-B');
            INSERT INTO tickets VALUES (3, 1, 2, 'USADO', 'BC-C');
        """)
        con.commit()
        con.close()
        self.engine = create_engine(f"sqlite:///{self.ruta}")

    def tearDown(self):
        self.engine.dispose()

    def _filas(self):
        con = sqlite3.connect(self.ruta)
        try:
            return con.execute("select * from tickets order by id").fetchall()
        finally:
            con.close()

    def test_actualiza_predicado_sin_perder_datos(self):
        antes = self._filas()
        self.assertEqual(aplicar_migraciones(self.engine), ["uq_ticket_ruta_asiento"])
        self.assertEqual(self._filas(), antes)
        con = sqlite3.connect(self.ruta)
        try:
            sql = con.execute("select sql from sqlite_master where name='uq_ticket_ruta_asiento'").fetchone()[0]
            self.assertIn("NOT IN ('CANCELADO', 'DISPONIBLE')", sql)
            con.execute("insert into tickets values (4, 1, 1, 'DISPONIBLE', NULL)")
            with self.assertRaises(sqlite3.IntegrityError):
                con.execute("insert into tickets values (5, 1, 2, 'VENDIDO', 'BC-D')")
            self.assertEqual(con.execute("pragma integrity_check").fetchone()[0], "ok")
        finally:
            con.close()

    def test_idempotente(self):
        self.assertEqual(aplicar_migraciones(self.engine), ["uq_ticket_ruta_asiento"])
        self.assertEqual(aplicar_migraciones(self.engine), [])


# --------------------------------------------------------------------- salud
class _SesionCaida:
    def execute(self, *_a, **_k):
        raise OperationalError("SELECT 1", {}, Exception("base de datos no disponible"))

    def rollback(self):
        pass

    def close(self):
        pass


class SaludTest(unittest.TestCase):
    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)

    def test_health_ok(self):
        r = llamar("GET", "/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"status": "ok", "database": "connected"})

    def test_health_503_si_la_bd_no_responde(self):
        def db_caida():
            yield _SesionCaida()

        app.dependency_overrides[get_db] = db_caida
        r = llamar("GET", "/health")
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json()["database"], "disconnected")
        self.assertNotIn(b"no disponible", r.content)


if __name__ == "__main__":
    unittest.main()
