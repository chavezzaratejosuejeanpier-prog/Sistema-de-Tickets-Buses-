"""Cabeceras de seguridad, límite de cuerpo y manejo uniforme de errores."""
import logging
import os
import traceback

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException

logger = logging.getLogger("buss.api")

# Ningún endpoint JSON necesita más: un checkout de 60 pasajeros ocupa ~30 KiB.
MAX_BYTES_CUERPO = 64 * 1024

# Rutas de documentación: Swagger/ReDoc cargan scripts y estilos de un CDN,
# por eso no reciben la CSP estricta de la API.
RUTAS_DOCS = ("/docs", "/redoc", "/openapi.json")

CABECERAS_SEGURIDAD = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
}
CSP_API = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
# Login y registro devuelven tokens o datos de cuenta: nunca se cachean,
# tampoco sus respuestas de error (401, 422, 429...).
RUTAS_SIN_CACHE = ("/api/auth",)
CABECERAS_SIN_CACHE = {"Cache-Control": "no-store, max-age=0", "Pragma": "no-cache"}
HSTS = "max-age=31536000; includeSubDomains"

ERROR_INTERNO = "Error interno del servidor. Inténtalo de nuevo en unos minutos."
CONFLICTO_DATOS = "La operación entra en conflicto con datos existentes."
CUERPO_EXCESIVO = "La solicitud es demasiado grande."


