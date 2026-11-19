"""Migración idempotente de `reservas` sobre una base existente sintética."""
import os
import sqlite3
import unittest

from tests.apoyo import directorio_temporal

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session

from app.migraciones import aplicar_migraciones
from app.models.reserva import Reserva
from app.models.ticket import Ticket

ESQUEMA_PREVIO = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY, email VARCHAR NOT NULL UNIQUE, nombre VARCHAR NOT NULL,
    hashed_password VARCHAR NOT NULL, rol VARCHAR(8), is_active BOOLEAN
);
CREATE TABLE buses (
    id INTEGER PRIMARY KEY, placa VARCHAR NOT NULL UNIQUE, modelo VARCHAR NOT NULL, tipo VARCHAR(9),
    capacidad_piso1 INTEGER, capacidad_piso2 INTEGER, total_asientos INTEGER
);
CREATE TABLE routes (
    id INTEGER PRIMARY KEY, origen VARCHAR NOT NULL, destino VARCHAR NOT NULL, fecha_salida DATETIME NOT NULL,
    hora_salida VARCHAR NOT NULL, duracion_horas FLOAT, precio_base FLOAT NOT NULL, precio_vip FLOAT,
    bus_id INTEGER NOT NULL REFERENCES buses(id)
);
CREATE TABLE reservas (
    id INTEGER PRIMARY KEY, codigo VARCHAR NOT NULL, email VARCHAR, ruc VARCHAR,
    subtotal FLOAT NOT NULL, igv FLOAT NOT NULL, total_pagado FLOAT NOT NULL,
    cantidad_asientos INTEGER NOT NULL, estado VARCHAR NOT NULL, fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_reserva_estado CHECK (estado IN ('PAGADA', 'CANCELADA', 'REEMBOLSADA', 'USADA'))
);
CREATE UNIQUE INDEX ix_reservas_codigo ON reservas (codigo);
CREATE TABLE tickets (
    id INTEGER PRIMARY KEY, route_id INTEGER NOT NULL REFERENCES routes(id), numero_asiento INTEGER NOT NULL,
    piso INTEGER, tipo_documento VARCHAR, documento VARCHAR, nombres VARCHAR, apellido_paterno VARCHAR,
    apellido_materno VARCHAR, sexo VARCHAR, fecha_nacimiento DATE, telefono VARCHAR, precio_pagado FLOAT,
    estado VARCHAR(10), codigo_reserva VARCHAR, creado_en DATETIME
);
CREATE INDEX ix_tickets_codigo_reserva ON tickets (codigo_reserva);
"""

DATOS_PREVIOS = """
INSERT INTO users VALUES (1, 'cliente@example.com', 'Cliente Sintetico', 'hash-ficticio', 'CLIENTE', 1);
INSERT INTO buses VALUES (1, 'LEG-001', 'Legado', 'ECONOMICO', 10, 10, 20);
INSERT INTO routes VALUES (1, 'Lima', 'Ica', '2026-01-10 08:00:00', '08:00', 5, 50, NULL, 1);
INSERT INTO reservas VALUES (10, 'BC-LEGADO01', 'cliente@example.com', NULL, 50, 9, 59, 1, 'PAGADA', '2026-01-01 10:00:00');
INSERT INTO reservas VALUES (11, 'BC-LEGADO02', 'otro@example.com', '20123456789', 100, 18, 118, 2, 'CANCELADA', '2026-01-02 10:00:00');
INSERT INTO tickets VALUES (100, 1, 3, 1, 'DNI', '70000003', 'Legado', 'Uno', NULL, NULL, NULL, NULL, 59, 'VENDIDO', 'BC-LEGADO01', '2026-01-01 10:00:00');
INSERT INTO tickets VALUES (101, 1, 4, 1, 'DNI', '70000004', 'Legado', 'Dos', NULL, NULL, NULL, NULL, 59, 'CANCELADO', 'BC-LEGADO02', '2026-01-02 10:00:00');
INSERT INTO tickets VALUES (102, 1, 5, 1, 'DNI', '70000005', 'Legado', 'Tres', NULL, NULL, NULL, NULL, 59, 'CANCELADO', 'BC-LEGADO02', '2026-01-02 10:00:00');
"""


def _volcado(ruta):
    con = sqlite3.connect(ruta)
    try:
        return {
            "reservas": con.execute(
                "select id, codigo, email, ruc, subtotal, igv, total_pagado, cantidad_asientos, estado, fecha_emision "
                "from reservas order by id"
            ).fetchall(),
            "tickets": con.execute("select * from tickets order by id").fetchall(),
            "users": con.execute("select * from users order by id").fetchall(),
        }
    finally:
        con.close()


class MigracionReservasTest(unittest.TestCase):
    def setUp(self):
        self.ruta = os.path.join(directorio_temporal(), f"legado-{self._testMethodName}.db")
        if os.path.exists(self.ruta):
            os.remove(self.ruta)
        con = sqlite3.connect(self.ruta)
        con.executescript(ESQUEMA_PREVIO + DATOS_PREVIOS)
        con.commit()
        con.close()
        self.engine = create_engine(f"sqlite:///{self.ruta}")

    def tearDown(self):
        self.engine.dispose()

    def test_migra_sin_perder_datos_ni_reasignar(self):
        antes = _volcado(self.ruta)
        cambios = aplicar_migraciones(self.engine)
        # La base heredada no tenía el índice único de asientos: se crea.
        self.assertEqual(
            set(cambios),
            {"reservas.user_id", "reservas.metodo_pago", "ix_reservas_user_id", "uq_ticket_ruta_asiento"},
        )

        insp = inspect(self.engine)
        columnas = {c["name"] for c in insp.get_columns("reservas")}
        self.assertTrue({"user_id", "metodo_pago"} <= columnas)
        self.assertIn("ix_reservas_user_id", {i["name"] for i in insp.get_indexes("reservas")})
        fks = insp.get_foreign_keys("reservas")
        self.assertTrue(any(fk["referred_table"] == "users" and fk["constrained_columns"] == ["user_id"] for fk in fks))

        self.assertEqual(_volcado(self.ruta), antes)

        with Session(self.engine) as db:
            reservas = db.query(Reserva).order_by(Reserva.id).all()
            self.assertEqual([r.codigo for r in reservas], ["BC-LEGADO01", "BC-LEGADO02"])
            # Sin reasignación: aunque el email coincide con un usuario, no hay titular.
            self.assertTrue(all(r.user_id is None for r in reservas))
            self.assertTrue(all(r.metodo_pago is None for r in reservas))
            self.assertTrue(all(r.pago_simulado for r in reservas))
            self.assertEqual(reservas[1].estado, "CANCELADA")
            self.assertEqual(db.query(Ticket).count(), 3)

    def test_idempotente(self):
        self.assertTrue(aplicar_migraciones(self.engine))
        despues_primera = _volcado(self.ruta)
        self.assertEqual(aplicar_migraciones(self.engine), [])
        self.assertEqual(aplicar_migraciones(self.engine), [])
        self.assertEqual(_volcado(self.ruta), despues_primera)
        con = sqlite3.connect(self.ruta)
        try:
            self.assertEqual(con.execute("pragma integrity_check").fetchone()[0], "ok")
            self.assertEqual(con.execute("pragma foreign_key_check").fetchall(), [])
        finally:
            con.close()

    def test_base_sin_tabla_reservas_no_falla(self):
        vacia = os.path.join(directorio_temporal(), "vacia.db")
        engine = create_engine(f"sqlite:///{vacia}")
        try:
            self.assertEqual(aplicar_migraciones(engine), [])
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
