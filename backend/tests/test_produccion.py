"""Preparación para producción (sin red ni servicios externos).

Cubre: validación de variables (produccion exige PostgreSQL con TLS, hosts,
docs desactivadas, CORS https; errores sin secretos), motor de base de
datos, proxy confiable (X-Forwarded-For no falsificable), control de Host,
registro de acceso sin datos y con X-Request-ID, liveness/readiness, build
de React servido en el mismo origen (caché, fallback, 404, CSP con hashes,
rutas fuera de dist) y opciones de Uvicorn. Solo datos sintéticos.
"""
import base64
import hashlib
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tests.apoyo import app, directorio_temporal, llamar

from fastapi import FastAPI
from sqlalchemy.orm import sessionmaker

import servidor
from app import esquema
from app.core.config import ConfiguracionInvalida, FRONTEND_DIST_POR_DEFECTO, cargar_settings, normalizar_url_bd
from app.core.http import SecurityHeadersMiddleware
from app.core.red import HostPermitidoMiddleware, ProxyConfiableMiddleware, host_permitido
from app.core.registro import FormatoJSON, RegistroAccesoMiddleware
from app.core.spa import FrontendNoDisponible, MontajeSpa, SpaEstatica, hashes_scripts_en_linea
from app.database import crear_engine, get_db

CLAVE = "clave-sintetica-de-produccion-para-pruebas-0001"
PASSWORD_BD = "ContraseniaSinteticaBD123"
URL_PG = f"postgresql://usuario_sintetico:{PASSWORD_BD}@ep-sintetico.example.neon.tech/buss"


def _ajustes(**valores):
    """Settings sin backend/.env ni variables del proceso (aisladas)."""
    entorno = {k: v for k, v in valores.pop("_entorno", {}).items()}
    with patch.dict(os.environ, entorno, clear=True):
        return cargar_settings(SECRET_KEY=CLAVE, _env_file=None, **valores)


def _produccion(**valores):
    base = {
        "ENTORNO": "produccion",
        "DATABASE_URL": f"{URL_PG}?sslmode=require",
        "HOSTS_PERMITIDOS": "buss.example.com",
    }
    base.update(valores)
    return _ajustes(**base)


