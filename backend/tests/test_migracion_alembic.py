"""Migración explícita y versionada (Alembic) sobre SQLite temporal.

Cubre: base vacía → esquema idéntico al de los modelos, idempotencia,
adopción de bases anteriores sin versión, reversión completa (incluido el
DDL) ante asientos duplicados, la API no ejecuta DDL al importarse y no
arranca con el esquema pendiente, y el comando `migrar.py --estado`.
Solo datos sintéticos.
"""
import asyncio
import io
import os
import sqlite3
import subprocess
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from tests.apoyo import directorio_temporal

from sqlalchemy import create_engine, inspect

import migrar as comando_migrar
from app import esquema, main, migraciones
from app.database import Base
from app.migraciones import MigracionFallida

BACKEND = Path(__file__).resolve().parents[1]


def firma_esquema(engine) -> dict:
    """Descripción comparable del esquema reflejado (tablas de los modelos)."""
    insp = inspect(engine)
    firma = {}
    for tabla in sorted(Base.metadata.tables):
        if not insp.has_table(tabla):
            firma[tabla] = None
            continue
        indices = []
        for ix in insp.get_indexes(tabla):
            opciones = {k: str(v) for k, v in (ix.get("dialect_options") or {}).items()}
            indices.append((ix["name"], tuple(ix["column_names"]), bool(ix["unique"]), tuple(sorted(opciones.items()))))
        firma[tabla] = {
            "columnas": [
                (c["name"], str(c["type"]).upper(), bool(c["nullable"])) for c in insp.get_columns(tabla)
            ],
            "pk": tuple(insp.get_pk_constraint(tabla)["constrained_columns"]),
            "fks": sorted(
                (tuple(f["constrained_columns"]), f["referred_table"], tuple(f["referred_columns"]))
                for f in insp.get_foreign_keys(tabla)
            ),
            "indices": sorted(indices),
            "unicos": sorted(tuple(u["column_names"]) for u in insp.get_unique_constraints(tabla)),
            "checks": sorted(c["name"] or "" for c in insp.get_check_constraints(tabla)),
        }
    return firma


_LEGADO = """
CREATE TABLE buses (id INTEGER PRIMARY KEY, placa VARCHAR NOT NULL UNIQUE, modelo VARCHAR NOT NULL,
    tipo VARCHAR(9), capacidad_piso1 INTEGER, capacidad_piso2 INTEGER, total_asientos INTEGER);
CREATE TABLE routes (id INTEGER PRIMARY KEY, origen VARCHAR NOT NULL, destino VARCHAR NOT NULL,
    fecha_salida DATETIME NOT NULL, hora_salida VARCHAR NOT NULL, duracion_horas FLOAT,
    precio_base FLOAT NOT NULL, precio_vip FLOAT, bus_id INTEGER NOT NULL REFERENCES buses(id));
CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR NOT NULL, nombre VARCHAR NOT NULL,
    hashed_password VARCHAR NOT NULL, rol VARCHAR(8), is_active BOOLEAN);
CREATE TABLE reservas (id INTEGER PRIMARY KEY, codigo VARCHAR NOT NULL, email VARCHAR,
    subtotal FLOAT NOT NULL, igv FLOAT NOT NULL, total_pagado FLOAT NOT NULL,
    cantidad_asientos INTEGER NOT NULL, estado VARCHAR NOT NULL, fecha_emision DATETIME);
CREATE TABLE tickets (id INTEGER PRIMARY KEY, route_id INTEGER NOT NULL REFERENCES routes(id),
    numero_asiento INTEGER NOT NULL, piso INTEGER, tipo_documento VARCHAR, documento VARCHAR,
    nombres VARCHAR, apellido_paterno VARCHAR, apellido_materno VARCHAR, sexo VARCHAR,
    fecha_nacimiento DATE, telefono VARCHAR, precio_pagado FLOAT, estado VARCHAR(10) NOT NULL,
    codigo_reserva VARCHAR, creado_en DATETIME);
INSERT INTO buses VALUES (1, 'LEG-001', 'Sintetico', 'ECONOMICO', 10, 10, 20);
INSERT INTO routes VALUES (1, 'Lima', 'Ica', '2030-01-10 08:00:00', '08:00', 4, 40, NULL, 1);
INSERT INTO reservas VALUES (1, 'BC-LEGADO1', 'legado@example.com', 40, 7.2, 47.2, 1, 'CANCELADA', NULL);
INSERT INTO reservas VALUES (2, 'BC-LEGADO2', 'legado@example.com', 40, 7.2, 47.2, 1, 'PAGADA', NULL);
INSERT INTO tickets VALUES (1, 1, 1, 1, 'DNI', '70000001', 'Prueba', 'Sintetico', NULL, NULL, NULL, NULL,
    47.2, 'CANCELADO', 'BC-LEGADO1', NULL);
INSERT INTO tickets VALUES (2, 1, 1, 1, 'DNI', '70000002', 'Prueba', 'Sintetico', NULL, NULL, NULL, NULL,
    47.2, 'VENDIDO', 'BC-LEGADO2', NULL);
"""


