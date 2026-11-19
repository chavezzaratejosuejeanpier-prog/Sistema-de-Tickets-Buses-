"""Proxy inverso confiable y validación de la cabecera Host.

ProxyConfiableMiddleware sustituye a `--proxy-headers` de Uvicorn. Con
`--forwarded-allow-ips=*` Uvicorn toma la entrada MÁS A LA IZQUIERDA de
X-Forwarded-For, que el cliente puede falsificar. Aquí se toma la entrada
número `saltos` contando desde la derecha: la que escribió el proxy
confiable más cercano al cliente.

Solo se leen X-Forwarded-For y X-Forwarded-Proto, y solo cuando el par TCP
directo pertenece a PROXY_IPS_CONFIABLES; de cualquier otro cliente se
ignoran. En produccion la configuración exige IPs/CIDR acotados (sin "*",
0.0.0.0/0 ni ::/0); "*" queda para desarrollo/pruebas.
"""
import ipaddress

from fastapi.responses import JSONResponse

# Sondas de la plataforma (Render) pueden llegar con un Host interno.
RUTAS_SIN_CONTROL_HOST = ("/health",)
HOST_NO_PERMITIDO = "Host no permitido."


def _ip_valida(valor: str) -> str | None:
    valor = (valor or "").strip().strip('"')
    if valor.startswith("[") and "]" in valor:
        valor = valor[1:valor.index("]")]
    elif valor.count(":") == 1:
        # IPv4 con puerto (p. ej. 203.0.113.9:443).
        valor = valor.split(":", 1)[0]
    try:
        return str(ipaddress.ip_address(valor))
    except ValueError:
        return None


class ProxyConfiableMiddleware:
    def __init__(self, app, confiables: list[str], saltos: int = 1):
        self.app = app
        self.todos = confiables == ["*"]
        self.redes = [] if self.todos else [ipaddress.ip_network(c, strict=False) for c in confiables]
        self.saltos = max(1, int(saltos))
        self.activo = bool(confiables)

    def _confiable(self, host: str | None) -> bool:
        if self.todos:
            return True
        ip = _ip_valida(host or "")
        if ip is None:
            return False
        direccion = ipaddress.ip_address(ip)
        # Con un socket de doble pila el proxy IPv4 llega como ::ffff:a.b.c.d.
        candidatas = [direccion]
        if direccion.version == 6 and direccion.ipv4_mapped:
            candidatas.append(direccion.ipv4_mapped)
        return any(c in red for c in candidatas for red in self.redes if c.version == red.version)

    async def __call__(self, scope, receive, send):
        if not self.activo or scope["type"] not in ("http", "websocket"):
            return await self.app(scope, receive, send)
        cliente = scope.get("client")
        if cliente and self._confiable(cliente[0]):
            cabeceras = {}
            for nombre, valor in scope.get("headers", []):
                if nombre in (b"x-forwarded-for", b"x-forwarded-proto"):
                    # Varias cabeceras iguales equivalen a una lista separada por comas.
                    previo = cabeceras.get(nombre)
                    texto = valor.decode("latin-1")
                    cabeceras[nombre] = f"{previo},{texto}" if previo else texto
            scope = dict(scope)
            entradas = [p.strip() for p in cabeceras.get(b"x-forwarded-for", "").split(",") if p.strip()]
            if len(entradas) >= self.saltos:
                ip = _ip_valida(entradas[-self.saltos])
                if ip:
                    scope["client"] = (ip, 0)
            protocolos = [p.strip().lower() for p in cabeceras.get(b"x-forwarded-proto", "").split(",") if p.strip()]
            if protocolos and protocolos[-1] in ("http", "https"):
                scope["scheme"] = protocolos[-1] if scope["type"] == "http" else protocolos[-1].replace("http", "ws")
        return await self.app(scope, receive, send)


def _host_de(scope) -> str:
    for nombre, valor in scope.get("headers", []):
        if nombre == b"host":
            host = valor.decode("latin-1").strip().lower()
            if host.startswith("["):
                return host[: host.find("]") + 1] if "]" in host else host
            return host.rsplit(":", 1)[0] if host.count(":") == 1 else host
    return ""


def host_permitido(host: str, permitidos: list[str]) -> bool:
    if "*" in permitidos:
        return True
    host = (host or "").rstrip(".")
    if not host:
        return False
    for patron in permitidos:
        if patron.startswith("*."):
            if host.endswith(patron[1:]) and host != patron[2:]:
                return True
        elif host == patron:
            return True
    return False


class HostPermitidoMiddleware:
    """Responde 400 si la cabecera Host no está en HOSTS_PERMITIDOS."""

    def __init__(self, app, permitidos: list[str]):
        self.app = app
        self.permitidos = [p.lower() for p in permitidos] or ["*"]

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or "*" in self.permitidos:
            return await self.app(scope, receive, send)
        ruta = scope.get("path", "")
        if ruta in RUTAS_SIN_CONTROL_HOST or ruta.startswith("/health/"):
            return await self.app(scope, receive, send)
        if not host_permitido(_host_de(scope), self.permitidos):
            return await JSONResponse({"detail": HOST_NO_PERMITIDO}, status_code=400)(scope, receive, send)
        return await self.app(scope, receive, send)
