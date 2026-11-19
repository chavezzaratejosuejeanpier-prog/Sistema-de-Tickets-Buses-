"""PostgreSQL real y aislado para las pruebas de integración.

Fuentes, en este orden (sin ninguna, las pruebas se omiten con el motivo):

1. `BUSS_TEST_POSTGRES_URL`: URL de una base DESECHABLE cuyo nombre
   contiene "test" o "prueba" (p. ej. un contenedor local). Cada clase de
   prueba crea su propio esquema `buss_prueba_<aleatorio>` y lo elimina al
   terminar con DROP SCHEMA ... CASCADE; nunca toca otros esquemas.
2. `BUSS_TEST_POSTGRES_EFIMERO=1` con `initdb` y `pg_ctl` en PATH (o en
   `PG_BIN`): crea un clúster temporal que solo escucha en un socket Unix
   de un directorio temporal y lo destruye al terminar.

Nunca usa DATABASE_URL ni backend/.env: una base real no puede elegirse
por accidente. Solo datos sintéticos.
"""
import atexit
import os
import re
import secrets
import shutil
import subprocess
import tempfile
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url

ENV_URL = "BUSS_TEST_POSTGRES_URL"
ENV_EFIMERO = "BUSS_TEST_POSTGRES_EFIMERO"
_NOMBRE_SEGURO = re.compile(r"(test|prueba)", re.IGNORECASE)
_cluster = None


class PostgresNoDisponible(Exception):
    """Motivo para omitir las pruebas (texto sin credenciales)."""


def _binario(nombre: str) -> str | None:
    base = os.environ.get("PG_BIN")
    if base and (Path(base) / nombre).is_file():
        return str(Path(base) / nombre)
    encontrado = shutil.which(nombre)
    if encontrado:
        return encontrado
    for candidato in sorted(Path("/usr/lib/postgresql").glob(f"*/bin/{nombre}"), reverse=True):
        return str(candidato)
    return None


class _ClusterEfimero:
    def __init__(self):
        initdb, pg_ctl = _binario("initdb"), _binario("pg_ctl")
        if not initdb or not pg_ctl:
            raise PostgresNoDisponible("BUSS_TEST_POSTGRES_EFIMERO=1 pero no se encontró initdb/pg_ctl")
        self.pg_ctl = pg_ctl
        self.dir = tempfile.mkdtemp(prefix="buss-pg-")
        self.datos = os.path.join(self.dir, "datos")
        self.socket = os.path.join(self.dir, "s")
        os.mkdir(self.socket)
        self.puerto = 50000 + secrets.randbelow(10000)
        silencio = {"stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL, "check": True}
        subprocess.run(
            [initdb, "-D", self.datos, "-A", "trust", "-U", "postgres", "-E", "UTF8", "--no-instructions"],
            **silencio,
        )
        opciones = f"-c listen_addresses='' -k {self.socket} -p {self.puerto} -c fsync=off"
        subprocess.run(
            [pg_ctl, "-D", self.datos, "-o", opciones, "-l", os.path.join(self.dir, "log"), "-w", "start"],
            **silencio,
        )
        atexit.register(self.detener)
        base = create_engine(self.url("postgres"), isolation_level="AUTOCOMMIT")
        try:
            with base.connect() as con:
                con.execute(text("CREATE DATABASE buss_prueba"))
        finally:
            base.dispose()

    def url(self, base: str = "buss_prueba") -> str:
        return f"postgresql+psycopg2://postgres@/{base}?host={self.socket}&port={self.puerto}"

    def detener(self):
        if os.path.isdir(self.dir):
            subprocess.run(
                [self.pg_ctl, "-D", self.datos, "-m", "immediate", "-w", "stop"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
            )
            shutil.rmtree(self.dir, ignore_errors=True)


def url_postgres() -> str:
    global _cluster
    url = os.environ.get(ENV_URL, "").strip()
    if url:
        url = url.replace("postgres://", "postgresql+psycopg2://", 1).replace(
            "postgresql://", "postgresql+psycopg2://", 1
        )
        try:
            destino = make_url(url)
        except Exception:
            raise PostgresNoDisponible(f"{ENV_URL} no es una URL válida") from None
        if destino.get_backend_name() != "postgresql":
            raise PostgresNoDisponible(f"{ENV_URL} debe ser postgresql://")
        if not _NOMBRE_SEGURO.search(destino.database or ""):
            raise PostgresNoDisponible(
                f"{ENV_URL}: el nombre de la base debe contener 'test' o 'prueba' (protección contra bases reales)"
            )
        return url
    if os.environ.get(ENV_EFIMERO) == "1":
        if _cluster is None:
            try:
                _cluster = _ClusterEfimero()
            except subprocess.CalledProcessError:
                raise PostgresNoDisponible("no se pudo iniciar el clúster PostgreSQL efímero") from None
        return _cluster.url()
    raise PostgresNoDisponible(f"define {ENV_URL} (base desechable) o {ENV_EFIMERO}=1 con initdb disponible")


class EsquemaAislado:
    """Esquema propio por clase de prueba, con search_path fijado por conexión."""

    def __init__(self, prefijo: str = "buss_prueba"):
        self.url = url_postgres()
        self.nombre = f"{prefijo}_{secrets.token_hex(6)}"
        admin = create_engine(self.url, isolation_level="AUTOCOMMIT")
        try:
            with admin.connect() as con:
                con.execute(text(f'CREATE SCHEMA "{self.nombre}"'))
        finally:
            admin.dispose()
        self.engine: Engine = create_engine(
            self.url,
            connect_args={"options": f"-c search_path={self.nombre}", "connect_timeout": 10},
            pool_size=12,
            max_overflow=12,
            pool_pre_ping=True,
            hide_parameters=True,
        )

    def eliminar(self):
        self.engine.dispose()
        admin = create_engine(self.url, isolation_level="AUTOCOMMIT")
        try:
            with admin.connect() as con:
                con.execute(text(f'DROP SCHEMA IF EXISTS "{self.nombre}" CASCADE'))
        finally:
            admin.dispose()
