"""Configuración de la API leída de variables de entorno o `backend/.env`.

Los errores de validación nunca incluyen el valor recibido: `DATABASE_URL`
y `SECRET_KEY` pueden contener secretos (ver `describir_error_configuracion`).
"""
import ipaddress
import os
import re
from pathlib import Path
from urllib.parse import urlsplit

from pydantic import ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings
from sqlalchemy.engine import make_url

BASE_DIR = Path(__file__).resolve().parents[2]
# Build de Vite (`npm run build`) que la API puede servir en el mismo origen.
FRONTEND_DIST_POR_DEFECTO = BASE_DIR.parent / "frontend" / "dist"

# Valores de ejemplo o triviales que nunca deben firmar tokens reales.
CLAVES_PROHIBIDAS = {
    "tu-clave-secreta-aqui",
    "changeme",
    "secret",
    "secret-key",
    "clave-secreta",
}
LARGO_MINIMO_CLAVE = 32
# Solo HMAC: evita "none" y la confusión con algoritmos asimétricos.
ALGORITMOS_PERMITIDOS = {"HS256", "HS384", "HS512"}

ENTORNOS = ("desarrollo", "pruebas", "produccion")
MOTORES_SOPORTADOS = ("sqlite", "postgresql")
# sslmode de libpq que cifran la conexión. verify-full además valida el
# certificado y el nombre del servidor (recomendado con Neon).
SSLMODES_CIFRADOS = ("require", "verify-ca", "verify-full")
HOSTS_LOCALES = {"localhost", "127.0.0.1", "::1"}
_NOMBRE_HOST = re.compile(r"^(?=.{1,253}$)[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$")
FORMATOS_LOG = ("json", "texto")
NIVELES_LOG = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")


def _lista(valor: str) -> list[str]:
    return [p.strip() for p in (valor or "").split(",") if p.strip()]


def normalizar_url_bd(valor: str) -> str:
    """Normaliza el esquema de la URL sin alterar credenciales ni parámetros.

    Render y Neon entregan `postgres://` o `postgresql://`; SQLAlchemy 2 no
    acepta `postgres://` y el driver instalado es psycopg2.
    """
    valor = (valor or "").strip()
    for prefijo in ("postgres://", "postgresql://"):
        if valor.startswith(prefijo):
            return "postgresql+psycopg2://" + valor[len(prefijo):]
    return valor


def _host_pg_local(host: str) -> bool:
    """Socket Unix (ruta absoluta), localhost o IP de loopback."""
    host = (host or "").strip()
    if host.startswith("/"):
        return True
    if host.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(host.strip("[]")).is_loopback
    except ValueError:
        return False


def _destino_pg_local(url) -> bool:
    """¿El destino EFECTIVO de libpq es local (socket o loopback)?

    libpq conecta al `hostaddr` si existe (aunque `host` sea local), admite
    `host`/`hostaddr` en la query (que prevalecen sobre el host de la URL),
    listas separadas por comas, `service` (pg_service.conf puede fijar otro
    host) y, para lo que la URL no define, PGHOST/PGHOSTADDR/PGSERVICE. Solo
    es local si TODOS los destinos posibles lo son; en caso de duda, remoto.
    Sin ningún host (`postgresql:///db`) libpq usa el socket local.
    """
    consulta = url.query
    if "service" in consulta or (os.environ.get("PGSERVICE") or "").strip():
        return False
    destinos: list[str] = []
    hosts = [url.host or ""]
    if "host" in consulta:
        hosts.append(str(consulta["host"]))
    elif not url.host:
        hosts.append(os.environ.get("PGHOST", ""))
    for valor in hosts:
        destinos.extend(valor.split(","))
    if "hostaddr" in consulta:
        destinos.extend(str(consulta["hostaddr"]).split(","))
    else:
        destinos.extend((os.environ.get("PGHOSTADDR") or "").split(","))
    destinos = [d.strip() for d in destinos if d.strip()]
    return all(_host_pg_local(d) for d in destinos)


def _red_acotada(valor: str) -> bool:
    """IP o CIDR exacto que no abarca Internet (≥ /8 en IPv4, ≥ /32 en IPv6).

    Las redes IPv6 que contienen direcciones IPv4 mapeadas (::ffff:0:0/96)
    se evalúan por su prefijo IPv4 equivalente.
    """
    try:
        red = ipaddress.ip_network(valor, strict=True)
    except ValueError:
        return False
    if red.version == 4:
        return red.prefixlen >= 8
    mapeadas = ipaddress.ip_network("::ffff:0:0/96")
    if red.overlaps(mapeadas):
        return red.prefixlen >= 96 + 8
    return red.prefixlen >= 32