# ------------------------------------------------------------ configuración
class ConfiguracionProduccionTest(unittest.TestCase):
    def test_produccion_valida(self):
        ajustes = _produccion()
        self.assertTrue(ajustes.es_produccion)
        self.assertFalse(ajustes.DOCS_ENABLED, "docs desactivadas por defecto en produccion")
        self.assertTrue(ajustes.DATABASE_URL.startswith("postgresql+psycopg2://"))
        self.assertEqual(ajustes.motor_bd, "postgresql")
        self.assertEqual(ajustes.hosts_permitidos, ["buss.example.com"])

    def test_desarrollo_conserva_valores_previos(self):
        ajustes = _ajustes()
        self.assertEqual(ajustes.ENTORNO, "desarrollo")
        self.assertTrue(ajustes.DOCS_ENABLED)
        self.assertEqual(ajustes.motor_bd, "sqlite")
        self.assertEqual((ajustes.HOST, ajustes.PORT), ("127.0.0.1", 8000))
        self.assertFalse(ajustes.SERVIR_FRONTEND)
        self.assertEqual(ajustes.proxy_ips_confiables, [])

    def _error(self, **valores) -> str:
        with self.assertRaises(ConfiguracionInvalida) as ctx:
            _produccion(**valores)
        return str(ctx.exception)

    def test_produccion_exige_tls_sin_revelar_la_contrasena(self):
        mensaje = self._error(DATABASE_URL=URL_PG)
        self.assertIn("sslmode", mensaje)
        self.assertNotIn(PASSWORD_BD, mensaje)
        self.assertNotIn("usuario_sintetico", mensaje)
        for modo in ("require", "verify-ca", "verify-full"):
            _produccion(DATABASE_URL=f"{URL_PG}?sslmode={modo}")

    def test_produccion_exige_url_explicita(self):
        with self.assertRaises(ConfiguracionInvalida) as ctx:
            _ajustes(ENTORNO="produccion", HOSTS_PERMITIDOS="buss.example.com")
        self.assertIn("DATABASE_URL", str(ctx.exception))

    def test_produccion_rechaza_docs_hosts_abiertos_y_cors_http(self):
        self.assertIn("DOCS_ENABLED", self._error(DOCS_ENABLED=True))
        self.assertIn("HOSTS_PERMITIDOS", self._error(HOSTS_PERMITIDOS="*"))
        self.assertIn("CORS_ORIGENES", self._error(CORS_ORIGENES="http://buss.example.com"))
        _produccion(CORS_ORIGENES="https://app.example.com")

    def test_sqlite_en_produccion_solo_con_confirmacion_y_ruta_absoluta(self):
        self.assertIn("PostgreSQL", self._error(DATABASE_URL="sqlite:////srv/buss/datos.db"))
        self.assertIn(
            "ruta absoluta",
            self._error(DATABASE_URL="sqlite:///relativa.db", PERMITIR_SQLITE_PRODUCCION=True),
        )
        _produccion(DATABASE_URL="sqlite:////srv/buss/datos.db", PERMITIR_SQLITE_PRODUCCION=True)

    def test_postgres_local_sin_tls_admitido(self):
        _produccion(DATABASE_URL="postgresql://buss@localhost/buss")

    def test_normaliza_esquemas_de_render_y_neon(self):
        self.assertEqual(normalizar_url_bd("postgres://u:p@h/db"), "postgresql+psycopg2://u:p@h/db")
        self.assertEqual(normalizar_url_bd("postgresql://u:p@h/db"), "postgresql+psycopg2://u:p@h/db")
        self.assertEqual(normalizar_url_bd(" sqlite:///x.db "), "sqlite:///x.db")

    def test_valores_invalidos_sin_eco(self):
        casos = {
            "ENTORNO": "staging",
            "DATABASE_URL": f"mysql://u:{PASSWORD_BD}@h/db",
            "HOST": "no es un host",
            "PORT": 70000,
            "WEB_CONCURRENCY": 0,
            "PROXY_IPS_CONFIABLES": "no-ip",
            "PROXY_SALTOS": 0,
            "HOSTS_PERMITIDOS": "https://buss.example.com",
            "CORS_ORIGENES": "https://buss.example.com/ruta",
            "LOG_FORMAT": "xml",
            "DB_POOL_SIZE": 0,
            "DB_POOL_RECYCLE": 5,
        }
        for campo, valor in casos.items():
            with self.subTest(campo=campo):
                with self.assertRaises(ConfiguracionInvalida) as ctx:
                    _ajustes(**{campo: valor})
                self.assertIn(campo, str(ctx.exception))
                self.assertNotIn(PASSWORD_BD, str(ctx.exception))

    def test_render_external_hostname_se_agrega(self):
        ajustes = _produccion(_entorno={"RENDER_EXTERNAL_HOSTNAME": "buss-sintetico.onrender.com"})
        self.assertIn("buss-sintetico.onrender.com", ajustes.hosts_permitidos)

    def test_listas_separadas_por_comas(self):
        ajustes = _ajustes(
            PROXY_IPS_CONFIABLES=" 10.0.0.0/8 , 127.0.0.1 ",
            HOSTS_PERMITIDOS="Buss.Example.com,*.example.org",
            CORS_ORIGENES="https://a.example.com/",
        )
        self.assertEqual(ajustes.proxy_ips_confiables, ["10.0.0.0/8", "127.0.0.1"])
        self.assertEqual(ajustes.hosts_permitidos, ["buss.example.com", "*.example.org"])
        self.assertEqual(ajustes.cors_origenes, ["https://a.example.com"])


class MotorBDTest(unittest.TestCase):
    def test_postgres_pool_y_tiempos(self):
        ajustes = _produccion(DB_POOL_SIZE=3, DB_MAX_OVERFLOW=2, DB_POOL_RECYCLE=120)
        engine = crear_engine(ajustes.DATABASE_URL, ajustes)
        try:
            self.assertEqual(engine.dialect.name, "postgresql")
            self.assertEqual(engine.pool.size(), 3)
            self.assertEqual(engine.pool._max_overflow, 2)
            self.assertEqual(engine.pool._recycle, 120)
            self.assertTrue(engine.pool._pre_ping)
            self.assertTrue(engine.hide_parameters)
            self.assertEqual(engine.url.query.get("sslmode"), "require")
        finally:
            engine.dispose()

    def test_sqlite_activa_claves_foraneas(self):
        engine = crear_engine(f"sqlite:///{os.path.join(directorio_temporal(), 'fk.db')}", _ajustes())
        try:
            with engine.connect() as con:
                self.assertEqual(con.exec_driver_sql("PRAGMA foreign_keys").scalar(), 1)
        finally:
            engine.dispose()


