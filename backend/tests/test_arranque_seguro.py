"""Regresión de la ronda final del commit 4 (datos sintéticos, sin red).

Cubre: arranque saneado (sin mensajes de excepción de BD/URL en el
registro ni en el texto que Starlette entrega a Uvicorn), `dispose` del
motor también si el arranque falla, programa demo nunca automático en
produccion, seed rechazado en produccion y separado de la migración.
"""
import asyncio
import io
import os
import traceback
import unittest
from contextlib import redirect_stdout
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from tests.apoyo import directorio_temporal

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

import seed
import servidor
from app import esquema, main
from app.database import Base

SECRETO = "ClaveSinteticaBD-0001"
URL_FALSA = f"postgresql://usuario_sintetico:{SECRETO}@ep-sintetico.example.neon.tech/buss"


def _fallo_conexion(*_args, **_kwargs):
    raise RuntimeError(f"no se pudo conectar a {URL_FALSA} (persona@example.com)")


class LifespanSaneadoTest(unittest.TestCase):
    def _ciclo_asgi(self, engine):
        """Ejecuta el lifespan como lo haría Uvicorn y devuelve los mensajes enviados."""
        enviados = []
        entradas = [{"type": "lifespan.startup"}, {"type": "lifespan.shutdown"}]

        async def receive():
            return entradas.pop(0)

        async def send(mensaje):
            enviados.append(mensaje)

        async def ciclo():
            try:
                await main.app.router.lifespan({"type": "lifespan", "asgi": {"version": "3.0"}, "app": main.app},
                                               receive, send)
            except BaseException as exc:  # noqa: BLE001 - se inspecciona abajo
                return exc
            return None

        with patch.object(main, "engine", engine), patch.object(main, "configurar_registro"), \
             patch.object(main, "verificar_esquema", side_effect=_fallo_conexion):
            with self.assertLogs("buss.api", level="CRITICAL") as capturado:
                excepcion = asyncio.run(ciclo())
        return enviados, excepcion, "\n".join(capturado.output)

    def test_fallo_de_conexion_no_expone_url_ni_datos(self):
        engine = MagicMock()
        enviados, excepcion, registro = self._ciclo_asgi(engine)
        self.assertIsInstance(excepcion, main.ArranqueFallido)
        self.assertTrue(excepcion.__suppress_context__)
        fallo = [m for m in enviados if m["type"] == "lifespan.startup.failed"]
        self.assertEqual(len(fallo), 1)
        texto_uvicorn = fallo[0].get("message", "")
        completo = texto_uvicorn + registro + "".join(traceback.format_exception(excepcion))
        for dato in (SECRETO, "ep-sintetico", "persona@example.com", "usuario_sintetico"):
            self.assertNotIn(dato, completo)
        self.assertIn("RuntimeError", registro, "tipo y marcos, sin mensaje")
        engine.dispose.assert_called_once()

    def test_dispose_tambien_con_esquema_pendiente(self):
        engine = MagicMock()

        async def ciclo():
            async with main.lifespan(main.app):
                pass

        error = esquema.EsquemaDesactualizado("pendiente")
        with patch.object(main, "engine", engine), patch.object(main, "configurar_registro"), \
             patch.object(main, "verificar_esquema", side_effect=error), self.assertLogs("buss.api", "CRITICAL"):
            with self.assertRaises(esquema.EsquemaDesactualizado):
                asyncio.run(ciclo())
        engine.dispose.assert_called_once()

    def test_programa_demo_nunca_automatico_en_produccion(self):
        engine = MagicMock()

        async def ciclo():
            async with main.lifespan(main.app):
                pass

        with patch.object(main, "engine", engine), patch.object(main, "configurar_registro"), \
             patch.object(main, "verificar_esquema", return_value="0001"), \
             patch.object(main.settings, "PROGRAMA_DEMO_AL_ARRANCAR", True), \
             patch.object(main.settings, "ENTORNO", "produccion"), \
             patch.object(main.programa, "sincronizar_ventana") as sincronizar:
            asyncio.run(ciclo())
        sincronizar.assert_not_called()
        engine.dispose.assert_called_once()


class ServidorSaneadoTest(unittest.TestCase):
    def test_error_de_arranque_sin_mensaje(self):
        with patch("uvicorn.run", side_effect=_fallo_conexion), \
             patch("app.core.registro.configurar_registro"), \
             self.assertLogs("buss.api", level="CRITICAL") as capturado:
            self.assertEqual(servidor.main(), 1)
        texto = "\n".join(capturado.output)
        self.assertIn("RuntimeError", texto)
        self.assertNotIn(SECRETO, texto)
        self.assertNotIn("persona@example.com", texto)


class SeedProduccionYMigracionTest(unittest.TestCase):
    def test_rechazado_en_produccion(self):
        ruta = os.path.join(directorio_temporal(), "seed-prod.db")
        ajustes = SimpleNamespace(ENTORNO="produccion", model_fields_set={"DATABASE_URL"},
                                  DATABASE_URL=f"sqlite:///{ruta}")
        salida = io.StringIO()
        with patch.object(seed, "settings", ajustes), \
             patch.object(seed, "cargar_demo", side_effect=AssertionError("no debía cargar")), \
             redirect_stdout(salida):
            self.assertEqual(seed.main(["--desarrollo"]), seed.CODIGO_RECHAZADO)
        self.assertIn("produccion", salida.getvalue())
        self.assertFalse(os.path.exists(ruta))

    def test_no_migra_y_exige_esquema_al_dia(self):
        ruta = os.path.join(directorio_temporal(), "seed-sin-migrar.db")
        if os.path.exists(ruta):
            os.remove(ruta)
        engine = create_engine(f"sqlite:///{ruta}")
        self.addCleanup(engine.dispose)
        Base.metadata.create_all(bind=engine)  # tablas sin versión de Alembic
        ajustes = SimpleNamespace(ENTORNO="desarrollo", model_fields_set={"DATABASE_URL"},
                                  DATABASE_URL=f"sqlite:///{ruta}")
        salida = io.StringIO()
        with patch.object(seed, "settings", ajustes), patch.object(seed, "engine", engine), \
             patch.object(seed, "SessionLocal", sessionmaker(bind=engine)), \
             patch.object(seed.programa, "sincronizar_ventana", side_effect=AssertionError("no debía cargar")), \
             redirect_stdout(salida):
            codigo = seed.main(["--desarrollo"])
        self.assertEqual(codigo, seed.CODIGO_ESQUEMA_PENDIENTE, salida.getvalue())
        self.assertIn("migrar.py", salida.getvalue())
        self.assertFalse(inspect(engine).has_table("alembic_version"), "el seed no migra")
        with engine.connect() as con:
            self.assertEqual(con.exec_driver_sql("SELECT COUNT(*) FROM buses").scalar(), 0)


if __name__ == "__main__":
    unittest.main()