class _ConArchivo(unittest.TestCase):
    def _ruta(self, nombre: str) -> str:
        ruta = os.path.join(directorio_temporal(), f"alembic-{self._testMethodName}-{nombre}.db")
        if os.path.exists(ruta):
            os.remove(ruta)
        return ruta

    def _engine(self, ruta: str):
        engine = create_engine(f"sqlite:///{ruta}")
        self.addCleanup(engine.dispose)
        return engine


class MigracionBaseVaciaTest(_ConArchivo):
    def test_crea_esquema_identico_a_los_modelos_y_es_idempotente(self):
        ruta = self._ruta("migrada")
        antes, despues = esquema.migrar(f"sqlite:///{ruta}")
        self.assertIsNone(antes)
        self.assertEqual(despues, esquema.revision_head())

        referencia = self._engine(self._ruta("modelos"))
        Base.metadata.create_all(bind=referencia)
        migrada = self._engine(ruta)
        self.assertEqual(firma_esquema(migrada), firma_esquema(referencia))

        self.assertEqual(esquema.migrar(f"sqlite:///{ruta}"), (despues, despues))

    def test_indice_parcial_de_asientos_y_fk_activas(self):
        ruta = self._ruta("indice")
        esquema.migrar(f"sqlite:///{ruta}")
        con = sqlite3.connect(ruta)
        try:
            sql = con.execute("SELECT sql FROM sqlite_master WHERE name='uq_ticket_ruta_asiento'").fetchone()[0]
        finally:
            con.close()
        self.assertIn("NOT IN ('CANCELADO', 'DISPONIBLE')", sql)

    def test_verificacion_y_estado(self):
        ruta = self._ruta("estado")
        engine = self._engine(ruta)
        with self.assertRaises(esquema.EsquemaDesactualizado) as ctx:
            esquema.verificar_esquema(engine)
        self.assertIn("migrar.py", str(ctx.exception))
        self.assertFalse(esquema.estado(engine)["al_dia"])
        esquema.migrar(engine)
        self.assertEqual(esquema.verificar_esquema(engine), esquema.revision_head())
        self.assertTrue(esquema.estado(engine)["al_dia"])


class AdopcionLegadoTest(_ConArchivo):
    def _legado(self, sql_extra: str = "") -> str:
        ruta = self._ruta("legado")
        con = sqlite3.connect(ruta)
        con.executescript(_LEGADO + sql_extra)
        con.commit()
        con.close()
        return ruta

    def test_adopta_base_sin_version_sin_perder_datos(self):
        ruta = self._legado()
        antes, despues = esquema.migrar(f"sqlite:///{ruta}")
        self.assertIsNone(antes)
        self.assertEqual(despues, esquema.revision_head())
        engine = self._engine(ruta)
        columnas = {c["name"] for c in inspect(engine).get_columns("reservas")}
        self.assertTrue({"ruc", "user_id", "metodo_pago"} <= columnas)
        con = sqlite3.connect(ruta)
        try:
            self.assertEqual(con.execute("SELECT count(*) FROM tickets").fetchone()[0], 2)
            self.assertEqual(
                con.execute("SELECT codigo, estado, user_id FROM reservas ORDER BY id").fetchall(),
                [("BC-LEGADO1", "CANCELADA", None), ("BC-LEGADO2", "PAGADA", None)],
            )
            # El asiento cancelado no bloquea; el vendido sí.
            with self.assertRaises(sqlite3.IntegrityError):
                con.execute("INSERT INTO tickets (route_id, numero_asiento, estado) VALUES (1, 1, 'VENDIDO')")
        finally:
            con.close()
        self.assertEqual(esquema.migrar(f"sqlite:///{ruta}"), (despues, despues))

    def test_duplicados_revierten_toda_la_migracion_incluido_el_ddl(self):
        ruta = self._legado(
            "INSERT INTO tickets VALUES (3, 1, 1, 1, 'DNI', '70000003', 'Prueba', 'Sintetico', NULL, NULL, "
            "NULL, NULL, 47.2, 'USADO', 'BC-LEGADO3', NULL);"
        )
        with self.assertRaises(MigracionFallida) as ctx:
            esquema.migrar(f"sqlite:///{ruta}")
        self.assertNotIn("70000003", str(ctx.exception))
        engine = self._engine(ruta)
        insp = inspect(engine)
        self.assertFalse(insp.has_table("alembic_version"))
        columnas = {c["name"] for c in insp.get_columns("reservas")}
        self.assertNotIn("ruc", columnas, "ALTER TABLE revertido")
        self.assertNotIn("uq_ticket_ruta_asiento", {i["name"] for i in insp.get_indexes("tickets")})
        con = sqlite3.connect(ruta)
        try:
            self.assertEqual(con.execute("SELECT count(*) FROM tickets").fetchone()[0], 3)
        finally:
            con.close()