# -------------------------------------------------------------------- proxy
def _eco():
    async def aplicacion(scope, receive, send):
        cuerpo = json.dumps({"ip": scope["client"][0], "esquema": scope["scheme"]}).encode()
        await send({"type": "http.response.start", "status": 200,
                    "headers": [(b"content-type", b"application/json")]})
        await send({"type": "http.response.body", "body": cuerpo})

    return aplicacion


class ProxyConfiableTest(unittest.TestCase):
    def _pedir(self, confiables, saltos=1, cliente="10.1.2.3", **cabeceras):
        mw = ProxyConfiableMiddleware(_eco(), confiables=confiables, saltos=saltos)
        return llamar("GET", "/x", cliente=cliente, cabeceras=cabeceras, aplicacion=mw).json()

    def test_sin_proxy_configurado_ignora_cabeceras(self):
        r = self._pedir([], **{"x-forwarded-for": "203.0.113.7", "x-forwarded-proto": "https"})
        self.assertEqual(r, {"ip": "10.1.2.3", "esquema": "http"})

    def test_toma_la_entrada_del_proxy_no_la_falsificada(self):
        cab = {"x-forwarded-for": "6.6.6.6, 203.0.113.7", "x-forwarded-proto": "https"}
        self.assertEqual(self._pedir(["*"], **cab), {"ip": "203.0.113.7", "esquema": "https"})
        self.assertEqual(self._pedir(["10.0.0.0/8"], **cab)["ip"], "203.0.113.7")
        self.assertEqual(self._pedir(["*"], saltos=2, **cab)["ip"], "6.6.6.6")

    def test_par_no_confiable_o_entrada_invalida(self):
        cab = {"x-forwarded-for": "203.0.113.7"}
        self.assertEqual(self._pedir(["192.168.0.0/16"], **cab)["ip"], "10.1.2.3")
        self.assertEqual(self._pedir(["*"], **{"x-forwarded-for": "no-es-ip"})["ip"], "10.1.2.3")
        self.assertEqual(self._pedir(["*"], saltos=3, **cab)["ip"], "10.1.2.3")
        self.assertEqual(self._pedir(["*"], **{"x-forwarded-for": "[2001:db8::1]:443"})["ip"], "2001:db8::1")
        self.assertEqual(self._pedir(["*"], **{"x-forwarded-proto": "gopher"})["esquema"], "http")


class HostPermitidoTest(unittest.TestCase):
    def _pedir(self, permitidos, host, ruta="/api/x"):
        mw = HostPermitidoMiddleware(_eco(), permitidos)
        return llamar("GET", ruta, cabeceras={"host": host}, aplicacion=mw).status_code

    def test_host_permitido_y_rechazado(self):
        self.assertEqual(self._pedir(["buss.example.com"], "buss.example.com:443"), 200)
        self.assertEqual(self._pedir(["buss.example.com"], "BUSS.example.com"), 200)
        self.assertEqual(self._pedir(["buss.example.com"], "atacante.example"), 400)
        self.assertEqual(self._pedir(["*.example.com"], "app.example.com"), 200)
        self.assertEqual(self._pedir(["*.example.com"], "example.com"), 400)
        self.assertEqual(self._pedir(["*"], "cualquiera"), 200)

    def test_sondas_de_salud_exentas(self):
        self.assertEqual(self._pedir(["buss.example.com"], "10.0.0.5:10000", "/health"), 200)
        self.assertEqual(self._pedir(["buss.example.com"], "10.0.0.5:10000", "/health/ready"), 200)

    def test_funcion_host_permitido(self):
        self.assertFalse(host_permitido("", ["buss.example.com"]))
        self.assertTrue(host_permitido("buss.example.com.", ["buss.example.com"]))


