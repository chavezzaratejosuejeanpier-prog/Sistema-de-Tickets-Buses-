"""Adopción estricta de esquemas heredados y validación de configuración.

Cubre: rechazo atómico de esquemas no reconocidos o con restricciones que
impiden vender varios asientos o revender; índice parcial con predicado
exacto (SQLite y PostgreSQL, incluida validez); CORS, destino efectivo de
PostgreSQL, proxies acotados y programa demo en produccion. Solo SQLite
temporal y datos sintéticos (sin red ni bases existentes).
"""
import os
import sqlite3
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from tests.apoyo import directorio_temporal

from sqlalchemy import inspect

from app import esquema, migraciones
from app.core.config import ConfiguracionInvalida, cargar_settings
from app.migraciones import MigracionFallida

from tests import test_migracion_alembic as _alembic

# Se importa el módulo (no sus clases) para no ejecutar sus pruebas dos veces.
_LEGADO = _alembic._LEGADO

CLAVE = "clave-sintetica-de-produccion-para-pruebas-0001"
URL_PG = "postgresql://usuario_sintetico:ContraseniaSinteticaBD123@ep-sintetico.example.neon.tech/buss"


def _ajustes(**valores):
    entorno = valores.pop("_entorno", {})
    with patch.dict(os.environ, entorno, clear=True):
        return cargar_settings(SECRET_KEY=CLAVE, _env_file=None, **valores)


def _produccion(**valores):
    base = {"ENTORNO": "produccion", "DATABASE_URL": f"{URL_PG}?sslmode=require",
            "HOSTS_PERMITIDOS": "buss.example.com"}
    base.update(valores)
    return _ajustes(**base)