class ApiSinDDLTest(_ConArchivo):
    def test_importar_la_api_no_crea_tablas(self):
        ruta = self._ruta("import")
        entorno = {
            **os.environ,
            "DATABASE_URL": f"sqlite:///{ruta}",
            "SECRET_KEY": "clave-sintetica-solo-para-pruebas-de-import",
            "ENTORNO": "pruebas",
            "SERVIR_FRONTEND": "false",
        }
        resultado = subprocess.run(
            [sys.executable, "-c", "import app.main"],
            cwd=BACKEND, env=entorno, capture_output=True, text=True, timeout=120,
        )
        self.assertEqual(resultado.returncode, 0, resultado.stderr[-2000:])
        if os.path.exists(ruta):
            con = sqlite3.connect(ruta)
            try:
                tablas = con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            finally:
                con.close()
            self.assertEqual(tablas, [])

    def _arrancar(self, engine):
        async def ciclo():
            async with main.lifespan(main.app):
                pass

        with patch.object(main, "engine", engine), \
             patch.object(main, "configurar_registro"), \
             patch.object(main.settings, "PROGRAMA_DEMO_AL_ARRANCAR", False):
            asyncio.run(ciclo())

    def test_no_arranca_con_esquema_pendiente(self):
        engine = self._engine(self._ruta("pendiente"))
        Base.metadata.create_all(bind=engine)  # tablas sin versión de Alembic
        with self.assertRaises(esquema.EsquemaDesactualizado):
            self._arrancar(engine)
        self.assertFalse(inspect(engine).has_table("alembic_version"), "el arranque no migra")

    def test_arranca_con_esquema_al_dia(self):
        engine = self._engine(self._ruta("al-dia"))
        esquema.migrar(engine)
        self._arrancar(engine)


class PredicadoPostgresTest(unittest.TestCase):
    def test_formas_normalizadas_por_postgresql(self):
        correctos = (
            "(estado <> ALL (ARRAY['CANCELADO'::estadoticket, 'DISPONIBLE'::estadoticket]))",
            "(estado <> ALL ('{CANCELADO,DISPONIBLE}'::estadoticket[]))",
            "((estado)::text <> ALL ((ARRAY['CANCELADO'::character varying, 'DISPONIBLE'::character varying])::text[]))",
            "estado NOT IN ('CANCELADO', 'DISPONIBLE')",
        )
        for predicado in correctos:
            self.assertTrue(migraciones.predicado_pg_correcto(predicado), predicado)
        incorrectos = (
            None,
            "((estado)::text <> 'CANCELADO'::text)",
            "(estado = ANY ('{CANCELADO,DISPONIBLE}'::estadoticket[]))",
            "(estado <> ALL ('{CANCELADO,DISPONIBLE,VENDIDO}'::estadoticket[]))",
        )
        for predicado in incorrectos:
            self.assertFalse(migraciones.predicado_pg_correcto(predicado), predicado)


class ComandoMigrarTest(_ConArchivo):
    def _main(self, engine, argv):
        salida = io.StringIO()
        with patch.object(comando_migrar, "engine", engine), \
             patch.object(comando_migrar, "migrar", lambda: esquema.migrar(engine)), \
             redirect_stdout(salida):
            return comando_migrar.main(argv), salida.getvalue()

    def test_estado_y_aplicacion(self):
        ruta = self._ruta("cli")
        engine = self._engine(ruta)
        codigo, salida = self._main(engine, ["--estado"])
        self.assertEqual(codigo, comando_migrar.CODIGO_PENDIENTE)
        self.assertIn("pendientes", salida)
        codigo, salida = self._main(engine, [])
        self.assertEqual(codigo, 0, salida)
        self.assertIn("actualizado", salida)
        self.assertNotIn(ruta, salida, "no imprime la URL de la base")
        codigo, salida = self._main(engine, ["--estado"])
        self.assertEqual(codigo, 0)
        codigo, salida = self._main(engine, [])
        self.assertIn("Sin cambios", salida)


if __name__ == "__main__":
    unittest.main()