# ----------------------------------------------------------------- registro
class RegistroAccesoTest(unittest.TestCase):
    def test_registra_plantilla_sin_codigo_ni_query(self):
        with self.assertLogs("buss.acceso", level="INFO") as capturado:
            r = llamar("GET", "/api/sales/tickets/BC-SECRETO9?email=privado@example.com")
        self.assertEqual(r.status_code, 401)
        texto = "\n".join(capturado.output)
        self.assertIn("/api/sales/tickets/{codigo}", texto)
        self.assertNotIn("BC-SECRETO9", texto)
        self.assertNotIn("privado@example.com", texto)
        registro = capturado.records[-1]
        self.assertEqual(registro.estado, 401)
        self.assertEqual(registro.request_id, r.headers["x-request-id"])

    def test_request_id_entrante_nunca_se_registra(self):
        for entrante in ("abc12345-req", "juan.perez_70000001", "malo\ncon salto"):
            with self.assertLogs("buss.acceso", level="INFO") as capturado:
                r = llamar("GET", "/health/live", cabeceras={"x-request-id": entrante})
            self.assertRegex(r.headers["x-request-id"], r"^[0-9a-f]{32}$")
            self.assertNotEqual(r.headers["x-request-id"], entrante)
            self.assertEqual(capturado.records[-1].request_id, r.headers["x-request-id"])
            self.assertNotIn("70000001", "\n".join(capturado.output))

    def test_formato_json_sin_mensaje_de_excepcion(self):
        try:
            raise ValueError("dato personal 70000001")
        except ValueError:
            registro = logging.getLogger("buss.prueba").makeRecord(
                "buss.prueba", logging.ERROR, __file__, 1, "Fallo en %s", ("/api/x",), sys.exc_info(),
                extra={"request_id": "r-12345678", "estado": 500},
            )
        datos = json.loads(FormatoJSON().format(registro))
        self.assertEqual(datos["mensaje"], "Fallo en /api/x")
        self.assertEqual(datos["request_id"], "r-12345678")
        self.assertIn("ValueError", datos["excepcion"])
        self.assertNotIn("70000001", json.dumps(datos))