# ----------------------------------------------------------------- esquema
class AdopcionEstrictaTest(unittest.TestCase):
    def _base(self, script: str) -> str:
        ruta = os.path.join(directorio_temporal(), f"adopcion-{self._testMethodName}.db")
        if os.path.exists(ruta):
            os.remove(ruta)
        con = sqlite3.connect(ruta)
        con.executescript(script)
        con.commit()
        con.close()
        return ruta

    def _sin_cambios(self, ruta: str, volcado_previo):
        con = sqlite3.connect(ruta)
        try:
            tablas = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            self.assertNotIn("alembic_version", tablas, "la revisión no se selló")
            self.assertEqual(con.execute("SELECT sql FROM sqlite_master ORDER BY name").fetchall(), volcado_previo)
        finally:
            con.close()

    def _volcado(self, ruta):
        con = sqlite3.connect(ruta)
        try:
            return con.execute("SELECT sql FROM sqlite_master ORDER BY name").fetchall()
        finally:
            con.close()

    def _rechaza(self, script: str):
        ruta = self._base(script)
        previo = self._volcado(ruta)
        with self.assertRaises(MigracionFallida) as ctx:
            esquema.migrar(f"sqlite:///{ruta}")
        self.assertNotIn("70000002", str(ctx.exception))
        self._sin_cambios(ruta, previo)
        return ruta

    def test_rechaza_buses_sin_placa_ni_modelo(self):
        script = _LEGADO.replace(
            "CREATE TABLE buses (id INTEGER PRIMARY KEY, placa VARCHAR NOT NULL UNIQUE, modelo VARCHAR NOT NULL,\n"
            "    tipo VARCHAR(9), capacidad_piso1 INTEGER, capacidad_piso2 INTEGER, total_asientos INTEGER);",
            "CREATE TABLE buses (id INTEGER PRIMARY KEY);",
        ).replace("INSERT INTO buses VALUES (1, 'LEG-001', 'Sintetico', 'ECONOMICO', 10, 10, 20);",
                  "INSERT INTO buses VALUES (1);")
        self.assertIn("CREATE TABLE buses (id INTEGER PRIMARY KEY);", script)
        self._rechaza(script)

    def test_rechaza_unique_codigo_reserva_y_unique_total_de_asiento(self):
        for extra in (
            "CREATE UNIQUE INDEX legado_codigo ON tickets (codigo_reserva);",
            "CREATE UNIQUE INDEX legado_asiento ON tickets (route_id, numero_asiento, estado);",
        ):
            with self.subTest(extra=extra):
                ruta = self._rechaza(_LEGADO.replace("VALUES (2, 1, 1,", "VALUES (2, 1, 2,") + extra)
                con = sqlite3.connect(ruta)
                try:
                    self.assertEqual(con.execute("SELECT count(*) FROM tickets").fetchone()[0], 2)
                finally:
                    con.close()

    def test_rechaza_fk_y_columna_obligatoria_desconocidas(self):
        self._rechaza(_LEGADO + "ALTER TABLE tickets ADD COLUMN otra INTEGER REFERENCES users(id);")
        self._rechaza(_LEGADO.replace("codigo_reserva VARCHAR, creado_en DATETIME);",
                                      "codigo_reserva VARCHAR, creado_en DATETIME, extra VARCHAR NOT NULL);")
                      .replace("'BC-LEGADO1', NULL);", "'BC-LEGADO1', NULL, 'x');")
                      .replace("'BC-LEGADO2', NULL);", "'BC-LEGADO2', NULL, 'x');"))

    def test_reemplaza_predicado_invertido_en_sqlite(self):
        ruta = self._base(
            _LEGADO + "CREATE UNIQUE INDEX uq_ticket_ruta_asiento ON tickets (route_id, numero_asiento) "
            "WHERE NOT (estado NOT IN ('CANCELADO', 'DISPONIBLE'));"
        )
        esquema.migrar(f"sqlite:///{ruta}")
        con = sqlite3.connect(ruta)
        try:
            sql = con.execute("SELECT sql FROM sqlite_master WHERE name='uq_ticket_ruta_asiento'").fetchone()[0]
            self.assertNotIn("NOT (", sql)
            with self.assertRaises(sqlite3.IntegrityError):
                con.execute("INSERT INTO tickets (route_id, numero_asiento, estado) VALUES (1, 1, 'VENDIDO')")
        finally:
            con.close()

    def test_indice_correcto_no_se_recrea(self):
        ruta = self._base(_LEGADO)
        esquema.migrar(f"sqlite:///{ruta}")
        con = sqlite3.connect(ruta)
        try:
            con.execute("DELETE FROM alembic_version")
            con.commit()
            antes = con.execute("SELECT rootpage FROM sqlite_master WHERE name='uq_ticket_ruta_asiento'").fetchone()
        finally:
            con.close()
        esquema.migrar(f"sqlite:///{ruta}")
        con = sqlite3.connect(ruta)
        try:
            despues = con.execute("SELECT rootpage FROM sqlite_master WHERE name='uq_ticket_ruta_asiento'").fetchone()
        finally:
            con.close()
        self.assertEqual(antes, despues)

    def test_crea_unicos_esenciales_que_faltan(self):
        ruta = self._base(_LEGADO)
        esquema.migrar(f"sqlite:///{ruta}")
        from sqlalchemy import create_engine

        engine = create_engine(f"sqlite:///{ruta}")
        self.addCleanup(engine.dispose)
        unicos = {i["name"] for i in inspect(engine).get_indexes("users") if i["unique"]}
        self.assertIn("uq_users_email", unicos)


class PredicadoPostgresExactoTest(unittest.TestCase):
    def test_rechaza_predicados_invertidos_o_ampliados(self):
        for predicado in (
            "(NOT (estado <> ALL (ARRAY['CANCELADO'::estadoticket, 'DISPONIBLE'::estadoticket])))",
            "((estado <> ALL ('{CANCELADO,DISPONIBLE}'::estadoticket[])) IS FALSE)",
            "((estado <> ALL ('{CANCELADO,DISPONIBLE}'::estadoticket[])) OR true)",
            "((estado <> ALL ('{CANCELADO,DISPONIBLE}'::estadoticket[])) AND (route_id > 0))",
            "(otro <> ALL ('{CANCELADO,DISPONIBLE}'::estadoticket[]))",
            "(estado <> ALL ('{cancelado,disponible}'::estadoticket[]))",
        ):
            self.assertFalse(migraciones.predicado_pg_correcto(predicado), predicado)

    def test_indice_invalido_se_considera_desactualizado(self):
        predicado = "(estado <> ALL ('{CANCELADO,DISPONIBLE}'::estadoticket[]))"
        for valido, esperado in ((False, "desactualizado"), (True, "ok")):
            fila = (valido, predicado, ["route_id", "numero_asiento"])
            con = SimpleNamespace(execute=lambda *_a, **_k: SimpleNamespace(fetchone=lambda: fila))
            self.assertEqual(migraciones._estado_indice_postgresql(con), esperado)


