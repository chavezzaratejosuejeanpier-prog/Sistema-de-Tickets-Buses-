"""Arranque de producción/preproducción con Uvicorn.

    python servidor.py

Lee HOST, PORT, WEB_CONCURRENCY, TIMEOUT_KEEP_ALIVE, LOG_LEVEL y LOG_FORMAT
de la configuración (entorno o backend/.env). En Render: HOST=0.0.0.0 y el
PORT que inyecta la plataforma.

- Sin --reload y sin cabecera Server.
- Sin log de acceso de Uvicorn (incluye la URL con códigos de reserva): lo
  sustituye `RegistroAccesoMiddleware`, que registra la plantilla de ruta.
- Las cabeceras X-Forwarded-* las interpreta `ProxyConfiableMiddleware`
  según PROXY_IPS_CONFIABLES y PROXY_SALTOS; el soporte propio de Uvicorn se
  desactiva para no tomar la IP falsificable más a la izquierda.
- No ejecuta migraciones: si la base no está al día la API no arranca
  (ejecuta antes `python migrar.py`).
- Los fallos de arranque (importación, conexión, lifespan) se registran
  solo con tipo y marcos, nunca con el mensaje de la excepción.
"""
import sys


def opciones_uvicorn(ajustes) -> dict:
    return {
        "host": ajustes.HOST,
        "port": ajustes.PORT,
        "workers": ajustes.WEB_CONCURRENCY,
        "proxy_headers": False,
        "server_header": False,
        "access_log": False,
        "log_config": None,
        "log_level": ajustes.LOG_LEVEL.lower(),
        "timeout_keep_alive": ajustes.TIMEOUT_KEEP_ALIVE,
        "timeout_graceful_shutdown": 20,
        "reload": False,
    }


def main() -> int:
    try:
        from app.core.config import settings
    except RuntimeError as exc:
        # ConfiguracionInvalida: campo y motivo, nunca el valor recibido.
        print(exc, file=sys.stderr)
        return 2

    import logging

    import uvicorn

    from app.core.http import resumen_traza
    from app.core.registro import configurar_registro

    configurar_registro(settings.LOG_LEVEL, settings.LOG_FORMAT)
    try:
        uvicorn.run("app.main:app", **opciones_uvicorn(settings))
    except Exception as exc:
        # Sin el mensaje: un error al importar la app o al conectar puede
        # incluir la URL de la base, SQL o datos. Solo tipo y marcos.
        logging.getLogger("buss.api").critical("Arranque fallido: %s", resumen_traza(exc))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
