"""Migraciones idempotentes para bases existentes.

`Base.metadata.create_all` crea tablas nuevas pero no agrega columnas ni
índices a tablas que ya existen. Este módulo:

- añade a `reservas` las columnas `ruc`, `user_id` y `metodo_pago` sin tocar
  los datos: las filas históricas quedan con `user_id` NULL (sin
  reasignación por email ni por ningún otro criterio) y solo un ADMIN puede
  consultarlas;
- crea el índice único parcial de asientos `uq_ticket_ruta_asiento` si falta
  y actualiza su predicado si es el antiguo (solo excluía CANCELADO).

Toda modificación de un índice va en una transacción explícita: en SQLite
se abre con `BEGIN IMMEDIATE` sobre una conexión sin transacciones
implícitas del driver (pysqlite confirma el DDL por su cuenta si no), de
modo que ante cualquier error el ROLLBACK deja el índice anterior intacto.
En PostgreSQL el DDL ya es transaccional.

Se puede ejecutar cualquier número de veces; cada paso comprueba el
esquema antes de modificarlo. Nunca borra tablas, columnas ni filas.
"""
import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection, Engine

logger = logging.getLogger("buss.migraciones")

INDICE_ASIENTO = "uq_ticket_ruta_asiento"
COLUMNAS_INDICE_ASIENTO = ["route_id", "numero_asiento"]
# Estados que el predicado debe excluir (ver PREDICADO_ASIENTO_OCUPADO).
ESTADOS_LIBRES_INDICE = ("CANCELADO", "DISPONIBLE")


class MigracionFallida(RuntimeError):
    pass


def _normalizar_sql(sql: str) -> str:
    return " ".join((sql or "").replace('"', "").lower().split())


def _sql_crear_indice() -> str:
    from .models.ticket import PREDICADO_ASIENTO_OCUPADO

    return (
        f"CREATE UNIQUE INDEX {INDICE_ASIENTO} ON tickets ({', '.join(COLUMNAS_INDICE_ASIENTO)}) "
        f"WHERE {PREDICADO_ASIENTO_OCUPADO}"
    )


# ------------------------------------------------------------------ SQLite
def _estado_indice_sqlite(con: Connection) -> str:
    """'ok', 'falta' o 'desactualizado'."""
    from .models.ticket import PREDICADO_ASIENTO_OCUPADO

    fila = con.execute(
        text("SELECT sql FROM sqlite_master WHERE type='index' AND name=:n"),
        {"n": INDICE_ASIENTO},
    ).fetchone()
    if fila is None:
        return "falta"
    sql = _normalizar_sql(fila[0])
    if (
        sql.startswith("create unique index")
        and _normalizar_sql(PREDICADO_ASIENTO_OCUPADO) in sql
        and "(route_id, numero_asiento)" in sql
    ):
        return "ok"
    return "desactualizado"


def _indice_asiento_sqlite(engine: Engine) -> bool:
    """Crea o actualiza el índice en una transacción SQLite explícita."""
    with engine.connect() as base:
        con = base.execution_options(isolation_level="AUTOCOMMIT")
        if not inspect(con).has_table("tickets"):
            return False
        # BEGIN IMMEDIATE: toma el bloqueo de escritura antes de leer el
        # esquema, así otro proceso no puede cambiarlo entre lectura y DDL.
        con.exec_driver_sql("BEGIN IMMEDIATE")
        try:
            estado = _estado_indice_sqlite(con)
            if estado == "ok":
                con.exec_driver_sql("ROLLBACK")
                return False
            if estado == "desactualizado":
                con.exec_driver_sql(f"DROP INDEX {INDICE_ASIENTO}")
            con.exec_driver_sql(_sql_crear_indice())
            con.exec_driver_sql("COMMIT")
        except Exception:
            con.exec_driver_sql("ROLLBACK")
            raise
    return True


# -------------------------------------------------------------- PostgreSQL
def _estado_indice_postgresql(con: Connection) -> str:
    fila = con.execute(text(
        """
        SELECT i.indisunique,
               pg_get_expr(i.indpred, i.indrelid) AS predicado,
               ARRAY(
                   SELECT a.attname FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, n)
                   JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
                   ORDER BY k.n
               ) AS columnas
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_class t ON t.oid = i.indrelid
        WHERE c.relname = :n AND t.relname = 'tickets'
          AND pg_table_is_visible(t.oid)
        """
    ), {"n": INDICE_ASIENTO}).fetchone()
    if fila is None:
        return "falta"
    unico, predicado, columnas = fila
    predicado = (predicado or "").upper()
    if (
        unico
        and list(columnas) == COLUMNAS_INDICE_ASIENTO
        and all(f"'{estado}'" in predicado for estado in ESTADOS_LIBRES_INDICE)
    ):
        return "ok"
    return "desactualizado"