def _origen_cors(valor: str) -> str | None:
    """Origen canónico `esquema://host[:puerto]` o None si no es exacto.

    Rechaza comodines, credenciales, rutas, query, fragmentos y puertos
    inválidos sin propagar excepciones con el valor recibido. Omite el
    puerto por defecto, como lo envía el navegador en la cabecera Origin.
    """
    if any(c in valor for c in "*\\%@ \t") or valor.lower() == "null":
        return None
    try:
        url = urlsplit(valor)
        puerto = url.port
    except ValueError:
        return None
    esquema = url.scheme.lower()
    if (
        esquema not in ("http", "https")
        or not url.hostname
        or url.path not in ("", "/")
        or url.query
        or url.fragment
        or "?" in valor
        or "#" in valor
        or url.username is not None
        or url.password is not None
    ):
        return None
    if puerto is not None and not 1 <= puerto <= 65535:
        return None
    if url.netloc.endswith(":"):
        return None
    host = url.hostname.lower()
    try:
        ip = ipaddress.ip_address(host)
        host = f"[{ip}]" if ip.version == 6 else str(ip)
    except ValueError:
        if not _NOMBRE_HOST.match(host):
            return None
    por_defecto = 443 if esquema == "https" else 80
    sufijo = f":{puerto}" if puerto is not None and puerto != por_defecto else ""
    return f"{esquema}://{host}{sufijo}"


