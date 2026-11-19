"""Entorno de pruebas aislado: BD SQLite temporal y clave ficticia.

Debe importarse antes que `app`, porque la configuración se lee al importar.
Solo usa la biblioteca estándar (sin httpx/pytest): las peticiones se envían
directamente a la aplicación ASGI en proceso, sin red.
"""
import asyncio
import atexit
import json
import os
import shutil
import tempfile

_TMP = tempfile.mkdtemp(prefix="buss-test-")
atexit.register(shutil.rmtree, _TMP, True)
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_TMP, 'prueba.db')}"
os.environ["SECRET_KEY"] = "clave-sintetica-solo-para-pruebas"
# Valores fijos de prueba: prevalecen sobre un backend/.env local.
os.environ["ENTORNO"] = "pruebas"
os.environ["SERVIR_FRONTEND"] = "false"
os.environ["HOSTS_PERMITIDOS"] = "*"
os.environ["CORS_ORIGENES"] = ""
os.environ["PROXY_IPS_CONFIABLES"] = ""
os.environ["DOCS_ENABLED"] = "true"
os.environ["SQLITE_WAL"] = "false"
os.environ["HOST"] = "127.0.0.1"
os.environ["PORT"] = "8000"
os.environ["WEB_CONCURRENCY"] = "1"
os.environ["LOG_LEVEL"] = "INFO"
os.environ["LOG_FORMAT"] = "json"

from app.main import app  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.routers.auth import crear_token  # noqa: E402

# La API ya no crea tablas al importarse: la BD temporal se prepara aquí.
Base.metadata.create_all(bind=engine)


def directorio_temporal() -> str:
    return _TMP


class Respuesta:
    def __init__(self, status, headers, body):
        self.status_code = status
        self.headers = headers
        self.content = body

    def json(self):
        return json.loads(self.content)


def llamar(
    metodo: str,
    ruta: str,
    cuerpo=None,
    token: str | None = None,
    *,
    cliente: str = "127.0.0.1",
    esquema: str = "http",
    cabeceras: dict | None = None,
    crudo: bytes | None = None,
    aplicacion=None,
) -> Respuesta:
    cabeceras = dict(cabeceras or {})
    host = cabeceras.pop("host", None) or cabeceras.pop("Host", None) or "testserver"
    headers = [(b"host", str(host).encode())]
    body = b""
    if crudo is not None:
        body = crudo
        headers.append((b"content-type", b"application/json"))
    elif cuerpo is not None:
        body = json.dumps(cuerpo, default=str).encode()
        headers.append((b"content-type", b"application/json"))
    if token:
        headers.append((b"authorization", f"Bearer {token}".encode()))
    for nombre, valor in (cabeceras or {}).items():
        headers.append((nombre.lower().encode(), str(valor).encode()))
    path, _, query = ruta.partition("?")
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": metodo,
        "scheme": esquema,
        "path": path,
        "raw_path": path.encode(),
        "query_string": query.encode(),
        "root_path": "",
        "headers": headers,
        "client": (cliente, 50000),
        "server": ("testserver", 80),
    }
    recibido = False
    mensajes = []

    async def receive():
        nonlocal recibido
        if not recibido:
            recibido = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(mensaje):
        mensajes.append(mensaje)

    asyncio.run((aplicacion or app)(scope, receive, send))
    inicio = next(m for m in mensajes if m["type"] == "http.response.start")
    cabeceras = {k.decode().lower(): v.decode() for k, v in inicio["headers"]}
    contenido = b"".join(m.get("body", b"") for m in mensajes if m["type"] == "http.response.body")
    return Respuesta(inicio["status"], cabeceras, contenido)


def reiniciar_bd():
    from app.core import rate_limit

    rate_limit.reiniciar()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def token_de(usuario) -> str:
    return crear_token({"sub": usuario.email, "rol": usuario.rol.value})


__all__ = ["app", "SessionLocal", "engine", "llamar", "reiniciar_bd", "token_de", "directorio_temporal"]