# -------------------------------------------------------------------- salud
class SaludProduccionTest(unittest.TestCase):
    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)

    def _usar(self, engine):
        Sesion = sessionmaker(bind=engine)

        def obtener():
            db = Sesion()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = obtener

    def test_liveness_sin_base(self):
        r = llamar("GET", "/health/live")
        self.assertEqual((r.status_code, r.json()), (200, {"status": "ok"}))

    def test_readiness_exige_esquema_migrado(self):
        ruta = os.path.join(directorio_temporal(), "ready.db")
        if os.path.exists(ruta):
            os.remove(ruta)
        engine = crear_engine(f"sqlite:///{ruta}", _ajustes())
        self.addCleanup(engine.dispose)
        self._usar(engine)
        r = llamar("GET", "/health/ready")
        self.assertEqual((r.status_code, r.json().get("schema")), (503, "pending"))
        esquema.migrar(engine)
        r = llamar("GET", "/health/ready")
        self.assertEqual((r.status_code, r.json()), (200, {"status": "ok", "database": "connected", "schema": "ok"}))

    def test_rutas_sin_spa_conservan_raiz_json(self):
        r = llamar("GET", "/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("mensaje", r.json())


# ----------------------------------------------------------------------- SPA
SCRIPT_TEMA = "\n      (function () { document.documentElement.dataset.prueba = '1' })()\n    "
INDEX = (
    "<!doctype html><html><head><script>" + SCRIPT_TEMA + "</script>"
    '<script type="module" crossorigin src="/assets/index-abc123.js"></script></head>'
    '<body><div id="root"></div></body></html>'
)


class SpaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raiz = Path(tempfile.mkdtemp(prefix="buss-dist-", dir=directorio_temporal()))
        cls.dist = cls.raiz / "dist"
        (cls.dist / "assets").mkdir(parents=True)
        (cls.dist / "petfriendly").mkdir()
        (cls.dist / "index.html").write_text(INDEX, encoding="utf-8")
        (cls.dist / "assets" / "index-abc123.js").write_text("console.log('ok')", encoding="utf-8")
        (cls.dist / "sw.js").write_text("self.addEventListener('fetch', () => {})", encoding="utf-8")
        (cls.dist / "manifest.json").write_text('{"name": "LUX"}', encoding="utf-8")
        (cls.dist / "petfriendly" / "guia sintetica.pdf").write_bytes(b"%PDF-1.4 sintetico")
        (cls.dist / ".oculto.txt").write_text("no publicar", encoding="utf-8")
        (cls.raiz / "secreto.txt").write_text("fuera de dist", encoding="utf-8")
        try:
            (cls.dist / "assets" / "fuga.txt").symlink_to(cls.raiz / "secreto.txt")
        except OSError:
            pass
        cls.spa = SpaEstatica(cls.dist)
        api = FastAPI()

        @api.get("/api/ping")
        def ping():
            return {"ok": True}

        @api.get("/health")
        def salud():
            return {"status": "ok"}

        @api.post("/api/solo-post")
        def solo_post():
            return {"ok": True}

        api.router.routes.append(MontajeSpa(cls.spa))
        cls.app = SecurityHeadersMiddleware(RegistroAccesoMiddleware(api), spa=cls.spa)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.raiz, ignore_errors=True)

    def _get(self, ruta, metodo="GET", esquema_="http"):
        return llamar(metodo, ruta, aplicacion=self.app, esquema=esquema_)

    def test_index_y_fallback_sin_cache_con_csp_por_hash(self):
        esperado = "'sha256-" + base64.b64encode(hashlib.sha256(SCRIPT_TEMA.encode()).digest()).decode() + "'"
        for ruta in ("/", "/asientos/5", "/innovacion2", "/index.html"):
            with self.subTest(ruta=ruta):
                r = self._get(ruta)
                self.assertEqual(r.status_code, 200)
                self.assertIn(b'<div id="root">', r.content)
                self.assertEqual(r.headers["cache-control"], "no-cache")
                csp = r.headers["content-security-policy"]
                script_src = next(d for d in csp.split("; ") if d.startswith("script-src"))
                self.assertIn(esperado, script_src)
                self.assertNotIn("unsafe-inline", script_src)
                self.assertIn("frame-ancestors 'none'", csp)
                self.assertNotIn("upgrade-insecure-requests", csp)
                self.assertIn("microphone=(self)", r.headers["permissions-policy"])
                self.assertEqual(r.headers["referrer-policy"], "strict-origin-when-cross-origin")
                self.assertEqual(r.headers["x-content-type-options"], "nosniff")

    def test_assets_inmutables_y_archivos_revalidados(self):
        r = self._get("/assets/index-abc123.js")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers["cache-control"], "public, max-age=31536000, immutable")
        self.assertIn("javascript", r.headers["content-type"])
        for ruta in ("/sw.js", "/manifest.json"):
            self.assertEqual(self._get(ruta).headers["cache-control"], "no-cache", ruta)
        r = self._get("/petfriendly/guia sintetica.pdf")
        self.assertEqual((r.status_code, r.content), (200, b"%PDF-1.4 sintetico"))

    def test_estaticos_inexistentes_dan_404_no_html(self):
        for ruta in ("/assets/no-existe.js", "/assets/sin-extension", "/no-existe.png"):
            with self.subTest(ruta=ruta):
                r = self._get(ruta)
                self.assertEqual(r.status_code, 404)
                self.assertNotIn(b"root", r.content)

    def test_api_nunca_cae_en_el_fallback(self):
        self.assertEqual(self._get("/api/ping").json(), {"ok": True})
        for metodo in ("GET", "POST"):
            r = self._get("/api/no-existe", metodo)
            self.assertEqual(r.status_code, 404, metodo)
            self.assertEqual(r.json(), {"detail": "Not Found"})
            self.assertIn("default-src 'none'", r.headers["content-security-policy"])
        self.assertIn("default-src 'none'", self._get("/health").headers["content-security-policy"])

    def test_metodos_no_admitidos(self):
        r = self._get("/checkout", "POST")
        self.assertEqual(r.status_code, 405)
        self.assertEqual(self._get("/", "HEAD").status_code, 200)
        # Una ruta de la API con otro método conserva el 405 de FastAPI.
        self.assertEqual(self._get("/api/solo-post", "GET").status_code, 405)
        self.assertEqual(self._get("/api/solo-post", "POST").json(), {"ok": True})

    def test_no_sirve_ocultos_ni_fuera_de_dist(self):
        for ruta in ("/.oculto.txt", "/assets/fuga.txt", "/../secreto.txt", "/assets/../../secreto.txt"):
            with self.subTest(ruta=ruta):
                r = self._get(ruta)
                self.assertNotIn(b"no publicar", r.content)
                self.assertNotIn(b"fuera de dist", r.content)

    def test_https_agrega_upgrade_y_hsts(self):
        r = self._get("/", esquema_="https")
        self.assertIn("upgrade-insecure-requests", r.headers["content-security-policy"])
        self.assertIn("max-age=", r.headers["strict-transport-security"])

    def test_sin_build_no_arranca(self):
        with self.assertRaises(FrontendNoDisponible):
            SpaEstatica(self.raiz / "no-existe")

    @unittest.skipUnless((FRONTEND_DIST_POR_DEFECTO / "index.html").is_file(), "frontend/dist no compilado")
    def test_build_real_tiene_hash_del_script_de_tema(self):
        spa = SpaEstatica(FRONTEND_DIST_POR_DEFECTO)
        html = (FRONTEND_DIST_POR_DEFECTO / "index.html").read_text(encoding="utf-8")
        hashes = hashes_scripts_en_linea(html)
        self.assertGreaterEqual(len(hashes), 1)
        for h in hashes:
            self.assertIn(h, spa.csp_http)