class Settings(BaseSettings):
    # ------------------------------------------------------------ entorno
    # desarrollo | pruebas | produccion. En produccion se exigen los
    # controles de despliegue (ver _validar_produccion).
    ENTORNO: str = "desarrollo"

    # ------------------------------------------------------- base de datos
    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'buss_conectpro.db').as_posix()}"
    # Pool por proceso (solo PostgreSQL). Con el plan gratuito de Neon y un
    # único proceso, 5 + 5 conexiones bastan.
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 5
    DB_POOL_TIMEOUT: int = 30
    # Neon suspende el cómputo inactivo y cierra conexiones: se reciclan
    # antes y se comprueban con pre_ping.
    DB_POOL_RECYCLE: int = 300
    DB_CONNECT_TIMEOUT: int = 10
    # Milisegundos; 0 = sin límite. No usar con el pooler de Neon (-pooler),
    # que no admite el parámetro de arranque `options`.
    DB_STATEMENT_TIMEOUT_MS: int = 0
    # SQLite: WAL mejora la concurrencia lector/escritor. Cambia el archivo
    # de forma persistente, por eso es opcional.
    SQLITE_WAL: bool = False
    # SQLite solo se admite en produccion con confirmación explícita (piloto
    # de una instancia con disco persistente; Render Free no lo tiene).
    PERMITIR_SQLITE_PRODUCCION: bool = False

    # ---------------------------------------------------------------- JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ----------------------------------------------------------------- API
    # Swagger/ReDoc/OpenAPI. Sin valor: activo en desarrollo/pruebas y
    # desactivado en produccion (donde no se permite activarlo).
    DOCS_ENABLED: bool | None = None
    # Hosts aceptados en la cabecera Host, separados por comas. "*" = todos
    # (solo fuera de produccion). Admite comodín de subdominio: *.ejemplo.pe
    HOSTS_PERMITIDOS: str = "*"
    # Orígenes CORS exactos, separados por comas. Vacío = solo mismo origen.
    # En desarrollo también se admite el servidor de Vite en loopback.
    CORS_ORIGENES: str = ""

    # ------------------------------------------------------------ servidor
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    # Un proceso: el limitador de intentos vive en memoria por proceso.
    WEB_CONCURRENCY: int = 1
    TIMEOUT_KEEP_ALIVE: int = 5
    # Proxy inverso confiable. Vacío = se ignoran X-Forwarded-*.
    # IPs o redes CIDR exactas del proxy separadas por comas (p. ej.
    # 10.0.0.0/8). En produccion se exigen redes acotadas: se rechazan "*",
    # 0.0.0.0/0, ::/0 y prefijos más amplios que /8 (IPv4) o /32 (IPv6).
    # "*" solo se admite en desarrollo/pruebas.
    PROXY_IPS_CONFIABLES: str = ""
    # Cuántos proxies confiables agregan una entrada a X-Forwarded-For. La
    # IP del cliente es la entrada número PROXY_SALTOS desde la derecha.
    PROXY_SALTOS: int = 1

    # ---------------------------------------------------------- frontend
    # Servir el build de React en el mismo origen que /api.
    SERVIR_FRONTEND: bool = False
    FRONTEND_DIST: str = str(FRONTEND_DIST_POR_DEFECTO)

    # ------------------------------------------------------------- tareas
    # Programa de salidas de demostración al arrancar (solo inserta las que
    # faltan; nunca DDL ni cambios de horarios/precios existentes). Sin
    # valor: activo en desarrollo/pruebas y DESACTIVADO en produccion; allí
    # solo se activa con PROGRAMA_DEMO_AL_ARRANCAR=true explícito.
    PROGRAMA_DEMO_AL_ARRANCAR: bool | None = None

    # ------------------------------------------------------------ registro
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    class Config:
        env_file = str(BASE_DIR / ".env")
        # Variables ajenas a la API (p. ej. del seed) no impiden el arranque.
        extra = "ignore"
        # `VARIABLE=` vacía equivale a no definirla (se usa el valor por defecto).
        env_ignore_empty = True

    # -------------------------------------------------------- validadores
    @field_validator("ENTORNO")
    @classmethod
    def _validar_entorno(cls, valor: str) -> str:
        valor = (valor or "").strip().lower()
        if valor not in ENTORNOS:
            raise ValueError(f"ENTORNO debe ser uno de {list(ENTORNOS)}")
        return valor

    @field_validator("DATABASE_URL")
    @classmethod
    def _validar_url_bd(cls, valor: str) -> str:
        valor = normalizar_url_bd(valor)
        try:
            url = make_url(valor)
        except Exception:
            # Sin el valor: puede contener la contraseña.
            raise ValueError("DATABASE_URL no es una URL válida") from None
        if url.get_backend_name() not in MOTORES_SOPORTADOS:
            raise ValueError("DATABASE_URL debe ser sqlite:// o postgresql://")
        if url.get_backend_name() == "postgresql":
            if url.get_driver_name() != "psycopg2":
                raise ValueError("DATABASE_URL de PostgreSQL debe usar el driver psycopg2")
            # Un parámetro repetido (p. ej. dos `host` o dos `sslmode`) vuelve
            # ambiguo el destino o el cifrado efectivos.
            if any(isinstance(v, tuple) for v in url.query.values()):
                raise ValueError("DATABASE_URL no admite parámetros repetidos")
            sslmode = url.query.get("sslmode")
            if sslmode is not None and sslmode not in (
                "disable", "allow", "prefer", *SSLMODES_CIFRADOS
            ):
                raise ValueError("DATABASE_URL tiene un sslmode desconocido")
        return valor

    @field_validator("SECRET_KEY")
    @classmethod
    def _validar_clave(cls, valor: str) -> str:
        valor = (valor or "").strip()
        if valor.lower() in CLAVES_PROHIBIDAS or len(valor) < LARGO_MINIMO_CLAVE:
            raise ValueError(
                f"SECRET_KEY debe ser aleatoria y tener al menos {LARGO_MINIMO_CLAVE} caracteres. "
                "Genera una con: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        return valor

    @field_validator("ALGORITHM")
    @classmethod
    def _validar_algoritmo(cls, valor: str) -> str:
        valor = (valor or "").strip().upper()
        if valor not in ALGORITMOS_PERMITIDOS:
            raise ValueError(f"ALGORITHM debe ser uno de {sorted(ALGORITMOS_PERMITIDOS)}")
        return valor

    @field_validator("ACCESS_TOKEN_EXPIRE_MINUTES")
    @classmethod
    def _validar_expiracion(cls, valor: int) -> int:
        if not 1 <= valor <= 24 * 60:
            raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES debe estar entre 1 y 1440")
        return valor

    @field_validator("DB_POOL_SIZE")
    @classmethod
    def _validar_pool(cls, valor: int) -> int:
        if not 1 <= valor <= 50:
            raise ValueError("DB_POOL_SIZE debe estar entre 1 y 50")
        return valor

    @field_validator("DB_MAX_OVERFLOW")
    @classmethod
    def _validar_overflow(cls, valor: int) -> int:
        if not 0 <= valor <= 50:
            raise ValueError("DB_MAX_OVERFLOW debe estar entre 0 y 50")
        return valor

    @field_validator("DB_POOL_TIMEOUT", "DB_CONNECT_TIMEOUT")
    @classmethod
    def _validar_esperas(cls, valor: int) -> int:
        if not 1 <= valor <= 120:
            raise ValueError("los tiempos de espera de la base deben estar entre 1 y 120 s")
        return valor

    @field_validator("DB_POOL_RECYCLE")
    @classmethod
    def _validar_reciclaje(cls, valor: int) -> int:
        if not 30 <= valor <= 3600:
            raise ValueError("DB_POOL_RECYCLE debe estar entre 30 y 3600 s")
        return valor

    @field_validator("DB_STATEMENT_TIMEOUT_MS")
    @classmethod
    def _validar_statement_timeout(cls, valor: int) -> int:
        if not 0 <= valor <= 600_000:
            raise ValueError("DB_STATEMENT_TIMEOUT_MS debe estar entre 0 y 600000")
        return valor

    @field_validator("HOST")
    @classmethod
    def _validar_host(cls, valor: str) -> str:
        valor = (valor or "").strip()
        try:
            ipaddress.ip_address(valor)
            return valor
        except ValueError:
            pass
        if not _NOMBRE_HOST.match(valor):
            raise ValueError("HOST debe ser una IP (p. ej. 127.0.0.1 o 0.0.0.0) o un nombre de host")
        return valor

    @field_validator("PORT")
    @classmethod
    def _validar_puerto(cls, valor: int) -> int:
        if not 1 <= valor <= 65535:
            raise ValueError("PORT debe estar entre 1 y 65535")
        return valor

    @field_validator("WEB_CONCURRENCY")
    @classmethod
    def _validar_workers(cls, valor: int) -> int:
        if not 1 <= valor <= 8:
            raise ValueError("WEB_CONCURRENCY debe estar entre 1 y 8")
        return valor

    @field_validator("TIMEOUT_KEEP_ALIVE")
    @classmethod
    def _validar_keep_alive(cls, valor: int) -> int:
        if not 1 <= valor <= 120:
            raise ValueError("TIMEOUT_KEEP_ALIVE debe estar entre 1 y 120 s")
        return valor

    @field_validator("PROXY_SALTOS")
    @classmethod
    def _validar_saltos(cls, valor: int) -> int:
        if not 1 <= valor <= 5:
            raise ValueError("PROXY_SALTOS debe estar entre 1 y 5")
        return valor

    @field_validator("PROXY_IPS_CONFIABLES")
    @classmethod
    def _validar_proxy(cls, valor: str) -> str:
        partes = _lista(valor)
        if "*" in partes and len(partes) > 1:
            raise ValueError("PROXY_IPS_CONFIABLES: '*' no se combina con otras entradas")
        for parte in partes:
            if parte == "*":
                continue
            try:
                # strict: la red debe escribirse exacta (10.0.0.0/8, no 10.1.2.3/8).
                ipaddress.ip_network(parte, strict=True)
            except ValueError:
                raise ValueError(
                    "PROXY_IPS_CONFIABLES admite IPs o redes CIDR exactas separadas por comas"
                ) from None
        return ",".join(partes)

    @field_validator("HOSTS_PERMITIDOS")
    @classmethod
    def _validar_hosts(cls, valor: str) -> str:
        partes = [p.lower() for p in _lista(valor)]
        for parte in partes:
            if parte == "*":
                continue
            nombre = parte[2:] if parte.startswith("*.") else parte
            if not nombre or any(c in nombre for c in "/:@ ") or "*" in nombre:
                raise ValueError("HOSTS_PERMITIDOS admite nombres de host sin esquema ni puerto")
        return ",".join(partes)

    @field_validator("CORS_ORIGENES")
    @classmethod
    def _validar_cors(cls, valor: str) -> str:
        origenes = []
        for parte in _lista(valor):
            origen = _origen_cors(parte)
            if origen is None:
                # Sin el valor recibido en el mensaje.
                raise ValueError(
                    "CORS_ORIGENES admite orígenes exactos http(s)://host[:puerto] "
                    "(sin comodines, credenciales, ruta ni puerto inválido)"
                )
            origenes.append(origen)
        return ",".join(origenes)

    @field_validator("LOG_LEVEL")
    @classmethod
    def _validar_nivel(cls, valor: str) -> str:
        valor = (valor or "").strip().upper()
        if valor not in NIVELES_LOG:
            raise ValueError(f"LOG_LEVEL debe ser uno de {list(NIVELES_LOG)}")
        return valor

    @field_validator("LOG_FORMAT")
    @classmethod
    def _validar_formato(cls, valor: str) -> str:
        valor = (valor or "").strip().lower()
        if valor not in FORMATOS_LOG:
            raise ValueError(f"LOG_FORMAT debe ser uno de {list(FORMATOS_LOG)}")
        return valor

    @model_validator(mode="after")
    def _validar_conjunto(self):
        if self.DOCS_ENABLED is None:
            self.DOCS_ENABLED = self.ENTORNO != "produccion"
        if self.PROGRAMA_DEMO_AL_ARRANCAR is None:
            self.PROGRAMA_DEMO_AL_ARRANCAR = self.ENTORNO != "produccion"
        # Render publica el nombre del servicio: se acepta sin repetirlo.
        externo = os.environ.get("RENDER_EXTERNAL_HOSTNAME", "").strip().lower()
        hosts = _lista(self.HOSTS_PERMITIDOS)
        if externo and "*" not in hosts and externo not in hosts:
            self.HOSTS_PERMITIDOS = ",".join([*hosts, externo])
        if self.ENTORNO == "produccion":
            self._validar_produccion()
        return self

    def _validar_produccion(self) -> None:
        errores = []
        if "DATABASE_URL" not in self.model_fields_set:
            errores.append("DATABASE_URL es obligatoria en produccion (no se usa la SQLite local por defecto)")
        else:
            url = make_url(self.DATABASE_URL)
            if url.get_backend_name() == "sqlite":
                ruta = url.database or ""
                if not self.PERMITIR_SQLITE_PRODUCCION:
                    errores.append(
                        "produccion requiere PostgreSQL; SQLite solo con PERMITIR_SQLITE_PRODUCCION=true "
                        "(una instancia con disco persistente)"
                    )
                elif not ruta or ruta == ":memory:" or not Path(ruta).is_absolute():
                    errores.append("DATABASE_URL de SQLite en produccion debe ser un archivo con ruta absoluta")
            else:
                local = _destino_pg_local(url)
                if url.query.get("sslmode") not in SSLMODES_CIFRADOS and not local:
                    errores.append(
                        "DATABASE_URL de PostgreSQL remoto requiere sslmode=require, verify-ca o verify-full"
                    )
                if not url.password and not local:
                    errores.append("DATABASE_URL de PostgreSQL remoto debe incluir credenciales")
        if self.DOCS_ENABLED:
            errores.append("DOCS_ENABLED debe ser false en produccion")
        proxies = _lista(self.PROXY_IPS_CONFIABLES)
        if "*" in proxies or any(not _red_acotada(p) for p in proxies):
            errores.append(
                "PROXY_IPS_CONFIABLES en produccion exige IPs o redes CIDR acotadas del proxy "
                "(sin '*', 0.0.0.0/0 ni ::/0)"
            )
        hosts = _lista(self.HOSTS_PERMITIDOS)
        if not hosts or "*" in hosts:
            errores.append("HOSTS_PERMITIDOS debe listar los dominios públicos en produccion (sin '*')")
        if any(urlsplit(o).scheme != "https" for o in _lista(self.CORS_ORIGENES)):
            errores.append("CORS_ORIGENES solo admite orígenes https en produccion")
        if errores:
            raise ValueError("; ".join(errores))

    # ---------------------------------------------------------- derivados
    @property
    def es_produccion(self) -> bool:
        return self.ENTORNO == "produccion"

    @property
    def hosts_permitidos(self) -> list[str]:
        return _lista(self.HOSTS_PERMITIDOS)

    @property
    def cors_origenes(self) -> list[str]:
        return _lista(self.CORS_ORIGENES)

    @property
    def proxy_ips_confiables(self) -> list[str]:
        return _lista(self.PROXY_IPS_CONFIABLES)

    @property
    def motor_bd(self) -> str:
        return make_url(self.DATABASE_URL).get_backend_name()


class ConfiguracionInvalida(RuntimeError):
    """Error de arranque sin los valores recibidos (pueden ser secretos)."""


def describir_error_configuracion(exc: ValidationError) -> str:
    """Campo y motivo de cada error, nunca `input_value` (p. ej. SECRET_KEY)."""
    lineas = []
    for error in exc.errors(include_input=False, include_url=False, include_context=False):
        campo = ".".join(str(p) for p in error.get("loc", ())) or "configuración"
        mensaje = str(error.get("msg", "valor inválido"))
        if mensaje.startswith("Value error, "):
            mensaje = mensaje[len("Value error, "):]
        lineas.append(f"- {campo}: {mensaje}")
    return "Configuración inválida en backend/.env o variables de entorno:\n" + "\n".join(lineas)


def cargar_settings(**valores) -> Settings:
    try:
        return Settings(**valores)
    except ValidationError as exc:
        # `from None`: la traza no encadena el ValidationError con los valores.
        raise ConfiguracionInvalida(describir_error_configuracion(exc)) from None


settings = cargar_settings()
