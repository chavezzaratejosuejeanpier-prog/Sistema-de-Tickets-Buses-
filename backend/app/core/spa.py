"""Entrega del build de React (frontend/dist) en el mismo origen que /api.

- `/assets/*` (nombres con hash): caché larga e inmutable.
- `index.html`, `sw.js` y `manifest.json`: `no-cache` (revalidación), para
  que una publicación nueva llegue a los navegadores y al service worker.
- Rutas de navegación sin extensión: `index.html` (fallback de la SPA).
- `/api/*` nunca cae en el fallback: 404 JSON. Archivos inexistentes con
  extensión o bajo /assets: 404 (no se devuelve HTML en lugar de JS).
- Solo GET y HEAD. No se sirven archivos ocultos ni fuera de `dist`.

La CSP de la SPA se calcula al arrancar con los hashes de los scripts en
línea de `dist/index.html` (sin 'unsafe-inline' para scripts).
"""
import base64
import hashlib
import re
from pathlib import Path

from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.routing import Match, Mount

from .http import es_ruta_api

CACHE_INMUTABLE = "public, max-age=31536000, immutable"
CACHE_REVALIDAR = "no-cache"
CACHE_ESTATICO = "public, max-age=3600"
ARCHIVOS_REVALIDAR = {"index.html", "sw.js", "manifest.json", "manifest.webmanifest"}
_SCRIPT_EN_LINEA = re.compile(r"<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)</script>", re.IGNORECASE)


class FrontendNoDisponible(RuntimeError):
    pass


def hashes_scripts_en_linea(html: str) -> list[str]:
    hashes = []
    for contenido in _SCRIPT_EN_LINEA.findall(html):
        if not contenido.strip():
            continue
        digest = hashlib.sha256(contenido.encode("utf-8")).digest()
        hashes.append(f"'sha256-{base64.b64encode(digest).decode()}'")
    return hashes


def construir_csp(html: str, https: bool = False) -> str:
    scripts = " ".join(["'self'", *hashes_scripts_en_linea(html)])
    directivas = [
        "default-src 'self'",
        f"script-src {scripts}",
        # SweetAlert2 inyecta estilos y la alerta del checkout usa style=.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        # Vite incrusta imágenes pequeñas como data: y el PDF usa blob:.
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ]
    if https:
        directivas.append("upgrade-insecure-requests")
    return "; ".join(directivas)


def _politica_cache(relativa: str) -> str:
    if relativa.startswith("assets/"):
        return CACHE_INMUTABLE
    if relativa in ARCHIVOS_REVALIDAR or relativa.endswith(".html"):
        return CACHE_REVALIDAR
    return CACHE_ESTATICO


class MontajeSpa(Mount):
    """Montaje en "/" que nunca reclama rutas de la API.

    Un Mount en "/" coincide con toda ruta y Starlette lo preferiría a una
    ruta de la API con otro método (405). Excluyendo /api, /health y /docs
    se conservan los 405 y 404 propios de FastAPI.
    """

    def __init__(self, spa: "SpaEstatica"):
        super().__init__("/", app=spa, name="frontend")

    def matches(self, scope):
        if scope.get("type") == "http" and es_ruta_api(scope.get("path", "")):
            return Match.NONE, {}
        return super().matches(scope)


class SpaEstatica:
    """Aplicación ASGI montada con MontajeSpa después de las rutas de la API."""

    def __init__(self, dist: str | Path):
        self.raiz = Path(dist).resolve()
        indice = self.raiz / "index.html"
        if not indice.is_file():
            raise FrontendNoDisponible(
                f"No existe {indice}. Ejecuta `npm ci && npm run build` en frontend/ "
                "o desactiva SERVIR_FRONTEND."
            )
        self.html = indice.read_bytes()
        texto = self.html.decode("utf-8")
        self.csp_http = construir_csp(texto, https=False)
        self.csp_https = construir_csp(texto, https=True)

    def _archivo(self, relativa: str) -> Path | None:
        if not relativa:
            return None
        partes = relativa.split("/")
        if any(p in ("", ".", "..") or p.startswith(".") or "\x00" in p or "\\" in p for p in partes):
            return None
        candidato = (self.raiz / relativa).resolve()
        if not candidato.is_relative_to(self.raiz) or not candidato.is_file():
            return None
        return candidato

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return
        scope["buss_spa"] = True
        ruta = scope.get("path", "/")
        if ruta == "/api" or ruta.startswith("/api/"):
            return await JSONResponse({"detail": "Not Found"}, status_code=404)(scope, receive, send)
        if scope.get("method") not in ("GET", "HEAD"):
            return await JSONResponse(
                {"detail": "Method Not Allowed"}, status_code=405, headers={"Allow": "GET, HEAD"}
            )(scope, receive, send)

        relativa = ruta.lstrip("/")
        archivo = self._archivo(relativa)
        if archivo is not None:
            respuesta = FileResponse(archivo, headers={"Cache-Control": _politica_cache(relativa)})
            return await respuesta(scope, receive, send)
        ultimo = relativa.rsplit("/", 1)[-1]
        if relativa.startswith("assets/") or "." in ultimo:
            return await Response(
                "No encontrado", status_code=404, media_type="text/plain",
                headers={"Cache-Control": CACHE_REVALIDAR},
            )(scope, receive, send)
        return await Response(
            self.html, media_type="text/html; charset=utf-8",
            headers={"Cache-Control": CACHE_REVALIDAR},
        )(scope, receive, send)