# ------------------------------------------------------------ configuración
class ConfiguracionEndurecidaTest(unittest.TestCase):
    def _error(self, **valores) -> str:
        with self.assertRaises(ConfiguracionInvalida) as ctx:
            _produccion(**valores)
        return str(ctx.exception)

    def test_cors_invalidos_sin_excepciones_ni_eco(self):
        for origen in (
            "*", "https://*.example.com", "https://usuario:clave@a.example.com", "https://a.example.com:99999",
            "https://a.example.com:0", "https://a.example.com:abc", "https://[::1", "null",
            "https://a.example.com?x=1", "https://a.example.com/#f", "ftp://a.example.com",
        ):
            with self.subTest(origen=origen):
                with self.assertRaises(ConfiguracionInvalida) as ctx:
                    _ajustes(CORS_ORIGENES=origen)
                self.assertIn("CORS_ORIGENES", str(ctx.exception))
                self.assertNotIn("clave@", str(ctx.exception))
        ajustes = _ajustes(CORS_ORIGENES="HTTPS://App.Example.com:443/,http://127.0.0.1:5173,https://[::1]:8443")
        self.assertEqual(ajustes.cors_origenes,
                         ["https://app.example.com", "http://127.0.0.1:5173", "https://[::1]:8443"])

    def test_destino_efectivo_postgres_exige_tls(self):
        for url in (
            "postgresql:///universidad?host=db.example&sslmode=disable",
            "postgresql://u:p@localhost/buss?hostaddr=203.0.113.10",
            "postgresql://u:p@localhost/buss?host=localhost,db.example",
            "postgresql://u:p@localhost/buss?service=remoto",
        ):
            with self.subTest(url=url):
                self.assertIn("sslmode", self._error(DATABASE_URL=url))
        self.assertIn("sslmode", self._error(DATABASE_URL="postgresql:///buss",
                                             _entorno={"PGHOST": "db.example"}))
        self.assertIn("sslmode", self._error(DATABASE_URL="postgresql://u:p@localhost/buss",
                                             _entorno={"PGHOSTADDR": "203.0.113.10"}))
        self.assertIn("repetidos", self._error(DATABASE_URL=f"{URL_PG}?sslmode=require&sslmode=disable"))
        self.assertIn("repetidos", self._error(DATABASE_URL=f"{URL_PG}?sslmode=require&host=a&host=b"))
        # Sockets y loopback de prueba siguen admitidos sin TLS.
        for url in ("postgresql:///buss", "postgresql:///buss?host=/var/run/postgresql",
                    "postgresql://buss@127.0.0.1/buss", "postgresql://buss@localhost/buss?hostaddr=127.0.0.1"):
            with self.subTest(url=url):
                _produccion(DATABASE_URL=url)
        _produccion(DATABASE_URL="postgresql://u:p@/universidad?host=db.example&sslmode=verify-full")

    def test_proxies_acotados_en_produccion(self):
        for valor in ("*", "0.0.0.0/0", "::/0", "10.0.0.0/7", "::ffff:0:0/96"):
            with self.subTest(valor=valor):
                self.assertIn("PROXY_IPS_CONFIABLES", self._error(PROXY_IPS_CONFIABLES=valor))
        self.assertIn("PROXY_IPS_CONFIABLES", self._error(PROXY_IPS_CONFIABLES="10.1.2.3/8"))
        ajustes = _produccion(PROXY_IPS_CONFIABLES="10.0.0.0/8,2001:db8::/32,192.0.2.7")
        self.assertEqual(ajustes.proxy_ips_confiables, ["10.0.0.0/8", "2001:db8::/32", "192.0.2.7"])
        self.assertEqual(_ajustes(PROXY_IPS_CONFIABLES="*").proxy_ips_confiables, ["*"])

    def test_programa_demo_desactivado_por_defecto_en_produccion(self):
        self.assertFalse(_produccion().PROGRAMA_DEMO_AL_ARRANCAR)
        self.assertTrue(_ajustes().PROGRAMA_DEMO_AL_ARRANCAR)
        self.assertFalse(_produccion(_entorno={"PROGRAMA_DEMO_AL_ARRANCAR": ""}).PROGRAMA_DEMO_AL_ARRANCAR)
        self.assertTrue(_produccion(PROGRAMA_DEMO_AL_ARRANCAR=True).PROGRAMA_DEMO_AL_ARRANCAR)


if __name__ == "__main__":
    unittest.main()
