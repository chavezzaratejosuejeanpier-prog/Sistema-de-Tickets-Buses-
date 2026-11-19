"""Seguridad de reservas y boletos con datos sintéticos y BD temporal.

Cubre: invitados, compra autenticada y titularidad, códigos ajenos o
inexistentes, PDF, permisos admin/vendedor, cancelación y check-in.
"""
import unittest
from datetime import datetime, timedelta

from tests.apoyo import SessionLocal, llamar, reiniciar_bd, token_de

from app.core.security import hashear_password
from app.models.bus import Bus, BusTipo
from app.models.reserva import Reserva
from app.models.route import Route
from app.models.ticket import EstadoTicket, Ticket
from app.models.user import RolUsuario, User
from app.routers.sales import _datos_pdf
from app.services.boleto_pdf import contenido_qr

CAMPOS_PII = {"documento", "tipo_documento", "telefono", "sexo", "fecha_nacimiento", "nombres", "apellido_paterno", "apellido_materno", "email"}


def _pasajero(asiento, sufijo="A"):
    return {
        "numero_asiento": asiento,
        "tipo_documento": "DNI",
        "documento": f"7000000{asiento % 10}",
        "nombres": f"Prueba{sufijo}",
        "apellido_paterno": "Sintetico",
        "apellido_materno": "Ficticio",
        "sexo": "Femenino",
        "fecha_nacimiento": "1990-01-01",
        "telefono": "900000000",
    }