def _indice_asiento_postgresql(con: Connection) -> bool:
    if not inspect(con).has_table("tickets"):
        return False
    estado = _estado_indice_postgresql(con)
    if estado == "ok":
        return False
    if estado == "desactualizado":
        con.execute(text(f"DROP INDEX {INDICE_ASIENTO}"))
    con.execute(text(_sql_crear_indice()))
    return True


# --------------------------------------------------------------- reservas
def _columnas_reservas(con: Connection, cambios: list[str]) -> None:
    insp = inspect(con)
    if not insp.has_table("reservas"):
        return
    columnas = {c["name"] for c in insp.get_columns("reservas")}
    if "ruc" not in columnas:
        con.execute(text("ALTER TABLE reservas ADD COLUMN ruc VARCHAR"))
        cambios.append("reservas.ruc")
    if "user_id" not in columnas:
        con.execute(text("ALTER TABLE reservas ADD COLUMN user_id INTEGER REFERENCES users(id)"))
        cambios.append("reservas.user_id")
    if "metodo_pago" not in columnas:
        con.execute(text("ALTER TABLE reservas ADD COLUMN metodo_pago VARCHAR"))
        cambios.append("reservas.metodo_pago")
    indices = {i["name"] for i in inspect(con).get_indexes("reservas")}
    if "ix_reservas_user_id" not in indices:
        con.execute(text("CREATE INDEX IF NOT EXISTS ix_reservas_user_id ON reservas (user_id)"))
        cambios.append("ix_reservas_user_id")


def restricciones_heredadas(engine: Engine) -> list[str]:
    """Solo lectura (SQLite): índices únicos antiguos que rompen la venta.

    UNIQUE(codigo_reserva) impide reservas de varios asientos y un UNIQUE
    total de (route_id, numero_asiento) impide revender asientos cancelados.
    No se corrigen automáticamente: exigiría reconstruir la tabla.
    """
    if engine.dialect.name != "sqlite":
        return []
    encontrados = []
    with engine.connect() as con:
        if not inspect(con).has_table("tickets"):
            return []
        for fila in con.exec_driver_sql("PRAGMA index_list(tickets)").fetchall():
            nombre, unico = fila[1], bool(fila[2])
            parcial = bool(fila[4]) if len(fila) > 4 else False
            if not unico or nombre == INDICE_ASIENTO:
                continue
            columnas = [
                c[2] for c in con.exec_driver_sql(f'PRAGMA index_info("{nombre}")').fetchall()
            ]
            if columnas == ["codigo_reserva"] or (
                not parcial and sorted(columnas) == sorted(COLUMNAS_INDICE_ASIENTO)
            ):
                encontrados.append(nombre)
    return encontrados


def aplicar_migraciones(engine: Engine) -> list[str]:
    """Aplica los pasos pendientes y devuelve la lista de cambios.

    Si el índice de asientos no puede crearse (p. ej. asientos ocupados
    duplicados en datos heredados) se revierte, se registra sin datos y se
    lanza `MigracionFallida`: la API no debe arrancar sin esa garantía.
    """
    cambios: list[str] = []
    with engine.begin() as con:
        _columnas_reservas(con, cambios)

    try:
        if engine.dialect.name == "sqlite":
            creado = _indice_asiento_sqlite(engine)
        else:
            with engine.begin() as con:
                creado = _indice_asiento_postgresql(con) if con.dialect.name == "postgresql" else False
    except Exception as exc:
        logger.error("No se pudo crear o actualizar %s: %s", INDICE_ASIENTO, type(exc).__name__)
        raise MigracionFallida(
            f"No se pudo crear el índice {INDICE_ASIENTO}: revisa asientos ocupados duplicados "
            "en la tabla tickets. Los cambios del índice se revirtieron."
        ) from None
    if creado:
        cambios.append(INDICE_ASIENTO)
    if restricciones_heredadas(engine):
        logger.warning(
            "La tabla tickets conserva restricciones únicas heredadas; ver "
            "backend/INICIALIZACION_SEGURA.md (no se reparan automáticamente)."
        )
    return cambios
