"""Registro estructurado sin datos personales.

- `configurar_registro` instala un único manejador en stderr (JSON o texto)
  y silencia el log de acceso de Uvicorn, que incluye la URL completa con
  códigos de reserva y parámetros.
- `RegistroAccesoMiddleware` asigna un identificador de solicitud propio
  (`X-Request-ID`, UUID generado por el servidor; el que envíe el cliente se
  descarta) y registra método, plantilla de ruta, estado y duración.
  Nunca la ruta real, la query, cabeceras ni cuerpos.
- Las excepciones se registran solo con su tipo y marcos (sin mensaje).
"""
import contextvars
import json
import logging
import sys
import time
import uuid
from datetime import datetime, timezone

_request_id: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")
CAMPOS_EXTRA = ("request_id", "metodo", "ruta", "estado", "duracion_ms")
logger_acceso = logging.getLogger("buss.acceso")


def request_id_actual() -> str:
    return _request_id.get()


class _FiltroRequestId(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = _request_id.get()
        return True


def _tipo_excepcion(record: logging.LogRecord) -> str | None:
    if record.exc_info and record.exc_info[0] is not None:
        from .http import resumen_traza

        return resumen_traza(record.exc_info[1])
    return None


class FormatoJSON(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        datos = {
            "ts": datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec="milliseconds"),
            "nivel": record.levelname,
            "logger": record.name,
            "mensaje": record.getMessage(),
        }
        for campo in CAMPOS_EXTRA:
            valor = getattr(record, campo, None)
            if valor is not None and valor != "-":
                datos[campo] = valor
        excepcion = _tipo_excepcion(record)
        if excepcion:
            datos["excepcion"] = excepcion
        return json.dumps(datos, ensure_ascii=False)


class FormatoTexto(logging.Formatter):
    def __init__(self):
        super().__init__("%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s")

    def formatException(self, ei) -> str:  # noqa: N802 (API de logging)
        from .http import resumen_traza

        return resumen_traza(ei[1])


_MARCA = "_buss_registro"


def configurar_registro(nivel: str = "INFO", formato: str = "json") -> None:
    """Idempotente: reemplaza solo el manejador instalado por esta función."""
    raiz = logging.getLogger()
    for manejador in list(raiz.handlers):
        if getattr(manejador, _MARCA, False):
            raiz.removeHandler(manejador)
    manejador = logging.StreamHandler(sys.stderr)
    setattr(manejador, _MARCA, True)
    manejador.setFormatter(FormatoJSON() if formato == "json" else FormatoTexto())
    manejador.addFilter(_FiltroRequestId())
    raiz.addHandler(manejador)
    raiz.setLevel(nivel)
    # Uvicorn: sus mensajes pasan por el manejador raíz; el acceso se apaga.
    for nombre in ("uvicorn", "uvicorn.error"):
        log = logging.getLogger(nombre)
        log.handlers.clear()
        log.propagate = True
    acceso = logging.getLogger("uvicorn.access")
    acceso.handlers.clear()
    acceso.propagate = False
    acceso.disabled = True
    # SQLAlchemy nunca registra SQL ni parámetros por este camino.
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def _plantilla(scope) -> str:
    ruta = scope.get("route")
    plantilla = getattr(ruta, "path", None)
    if isinstance(plantilla, str) and plantilla:
        return plantilla
    if scope.get("buss_spa"):
        return "(frontend)"
    return "(ruta no resuelta)"


class RegistroAccesoMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        # Siempre generado por el servidor: un X-Request-ID entrante es texto
        # arbitrario del cliente (podría llevar un correo o un documento) y
        # nunca se copia al registro ni a la respuesta.
        rid = uuid.uuid4().hex
        token = _request_id.set(rid)
        inicio = time.perf_counter()
        estado = 500

        async def enviar(mensaje):
            nonlocal estado
            if mensaje["type"] == "http.response.start":
                estado = mensaje["status"]
                headers = [(k, v) for k, v in mensaje.get("headers", []) if k.lower() != b"x-request-id"]
                headers.append((b"x-request-id", rid.encode()))
                mensaje = {**mensaje, "headers": headers}
            await send(mensaje)

        try:
            await self.app(scope, receive, enviar)
        finally:
            duracion = round((time.perf_counter() - inicio) * 1000, 1)
            nivel = logging.WARNING if estado >= 500 else logging.INFO
            logger_acceso.log(
                nivel,
                "%s %s %s",
                scope.get("method", "?"),
                _plantilla(scope),
                estado,
                extra={
                    "request_id": rid,
                    "metodo": scope.get("method", "?"),
                    "ruta": _plantilla(scope),
                    "estado": estado,
                    "duracion_ms": duracion,
                },
            )
            _request_id.reset(token)
