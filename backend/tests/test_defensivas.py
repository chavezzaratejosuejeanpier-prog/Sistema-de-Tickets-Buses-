"""Pruebas defensivas con datos sintéticos y BD SQLite temporal.

Cubre:
- JWT expirado, sin expiración o firmado con otra clave: siempre 401.
- Binding de parámetros SQL: datos inertes con comillas y metacaracteres
  (', ", ;, --, %, _, \\) se guardan y comparan literalmente, sin alterar
  otras filas ni el esquema.
- Carrera real de compra del mismo asiento con dos sesiones concurrentes:
  exactamente una compra gana y la otra recibe 409.

No modifica tests/test_endurecimiento.py; usa el mismo apoyo (tests/apoyo.py).
"""
import threading
import unittest
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from jose import jwt
from sqlalchemy import inspect

from tests.apoyo import SessionLocal, engine, llamar, reiniciar_bd, token_de

from app.core.config import settings
from app.core.security import hashear_password
from app.models.bus import Bus, BusTipo
from app.models.reserva import Reserva
from app.models.route import Route
from app.models.ticket import EstadoTicket, Ticket
from app.models.user import RolUsuario, User
from app.routers import sales as ventas

# Texto inerte con metacaracteres SQL/LIKE habituales. No es un payload: solo
# comprueba que los valores viajan como parámetros y se guardan literalmente.
NOMBRE_METACARACTERES = "Ana O'Brien \"Prueba\" ; -- 100% _x_ \\ [a]"
EMAIL_APOSTROFO = "o'brien.prueba@example.com"
CODIGO_METACARACTERES = "BC-'\";--%_"


def _pasajero(asiento, nombres="Prueba", apellido="Sintetico"):
    return {
        "numero_asiento": asiento,
        "tipo_documento": "DNI",
        "documento": f"7000000{asiento % 10}",
        "nombres": nombres,
        "apellido_paterno": apellido,
        "apellido_materno": "Ficticio",
        "sexo": "Femenino",
        "fecha_nacimiento": "1990-01-01",
        "telefono": "900000000",
    }


class _Base(unittest.TestCase):
    def setUp(self):
        reiniciar_bd()
        db = SessionLocal()
        try:
            hash_ficticio = hashear_password("clave-sintetica")
            self.usuarios = {}
            for alias in ("uno", "dos"):
                u = User(email=f"{alias}@example.com", nombre=f"Usuario {alias}",
                         hashed_password=hash_ficticio, rol=RolUsuario.CLIENTE)
                db.add(u)
                self.usuarios[alias] = u
            bus = Bus(placa="TST-DEF", modelo="Sintetico", tipo=BusTipo.ECONOMICO,
                      capacidad_piso1=10, capacidad_piso2=10, total_asientos=20)
            db.add(bus)
            db.flush()
            ruta = Route(origen="Lima", destino="Ica", fecha_salida=datetime.now() + timedelta(days=3),
                         hora_salida="08:00", duracion_horas=5, precio_base=50.0, bus_id=bus.id)
            db.add(ruta)
            db.commit()
            self.route_id = ruta.id
            self.tokens = {k: token_de(u) for k, u in self.usuarios.items()}
        finally:
            db.close()

    def _cuerpo(self, asientos=(1,), **pasajero):
        return {
            "route_id": self.route_id,
            "email": "contacto@example.com",
            "pasajeros": [_pasajero(a, **pasajero) for a in asientos],
        }