_SCRIPT_APP_COMPLETA = r"""
import asyncio, json
from app.main import app

async def pedir(metodo, ruta, host):
    mensajes = []
    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}
    async def send(m):
        mensajes.append(m)
    scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": metodo,
             "scheme": "https", "path": ruta, "raw_path": ruta.encode(), "query_string": b"",
             "root_path": "", "headers": [(b"host", host.encode())], "client": ("127.0.0.1", 1),
             "server": ("buss.example.com", 443)}
    await app(scope, receive, send)
    inicio = next(m for m in mensajes if m["type"] == "http.response.start")
    cabeceras = {k.decode(): v.decode() for k, v in inicio["headers"]}
    return [inicio["status"], cabeceras.get("content-security-policy", ""), cabeceras.get("content-type", "")]

casos = [("GET", "/", "buss.example.com"), ("GET", "/asientos/1", "buss.example.com"),
         ("GET", "/api/auth/login", "buss.example.com"), ("POST", "/api/no-existe", "buss.example.com"),
         ("GET", "/health/live", "10.0.0.9"), ("GET", "/docs", "buss.example.com"),
         ("GET", "/", "atacante.example")]
print(json.dumps({f"{m} {r} {h}": asyncio.run(pedir(m, r, h)) for m, r, h in casos}))
"""


class AplicacionCompletaConFrontendTest(unittest.TestCase):
    """main.py con SERVIR_FRONTEND=true en un proceso aparte (sin red ni BD)."""

    def test_spa_api_hosts_y_docs_en_el_mismo_origen(self):
        dist = Path(tempfile.mkdtemp(prefix="buss-dist-main-", dir=directorio_temporal()))
        (dist / "index.html").write_text(INDEX, encoding="utf-8")
        entorno = {
            **os.environ,
            "DATABASE_URL": f"sqlite:///{dist / 'sin-uso.db'}",
            "SECRET_KEY": CLAVE,
            "ENTORNO": "pruebas",
            "SERVIR_FRONTEND": "true",
            "FRONTEND_DIST": str(dist),
            "HOSTS_PERMITIDOS": "buss.example.com",
            "DOCS_ENABLED": "false",
        }
        resultado = subprocess.run(
            [sys.executable, "-c", _SCRIPT_APP_COMPLETA],
            cwd=Path(__file__).resolve().parents[1], env=entorno, capture_output=True, text=True, timeout=120,
        )
        self.assertEqual(resultado.returncode, 0, resultado.stderr[-2000:])
        r = json.loads(resultado.stdout.strip().splitlines()[-1])
        estado = {k: v[0] for k, v in r.items()}
        self.assertEqual(estado["GET / buss.example.com"], 200)
        self.assertIn("text/html", r["GET / buss.example.com"][2])
        self.assertIn("'sha256-", r["GET / buss.example.com"][1])
        self.assertIn("upgrade-insecure-requests", r["GET / buss.example.com"][1])
        self.assertEqual(estado["GET /asientos/1 buss.example.com"], 200)
        self.assertEqual(estado["GET /api/auth/login buss.example.com"], 405)
        self.assertEqual(estado["POST /api/no-existe buss.example.com"], 404)
        self.assertIn("default-src 'none'", r["POST /api/no-existe buss.example.com"][1])
        self.assertEqual(estado["GET /health/live 10.0.0.9"], 200)
        self.assertEqual(estado["GET /docs buss.example.com"], 404)
        self.assertEqual(estado["GET / atacante.example"], 400)


# ------------------------------------------------------------------ uvicorn
class ServidorTest(unittest.TestCase):
    def test_opciones_de_produccion(self):
        ajustes = _produccion(HOST="0.0.0.0", PORT=10000, LOG_LEVEL="WARNING")
        opciones = servidor.opciones_uvicorn(ajustes)
        self.assertEqual((opciones["host"], opciones["port"]), ("0.0.0.0", 10000))
        self.assertFalse(opciones["proxy_headers"], "lo resuelve ProxyConfiableMiddleware")
        self.assertFalse(opciones["access_log"])
        self.assertFalse(opciones["server_header"])
        self.assertFalse(opciones["reload"])
        self.assertIsNone(opciones["log_config"])
        self.assertEqual(opciones["workers"], 1)
        self.assertEqual(opciones["log_level"], "warning")


if __name__ == "__main__":
    unittest.main()