class SecurityHeadersMiddleware:
    """ASGI puro: añade cabeceras a toda respuesta, incluidas las de error."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        ruta = scope.get("path", "")
        es_docs = ruta.startswith(RUTAS_DOCS)
        es_https = scope.get("scheme") == "https"
        sin_cache = ruta.startswith(RUTAS_SIN_CACHE)

        async def enviar(mensaje):
            if mensaje["type"] == "http.response.start":
                headers = list(mensaje.get("headers", []))
                presentes = {k.lower() for k, _ in headers}
                extra = dict(CABECERAS_SEGURIDAD)
                if not es_docs:
                    extra["Content-Security-Policy"] = CSP_API
                if es_https:
                    # Solo con TLS: los navegadores ignoran HSTS sobre HTTP.
                    extra["Strict-Transport-Security"] = HSTS
                if sin_cache:
                    extra.update(CABECERAS_SIN_CACHE)
                for nombre, valor in extra.items():
                    clave = nombre.lower().encode()
                    if clave not in presentes:
                        headers.append((clave, valor.encode()))
                mensaje = {**mensaje, "headers": headers}
            await send(mensaje)

        await self.app(scope, receive, enviar)


class BodySizeLimitMiddleware:
    """Rechaza con 413 los cuerpos mayores a `max_bytes`.

    Comprueba Content-Length y, para cuerpos sin longitud declarada
    (chunked), cuenta los bytes recibidos.
    """

    def __init__(self, app, max_bytes: int = MAX_BYTES_CUERPO):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        for nombre, valor in scope.get("headers", []):
            if nombre == b"content-length":
                try:
                    largo = int(valor)
                except ValueError:
                    largo = self.max_bytes + 1
                if largo > self.max_bytes:
                    return await _responder_413(scope, receive, send)
                break

        recibidos = 0
        respuesta_iniciada = False

        async def recibir():
            nonlocal recibidos
            mensaje = await receive()
            if mensaje["type"] == "http.request":
                recibidos += len(mensaje.get("body", b""))
                if recibidos > self.max_bytes:
                    # FastAPI re-lanza HTTPException al leer el cuerpo y la
                    # convierte en una respuesta JSON 413.
                    raise HTTPException(status_code=413, detail=CUERPO_EXCESIVO)
            return mensaje

        async def enviar(mensaje):
            nonlocal respuesta_iniciada
            if mensaje["type"] == "http.response.start":
                respuesta_iniciada = True
            await send(mensaje)

        try:
            await self.app(scope, recibir, enviar)
        except HTTPException as exc:
            if exc.status_code != 413 or respuesta_iniciada:
                raise
            await _responder_413(scope, receive, send)


async def _responder_413(scope, receive, send):
    await JSONResponse({"detail": CUERPO_EXCESIVO}, status_code=413)(scope, receive, send)


def _mensaje_validacion(errores: list) -> tuple[str, list]:
    """Resume errores 422 sin devolver el valor recibido (puede contener PII)."""
    detalle = []
    for e in errores:
        loc = [str(p) for p in e.get("loc", ()) if p not in ("body", "query", "path")]
        mensaje = str(e.get("msg", "Valor inválido"))
        if mensaje.startswith("Value error, "):
            mensaje = mensaje[len("Value error, "):]
        detalle.append({"campo": ".".join(loc), "mensaje": mensaje})
    texto = "; ".join(
        f"{d['campo']}: {d['mensaje']}" if d["campo"] else d["mensaje"] for d in detalle[:5]
    )
    return f"Datos inválidos. {texto}".strip(), detalle


def ruta_para_log(request: Request) -> str:
    """Plantilla de la ruta (p. ej. /api/sales/tickets/{codigo}).

    Nunca la ruta real ni la query: pueden contener códigos de reserva,
    correos u otros parámetros del cliente.
    """
    plantilla = getattr(request.scope.get("route"), "path", None)
    return plantilla if isinstance(plantilla, str) else "(ruta no resuelta)"


def resumen_traza(exc: BaseException) -> str:
    """Tipo de excepción y marcos (archivo:línea:función), sin el mensaje.

    El mensaje de una excepción puede incluir SQL, parámetros o datos
    personales; los marcos bastan para localizar el fallo.
    """
    marcos = traceback.extract_tb(exc.__traceback__)[-8:]
    pila = " <- ".join(
        f"{os.path.basename(m.filename)}:{m.lineno}:{m.name}" for m in reversed(marcos)
    )
    return f"{type(exc).__name__} en {pila or '(sin traza)'}"


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validacion(_request: Request, exc: RequestValidationError):
        detalle, errores = _mensaje_validacion(exc.errors())
        return JSONResponse(status_code=422, content={"detail": detalle, "errores": errores})

    @app.exception_handler(IntegrityError)
    async def _integridad(request: Request, _exc: IntegrityError):
        logger.warning("Conflicto de integridad en %s %s", request.method, ruta_para_log(request))
        return JSONResponse(status_code=409, content={"detail": CONFLICTO_DATOS})

    @app.exception_handler(SQLAlchemyError)
    async def _base_datos(request: Request, exc: SQLAlchemyError):
        # Sin SQL, parámetros ni trazas en la respuesta ni en el log.
        logger.error("Error de base de datos en %s %s: %s", request.method, ruta_para_log(request), type(exc).__name__)
        return JSONResponse(status_code=503, content={"detail": ERROR_INTERNO})



class ErroresInternosMiddleware:
    """Convierte excepciones no controladas en un 500 genérico.

    Se usa un middleware en lugar de `exception_handler(Exception)` porque
    Starlette vuelve a lanzar la excepción tras responder y el servidor la
    registraría con su mensaje completo (SQL, parámetros, datos).
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        iniciada = False

        async def enviar(mensaje):
            nonlocal iniciada
            if mensaje["type"] == "http.response.start":
                iniciada = True
            await send(mensaje)

        try:
            await self.app(scope, receive, enviar)
        except Exception as exc:
            plantilla = getattr(scope.get("route"), "path", None)
            logger.error(
                "Error no controlado en %s %s: %s",
                scope.get("method", "?"),
                plantilla if isinstance(plantilla, str) else "(ruta no resuelta)",
                resumen_traza(exc),
            )
            if iniciada:
                return
            await JSONResponse(status_code=500, content={"detail": ERROR_INTERNO})(scope, receive, send)