class SeguridadReservasTest(unittest.TestCase):
    def setUp(self):
        reiniciar_bd()
        db = SessionLocal()
        try:
            hash_ficticio = hashear_password("clave-sintetica")
            self.usuarios = {}
            for alias, rol in (
                ("cliente", RolUsuario.CLIENTE),
                ("otro", RolUsuario.CLIENTE),
                ("admin", RolUsuario.ADMIN),
                ("vendedor", RolUsuario.VENDEDOR),
            ):
                u = User(email=f"{alias}@example.com", nombre=f"Usuario {alias}", hashed_password=hash_ficticio, rol=rol)
                db.add(u)
                self.usuarios[alias] = u
            bus = Bus(placa="TST-001", modelo="Sintetico", tipo=BusTipo.ECONOMICO, capacidad_piso1=10, capacidad_piso2=10, total_asientos=20)
            db.add(bus)
            db.flush()
            ruta = Route(
                origen="Lima", destino="Ica", fecha_salida=datetime.now() + timedelta(days=3),
                hora_salida="08:00", duracion_horas=5, precio_base=50.0, bus_id=bus.id,
            )
            db.add(ruta)
            db.commit()
            self.route_id = ruta.id
            self.ids = {k: u.id for k, u in self.usuarios.items()}
            self.tokens = {k: token_de(u) for k, u in self.usuarios.items()}
        finally:
            db.close()

    # ---------------------------------------------------------------- utilidades
    def _comprar(self, alias="cliente", asientos=(1,), **extra):
        cuerpo = {
            "route_id": self.route_id,
            "email": "contacto@example.com",
            "pasajeros": [_pasajero(a) for a in asientos],
            **extra,
        }
        return llamar("POST", "/api/sales/checkout", cuerpo, self.tokens.get(alias))

    def _compra_ok(self, alias="cliente", asientos=(1,)):
        r = self._comprar(alias, asientos)
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()["codigo_reserva"]

    def _reserva(self, codigo):
        db = SessionLocal()
        try:
            return db.query(Reserva).filter(Reserva.codigo == codigo).one()
        finally:
            db.close()

    def _tickets(self, codigo):
        db = SessionLocal()
        try:
            return db.query(Ticket).filter(Ticket.codigo_reserva == codigo).order_by(Ticket.id).all()
        finally:
            db.close()

    def _crear_historica(self, codigo="BC-HIST0001", email="cliente@example.com", estado="PAGADA", con_reserva=True):
        """Reserva previa a la titularidad: user_id NULL (como tras la migración)."""
        db = SessionLocal()
        try:
            if con_reserva:
                db.add(Reserva(codigo=codigo, email=email, subtotal=50, igv=9, total_pagado=59,
                               cantidad_asientos=1, estado=estado, user_id=None, metodo_pago=None))
            db.add(Ticket(route_id=self.route_id, numero_asiento=9, piso=1, tipo_documento="DNI",
                          documento="71111111", nombres="Historico", apellido_paterno="Sintetico",
                          precio_pagado=59, estado=EstadoTicket.VENDIDO, codigo_reserva=codigo))
            db.commit()
        finally:
            db.close()
        return codigo

    def _assert_no_store(self, r):
        self.assertIn("no-store", r.headers.get("cache-control", ""))

    # ---------------------------------------------------------------- invitados
    def test_checkout_de_cuenta_y_consulta_requieren_sesion(self):
        r = self._comprar(alias=None)
        self.assertEqual(r.status_code, 401)
        db = SessionLocal()
        try:
            self.assertEqual(db.query(Reserva).count(), 0)
            self.assertEqual(db.query(Ticket).count(), 0)
        finally:
            db.close()

        codigo = self._compra_ok()
        self.assertEqual(llamar("GET", f"/api/sales/tickets/{codigo}").status_code, 401)
        self.assertEqual(llamar("GET", f"/api/sales/tickets/{codigo}/pdf").status_code, 401)

    def test_permiso_invitado_solo_pdf_temporal_y_cancelacion(self):
        from unittest.mock import patch

        cuerpo = {"route_id": self.route_id, "email": "cliente@example.com", "pasajeros": [_pasajero(1)]}
        compra = "/api/sales/checkout/invitado"
        pdf = "/api/sales/invitado/pdf"
        self.assertEqual(llamar("POST", compra, cuerpo, self.tokens["cliente"]).status_code, 400)
        r = llamar("POST", compra, cuerpo)
        self.assertEqual(r.status_code, 200)
        self._assert_no_store(r)
        codigo, permiso = r.json()["codigo_reserva"], r.json()["token_pdf"]
        self.assertIsNone(self._reserva(codigo).user_id)
        repetida = llamar("POST", compra, cuerpo)
        self.assertEqual(repetida.status_code, 409)
        self.assertNotIn("token_pdf", repetida.json())
        self.assertEqual(len(self._tickets(codigo)), 1)
        self.assertEqual(llamar("GET", "/api/sales/mis-reservas", token=self.tokens["cliente"]).json(), [])
        self.assertEqual(llamar("GET", "/api/sales/mis-reservas", token=permiso).status_code, 401)
        self.assertEqual(llamar("GET", f"/api/sales/tickets/{codigo}/pdf", token=self.tokens["cliente"]).status_code, 404)
        for credencial in (None, codigo, self.tokens["cliente"]):
            self.assertEqual(llamar("POST", pdf, token=credencial).status_code, 404)
        for _ in range(2):
            r = llamar("POST", pdf, token=permiso)
            self.assertTrue(r.content.startswith(b"%PDF"))
            self.assertIn(codigo, r.headers["content-disposition"])
            self._assert_no_store(r)
        with patch("jose.jwt.datetime") as reloj:
            reloj.utcnow.return_value = datetime.now() + timedelta(days=2)
            self.assertEqual(llamar("POST", pdf, token=permiso).status_code, 404)
        self.assertEqual(llamar("POST", f"/api/reservas/{codigo}/cancelar", token=self.tokens["admin"]).status_code, 200)
        self.assertEqual(llamar("POST", pdf, token=permiso).status_code, 409)

    def test_token_invalido_rechazado(self):
        codigo = self._compra_ok()
        r = llamar("GET", f"/api/sales/tickets/{codigo}", token="no-es-un-jwt")
        self.assertEqual(r.status_code, 401)

    # ---------------------------------------------------------- compra y titular
    def test_compra_autenticada_asigna_titular_por_id_y_etiqueta_simulacion(self):
        # El cliente intenta fijar otro titular: se ignora.
        r = self._comprar("cliente", (1, 2), user_id=self.ids["otro"], email="otro@example.com")
        self.assertEqual(r.status_code, 200, r.content)
        data = r.json()
        self.assertTrue(data["pago_simulado"])
        self.assertEqual(data["estado"], "PAGADA")
        self.assertIn("simulado", data["mensaje"].lower())
        self._assert_no_store(r)

        reserva = self._reserva(data["codigo_reserva"])
        self.assertEqual(reserva.user_id, self.ids["cliente"])
        self.assertEqual(reserva.metodo_pago, "SIMULADO")
        self.assertTrue(reserva.pago_simulado)

        # El email coincidente con otra cuenta no da acceso.
        r = llamar("GET", f"/api/sales/tickets/{data['codigo_reserva']}", token=self.tokens["otro"])
        self.assertEqual(r.status_code, 404)

    def test_titular_consulta_json_minimo_y_sin_cache(self):
        codigo = self._compra_ok(asientos=(3, 4))
        r = llamar("GET", f"/api/sales/tickets/{codigo.lower()}", token=self.tokens["cliente"])
        self.assertEqual(r.status_code, 200, r.content)
        self._assert_no_store(r)
        tickets = r.json()
        self.assertEqual(sorted(t["numero_asiento"] for t in tickets), [3, 4])
        for t in tickets:
            self.assertFalse(CAMPOS_PII & set(t), f"PII expuesta: {CAMPOS_PII & set(t)}")
            self.assertTrue(t["pago_simulado"])
            self.assertEqual(t["estado_reserva"], "PAGADA")
            self.assertEqual(t["codigo_reserva"], codigo)

    # --------------------------------------------------- códigos ajenos/inexistentes
    def test_codigo_ajeno_e_inexistente_responden_igual(self):
        codigo = self._compra_ok()
        ajeno = llamar("GET", f"/api/sales/tickets/{codigo}", token=self.tokens["otro"])
        inexistente = llamar("GET", "/api/sales/tickets/BC-NOEXISTE", token=self.tokens["otro"])
        self.assertEqual(ajeno.status_code, 404)
        self.assertEqual(inexistente.status_code, 404)
        self.assertEqual(ajeno.content, inexistente.content)
        self._assert_no_store(ajeno)
        self._assert_no_store(inexistente)

        pdf_ajeno = llamar("GET", f"/api/sales/tickets/{codigo}/pdf", token=self.tokens["otro"])
        pdf_inexistente = llamar("GET", "/api/sales/tickets/BC-NOEXISTE/pdf", token=self.tokens["otro"])
        self.assertEqual(pdf_ajeno.status_code, 404)
        self.assertEqual(pdf_ajeno.content, pdf_inexistente.content)
        self.assertEqual(pdf_ajeno.content, ajeno.content)

    def test_codigo_excesivo_responde_igual(self):
        r = llamar("GET", "/api/sales/tickets/" + "X" * 200, token=self.tokens["cliente"])
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.json()["detail"], "Reserva no encontrada")

    def test_historica_sin_titular_solo_admin(self):
        codigo = self._crear_historica(email="cliente@example.com")
        # El email de la reserva coincide con la cuenta, pero no se reasigna.
        r = llamar("GET", f"/api/sales/tickets/{codigo}", token=self.tokens["cliente"])
        self.assertEqual(r.status_code, 404)
        self.assertEqual(llamar("GET", f"/api/sales/tickets/{codigo}/pdf", token=self.tokens["cliente"]).status_code, 404)
        self.assertEqual(llamar("GET", f"/api/sales/tickets/{codigo}", token=self.tokens["vendedor"]).status_code, 404)

        r = llamar("GET", f"/api/sales/tickets/{codigo}", token=self.tokens["admin"])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()[0]["estado_reserva"], "PAGADA")
        self.assertIsNone(self._reserva(codigo).user_id)

        r = llamar("GET", f"/api/sales/tickets/{codigo}/pdf", token=self.tokens["admin"])
        self.assertEqual(r.status_code, 200)

    def test_tickets_huerfanos_solo_admin(self):
        codigo = self._crear_historica(codigo="BC-HUERFANO", con_reserva=False)
        self.assertEqual(llamar("GET", f"/api/sales/tickets/{codigo}", token=self.tokens["cliente"]).status_code, 404)
        r = llamar("GET", f"/api/sales/tickets/{codigo}", token=self.tokens["admin"])
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.json()[0]["estado_reserva"])

    # ------------------------------------------------------------------------ PDF
    def test_pdf_titular_y_admin(self):
        codigo = self._compra_ok()
        for alias in ("cliente", "admin"):
            r = llamar("GET", f"/api/sales/tickets/{codigo}/pdf", token=self.tokens[alias])
            self.assertEqual(r.status_code, 200, alias)
            self.assertEqual(r.headers["content-type"], "application/pdf")
            self.assertTrue(r.content.startswith(b"%PDF"))
            self._assert_no_store(r)
            self.assertIn("attachment", r.headers["content-disposition"])

    def test_pdf_vendedor_sin_permiso(self):
        codigo = self._compra_ok()
        r = llamar("GET", f"/api/sales/tickets/{codigo}/pdf", token=self.tokens["vendedor"])
        self.assertEqual(r.status_code, 404)
        r = llamar("GET", f"/api/sales/tickets/{codigo}", token=self.tokens["vendedor"])
        self.assertEqual(r.status_code, 404)

    def test_datos_pdf_reducen_pii(self):
        codigo = self._compra_ok()
        db = SessionLocal()
        try:
            reserva = db.query(Reserva).filter(Reserva.codigo == codigo).one()
            tickets = db.query(Ticket).filter(Ticket.codigo_reserva == codigo).all()
            for t in tickets:
                _ = t.route.bus
            datos = _datos_pdf(codigo, reserva, tickets)
        finally:
            db.close()
        self.assertNotIn("email", datos)
        self.assertTrue(datos["pago_simulado"])
        t = datos["tickets"][0]
        for campo in ("telefono", "sexo", "fecha_nacimiento", "tipo_documento"):
            self.assertNotIn(campo, t)
        self.assertNotIn("70000001", t["documento"])
        self.assertTrue(t["documento"].endswith("001"))
        self.assertIn("*", t["documento"])

    def test_qr_es_localizador_sin_enlace_ni_pii(self):
        codigo = self._compra_ok()
        ticket = self._tickets(codigo)[0]
        contenido = contenido_qr(codigo, ticket.id)
        self.assertEqual(contenido, f"LUX-CHECKIN|RESERVA={codigo}|TICKET={ticket.id}")
        self.assertNotIn("http", contenido.lower())
        self.assertNotIn("://", contenido)
        for dato in (ticket.documento, ticket.nombres, ticket.apellido_paterno, ticket.telefono, "@"):
            self.assertNotIn(dato, contenido)
        # El localizador contiene lo necesario para el check-in del staff.
        partes = dict(p.split("=", 1) for p in contenido.split("|")[1:])
        r = llamar("POST", "/api/reservas/checkin",
                   {"ticket_id": int(partes["TICKET"]), "codigo_reserva": partes["RESERVA"]}, self.tokens["vendedor"])
        self.assertEqual(r.status_code, 200)

    def test_pdf_bloqueado_tras_cancelacion(self):
        codigo = self._compra_ok()
        self.assertEqual(llamar("POST", f"/api/reservas/{codigo}/cancelar", token=self.tokens["admin"]).status_code, 200)
        for alias in ("cliente", "admin"):
            r = llamar("GET", f"/api/sales/tickets/{codigo}/pdf", token=self.tokens[alias])
            self.assertEqual(r.status_code, 409, alias)
            self._assert_no_store(r)
        # El titular sigue viendo el estado de su reserva.
        r = llamar("GET", f"/api/sales/tickets/{codigo}", token=self.tokens["cliente"])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()[0]["estado"], "CANCELADO")
        self.assertEqual(r.json()[0]["estado_reserva"], "CANCELADA")
        # Ajeno: sigue siendo 404 uniforme, sin revelar el estado.
        self.assertEqual(llamar("GET", f"/api/sales/tickets/{codigo}/pdf", token=self.tokens["otro"]).status_code, 404)

    # ------------------------------------------------------- admin / vendedor
    def test_listado_y_cancelacion_solo_admin(self):
        codigo = self._compra_ok()
        for alias in ("cliente", "vendedor"):
            self.assertEqual(llamar("GET", "/api/reservas/", token=self.tokens[alias]).status_code, 403)
            self.assertEqual(llamar("POST", f"/api/reservas/{codigo}/cancelar", token=self.tokens[alias]).status_code, 403)
        self.assertEqual(llamar("POST", f"/api/reservas/{codigo}/cancelar").status_code, 401)
        r = llamar("GET", "/api/reservas/", token=self.tokens["admin"])
        self.assertEqual(r.status_code, 200)
        self._assert_no_store(r)
        self.assertEqual(r.json()[0]["user_id"], self.ids["cliente"])
        self.assertEqual(self._reserva(codigo).estado, "PAGADA")

    def test_resumen_ventas_solo_admin(self):
        self.assertEqual(llamar("GET", "/api/sales/", token=self.tokens["vendedor"]).status_code, 403)
        self.assertEqual(llamar("GET", "/api/sales/", token=self.tokens["admin"]).status_code, 200)

    # ------------------------------------------------------------- cancelación
    def test_cancelacion_libera_asientos_y_es_idempotente(self):
        codigo = self._compra_ok(asientos=(5, 6))
        r = llamar("POST", f"/api/reservas/{codigo}/cancelar", token=self.tokens["admin"])
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["tickets_cancelados"], 2)
        self.assertEqual(self._reserva(codigo).estado, "CANCELADA")
        self.assertTrue(all(t.estado == EstadoTicket.CANCELADO for t in self._tickets(codigo)))

        r = llamar("POST", f"/api/reservas/{codigo}/cancelar", token=self.tokens["admin"])
        self.assertEqual(r.status_code, 400)
        # Asiento liberado: otro cliente puede comprarlo.
        self._compra_ok("otro", (5,))

    def test_cancelacion_inexistente(self):
        r = llamar("POST", "/api/reservas/BC-NOEXISTE/cancelar", token=self.tokens["admin"])
        self.assertEqual(r.status_code, 404)

    def test_cancelacion_rechazada_con_checkin(self):
        codigo = self._compra_ok(asientos=(1, 2))
        ticket = self._tickets(codigo)[0]
        r = llamar("POST", "/api/reservas/checkin", {"ticket_id": ticket.id, "codigo_reserva": codigo}, self.tokens["vendedor"])
        self.assertEqual(r.status_code, 200)
        r = llamar("POST", f"/api/reservas/{codigo}/cancelar", token=self.tokens["admin"])
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self._reserva(codigo).estado, "PAGADA")

    def test_cancelacion_rechaza_estado_inconsistente(self):
        codigo = self._compra_ok(asientos=(1, 2))
        db = SessionLocal()
        try:
            t = db.query(Ticket).filter(Ticket.codigo_reserva == codigo).order_by(Ticket.id).first()
            t.estado = EstadoTicket.CANCELADO
            db.commit()
        finally:
            db.close()
        r = llamar("POST", f"/api/reservas/{codigo}/cancelar", token=self.tokens["admin"])
        self.assertEqual(r.status_code, 409)
        self.assertEqual(self._reserva(codigo).estado, "PAGADA")

    def test_cancelacion_rechaza_reserva_usada(self):
        codigo = self._compra_ok()
        ticket = self._tickets(codigo)[0]
        llamar("POST", "/api/reservas/checkin", {"ticket_id": ticket.id, "codigo_reserva": codigo}, self.tokens["vendedor"])
        self.assertEqual(self._reserva(codigo).estado, "USADA")
        r = llamar("POST", f"/api/reservas/{codigo}/cancelar", token=self.tokens["admin"])
        self.assertEqual(r.status_code, 400)

    # ----------------------------------------------------------------- check-in
    def test_checkin_permisos(self):
        codigo = self._compra_ok()
        ticket = self._tickets(codigo)[0]
        cuerpo = {"ticket_id": ticket.id, "codigo_reserva": codigo}
        self.assertEqual(llamar("POST", "/api/reservas/checkin", cuerpo).status_code, 401)
        self.assertEqual(llamar("POST", "/api/reservas/checkin", cuerpo, self.tokens["cliente"]).status_code, 403)
        self.assertEqual(llamar("POST", "/api/reservas/checkin", cuerpo, self.tokens["admin"]).status_code, 200)

    def test_checkin_transiciones(self):
        codigo = self._compra_ok(asientos=(1, 2))
        t1, t2 = self._tickets(codigo)
        r = llamar("POST", "/api/reservas/checkin", {"ticket_id": t1.id, "codigo_reserva": codigo.lower()}, self.tokens["vendedor"])
        self.assertEqual(r.status_code, 200, r.content)
        self._assert_no_store(r)
        self.assertEqual(r.json()["estado"], "USADO")
        self.assertEqual(self._reserva(codigo).estado, "PAGADA")

        r = llamar("POST", "/api/reservas/checkin", {"ticket_id": t1.id, "codigo_reserva": codigo}, self.tokens["vendedor"])
        self.assertEqual(r.status_code, 400)

        r = llamar("POST", "/api/reservas/checkin", {"ticket_id": t2.id, "codigo_reserva": "BC-OTRA0000"}, self.tokens["vendedor"])
        self.assertEqual(r.status_code, 400)

        r = llamar("POST", "/api/reservas/checkin", {"ticket_id": t2.id, "codigo_reserva": codigo}, self.tokens["vendedor"])
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self._reserva(codigo).estado, "USADA")
        self.assertTrue(all(t.estado == EstadoTicket.USADO for t in self._tickets(codigo)))

        # PDF de una reserva usada sigue disponible para el titular.
        self.assertEqual(llamar("GET", f"/api/sales/tickets/{codigo}/pdf", token=self.tokens["cliente"]).status_code, 200)

    def test_checkin_ticket_inexistente(self):
        r = llamar("POST", "/api/reservas/checkin", {"ticket_id": 99999, "codigo_reserva": "BC-X"}, self.tokens["vendedor"])
        self.assertEqual(r.status_code, 404)

    def test_checkin_rechaza_cancelada(self):
        codigo = self._compra_ok()
        ticket = self._tickets(codigo)[0]
        llamar("POST", f"/api/reservas/{codigo}/cancelar", token=self.tokens["admin"])
        r = llamar("POST", "/api/reservas/checkin", {"ticket_id": ticket.id, "codigo_reserva": codigo}, self.tokens["vendedor"])
        self.assertEqual(r.status_code, 400)

    def test_checkin_rechaza_reserva_no_vigente_inconsistente(self):
        codigo = self._compra_ok()
        db = SessionLocal()
        try:
            db.query(Reserva).filter(Reserva.codigo == codigo).one().estado = "CANCELADA"
            db.commit()
        finally:
            db.close()
        ticket = self._tickets(codigo)[0]
        self.assertEqual(ticket.estado, EstadoTicket.VENDIDO)
        r = llamar("POST", "/api/reservas/checkin", {"ticket_id": ticket.id, "codigo_reserva": codigo}, self.tokens["vendedor"])
        self.assertEqual(r.status_code, 409)
        self.assertEqual(self._tickets(codigo)[0].estado, EstadoTicket.VENDIDO)

    def test_checkin_historico_sin_reserva_se_conserva(self):
        codigo = self._crear_historica(codigo="BC-HUERF002", con_reserva=False)
        ticket = self._tickets(codigo)[0]
        r = llamar("POST", "/api/reservas/checkin", {"ticket_id": ticket.id, "codigo_reserva": codigo}, self.tokens["vendedor"])
        self.assertEqual(r.status_code, 200)


if __name__ == "__main__":
    unittest.main()