class JwtExpiradoTest(_Base):
    def _token(self, **reclamos):
        return jwt.encode(reclamos, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    def _assert_401(self, token):
        r = llamar("POST", "/api/sales/checkout", self._cuerpo(), token)
        self.assertEqual(r.status_code, 401, r.content)
        self.assertEqual(r.headers.get("www-authenticate"), "Bearer")
        # Ninguna compra se registra con un token rechazado.
        db = SessionLocal()
        try:
            self.assertEqual(db.query(Ticket).count(), 0)
        finally:
            db.close()

    def test_token_expirado_rechazado(self):
        pasado = datetime.now(timezone.utc) - timedelta(minutes=5)
        self._assert_401(self._token(sub="uno@example.com", rol="cliente",
                                     iat=pasado - timedelta(hours=1), exp=pasado))

    def test_token_sin_exp_rechazado(self):
        self._assert_401(self._token(sub="uno@example.com", rol="cliente"))

    def test_token_otra_clave_rechazado(self):
        futuro = datetime.now(timezone.utc) + timedelta(minutes=30)
        token = jwt.encode({"sub": "uno@example.com", "exp": futuro}, "otra-clave-sintetica",
                           algorithm=settings.ALGORITHM)
        self._assert_401(token)

    def test_token_vigente_aceptado(self):
        r = llamar("POST", "/api/sales/checkout", self._cuerpo(), self.tokens["uno"])
        self.assertEqual(r.status_code, 200, r.content)


class BindingParametrosSqlTest(_Base):
    def _tablas(self):
        return set(inspect(engine).get_table_names())

    def test_registro_y_login_con_metacaracteres_son_literales(self):
        tablas = self._tablas()
        r = llamar("POST", "/api/auth/register", {
            "email": EMAIL_APOSTROFO, "nombre": NOMBRE_METACARACTERES, "password": "Clave-Sintetica-9",
        })
        self.assertEqual(r.status_code, 201, r.content)
        r = llamar("POST", "/api/auth/login", {"email": EMAIL_APOSTROFO, "password": "Clave-Sintetica-9"})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["nombre"], NOMBRE_METACARACTERES)

        db = SessionLocal()
        try:
            self.assertEqual(db.query(User).count(), 3)
            guardado = db.query(User).filter(User.email == EMAIL_APOSTROFO).one()
            self.assertEqual(guardado.nombre, NOMBRE_METACARACTERES)
            # Los comodines LIKE no se interpretan en comparaciones de igualdad.
            self.assertIsNone(db.query(User).filter(User.email == "%@example.com").first())
            # Las demás cuentas siguen intactas.
            self.assertEqual(db.query(User).filter(User.email == "uno@example.com").one().nombre, "Usuario uno")
        finally:
            db.close()
        self.assertEqual(self._tablas(), tablas)

    def test_login_con_comillas_no_autentica(self):
        r = llamar("POST", "/api/auth/login", {"email": "uno'\"@example.com", "password": "clave-sintetica"})
        self.assertIn(r.status_code, (401, 422), r.content)

    def test_pasajero_con_apostrofos_se_guarda_literal(self):
        nombres, apellido = "D'Ángelo María", "O'Neill-Pérez"
        r = llamar("POST", "/api/sales/checkout", self._cuerpo((3,), nombres=nombres, apellido=apellido),
                   self.tokens["uno"])
        self.assertEqual(r.status_code, 200, r.content)
        db = SessionLocal()
        try:
            t = db.query(Ticket).filter(Ticket.route_id == self.route_id).one()
            self.assertEqual((t.nombres, t.apellido_paterno), (nombres, apellido))
        finally:
            db.close()

    def test_codigo_con_metacaracteres_no_encuentra_nada(self):
        tablas = self._tablas()
        r = llamar("POST", "/api/sales/checkout", self._cuerpo((4,)), self.tokens["uno"])
        self.assertEqual(r.status_code, 200, r.content)
        r = llamar("GET", f"/api/sales/tickets/{quote(CODIGO_METACARACTERES, safe='')}",
                   token=self.tokens["uno"])
        self.assertIn(r.status_code, (400, 404, 422), r.content)
        db = SessionLocal()
        try:
            self.assertEqual(db.query(Reserva).count(), 1)
            self.assertEqual(db.query(Ticket).count(), 1)
        finally:
            db.close()
        self.assertEqual(self._tablas(), tablas)


class CarreraMismoAsientoTest(_Base):
    ASIENTO = 7

    def _competir(self):
        resultados = {}
        inicio = threading.Barrier(2)

        def comprar(alias):
            inicio.wait(timeout=10)
            resultados[alias] = llamar("POST", "/api/sales/checkout",
                                       self._cuerpo((self.ASIENTO,)), self.tokens[alias])

        hilos = [threading.Thread(target=comprar, args=(a,)) for a in ("uno", "dos")]
        for h in hilos:
            h.start()
        for h in hilos:
            h.join(timeout=60)
            self.assertFalse(h.is_alive(), "una compra quedó bloqueada")
        return resultados

    def _verificar_un_ganador(self, resultados):
        estados = sorted(r.status_code for r in resultados.values())
        self.assertEqual(estados, [200, 409], {k: r.content for k, r in resultados.items()})
        db = SessionLocal()
        try:
            vendidos = db.query(Ticket).filter(
                Ticket.route_id == self.route_id,
                Ticket.numero_asiento == self.ASIENTO,
                Ticket.estado == EstadoTicket.VENDIDO,
            ).count()
            self.assertEqual(vendidos, 1)
            # La compra perdedora no deja una reserva huérfana.
            self.assertEqual(db.query(Reserva).count(), 1)
        finally:
            db.close()

    def test_dos_sesiones_mismo_asiento(self):
        self._verificar_un_ganador(self._competir())

    def test_ambas_pasan_la_verificacion_previa(self):
        """Fuerza que ambas sesiones vean el asiento libre antes de escribir:
        solo el índice único decide y la perdedora recibe 409."""
        original = ventas.verificar_disponibilidad
        cruce = threading.Barrier(2)
        llamadas = {"n": 0}
        candado = threading.Lock()

        def sincronizada(db, route_id, asiento):
            libre = original(db, route_id, asiento)
            with candado:
                llamadas["n"] += 1
                primera_ronda = llamadas["n"] <= 2
            if primera_ronda:
                cruce.wait(timeout=10)
            return libre

        ventas.verificar_disponibilidad = sincronizada
        try:
            resultados = self._competir()
        finally:
            ventas.verificar_disponibilidad = original
        self._verificar_un_ganador(resultados)
        perdedora = next(r for r in resultados.values() if r.status_code == 409)
        self.assertIn(str(self.ASIENTO), perdedora.json()["detail"])


if __name__ == "__main__":
    unittest.main()
