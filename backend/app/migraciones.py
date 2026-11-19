"""Pasos idempotentes para adoptar bases existentes (anteriores a Alembic).

Ya no se ejecutan al arrancar la API: los invoca la revisión base de
Alembic (`alembic_migraciones/versions/0001_esquema_base.py`) dentro de la
transacción del comando explícito `python migrar.py`. `aplicar_migraciones`
se conserva para operar sobre un motor completo (pruebas y diagnóstico).

Una base creada por versiones anteriores con `create_all` no tiene las
columnas ni el índice nuevos. Este módulo:

- añade a `reservas` las columnas `ruc`, `user_id` y `metodo_pago` sin tocar
  los datos: las filas históricas quedan con `user_id` NULL (sin
  reasignación por email ni por ningún otro criterio) y solo un ADMIN puede
  consultarlas;
- crea el índice único parcial de asientos `uq_ticket_ruta_asiento` si falta
  o si su definición no es exactamente la esperada (predicado antiguo,
  invertido, índice inválido o no btree);
- crea los únicos esenciales que falten (placa, email, código de reserva);
- antes de sellar la revisión, `validar_esquema_compatible` rechaza
  esquemas no reconocidos (columnas, PK, claves foráneas, CHECK o únicos
  que impedirían vender varios asientos o revender). El rechazo revierte la
  transacción completa: no se reconstruyen tablas ni se borran datos.

Toda modificación de un índice va en una transacción explícita: en SQLite
se abre con `BEGIN IMMEDIATE` sobre una conexión sin transacciones
implícitas del driver (pysqlite confirma el DDL por su cuenta si no), de
modo que ante cualquier error el ROLLBACK deja el índice anterior intacto.
En PostgreSQL el DDL ya es transaccional.

Se puede ejecutar cualquier número de veces; cada paso comprueba el
esquema antes de modificarlo. Nunca borra tablas, columnas ni filas.
"""
import logging
import re

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection, Engine

logger = logging.getLogger("buss.migraciones")

INDICE_ASIENTO = "uq_ticket_ruta_asiento"
COLUMNAS_INDICE_ASIENTO = ["route_id", "numero_asiento"]
# Estados que el predicado debe excluir (ver PREDICADO_ASIENTO_OCUPADO).
ESTADOS_LIBRES_INDICE = ("CANCELADO", "DISPONIBLE")


class MigracionFallida(RuntimeError):
    pass


def _sql_crear_indice() -> str:
    from .models.ticket import PREDICADO_ASIENTO_OCUPADO

    return (
        f"CREATE UNIQUE INDEX {INDICE_ASIENTO} ON tickets ({', '.join(COLUMNAS_INDICE_ASIENTO)}) "
        f"WHERE {PREDICADO_ASIENTO_OCUPADO}"
    )


def _sql_canonico(sql: str) -> str:
    """Quita espacios, comillas de identificador y mayúsculas, salvo en literales.

    Los literales ('CANCELADO') conservan su contenido: en SQLite la
    comparación de cadenas distingue mayúsculas.
    """
    partes = re.split(r"('(?:[^']|'')*')", sql or "")
    salida = []
    for i, parte in enumerate(partes):
        if i % 2:
            salida.append(parte)
        else:
            salida.append(re.sub(r"[\s\"`\[\]]", "", parte).lower())
    canonico = "".join(salida)
    return canonico.replace("createuniqueindexifnotexists", "createuniqueindex", 1)


# ------------------------------------------------------------------ SQLite
def _estado_indice_sqlite(con: Connection) -> str:
    """'ok', 'falta' o 'desactualizado'.

    'ok' solo si la definición completa coincide con la esperada: un
    predicado invertido (`WHERE NOT (...)`) o ampliado (`... OR 1`) que
    contenga el texto esperado se trata como desactualizado.
    """
    fila = con.execute(
        text("SELECT sql FROM sqlite_master WHERE type='index' AND name=:n"),
        {"n": INDICE_ASIENTO},
    ).fetchone()
    if fila is None:
        return "falta"
    if _sql_canonico(fila[0]) == _sql_canonico(_sql_crear_indice()):
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
    # La primera columna exige además un índice utilizable y exacto: válido
    # (no un resto de CREATE INDEX CONCURRENTLY fallido), listo, vivo,
    # inmediato (no diferible), btree, sin expresiones ni columnas INCLUDE.
    fila = con.execute(text(
        """
        SELECT (i.indisunique AND i.indisvalid AND i.indisready AND i.indislive
                AND i.indimmediate AND i.indexprs IS NULL AND i.indnatts = 2
                AND am.amname = 'btree') AS unico_valido,
               pg_get_expr(i.indpred, i.indrelid) AS predicado,
               ARRAY(
                   SELECT a.attname FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, n)
                   JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
                   ORDER BY k.n
               ) AS columnas
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_am am ON am.oid = c.relam
        WHERE c.relname = :n AND t.relname = 'tickets'
          AND pg_table_is_visible(t.oid)
        """
    ), {"n": INDICE_ASIENTO}).fetchone()
    if fila is None:
        return "falta"
    unico, predicado, columnas = fila
    if unico and list(columnas) == COLUMNAS_INDICE_ASIENTO and predicado_pg_correcto(predicado):
        return "ok"
    return "desactualizado"


# Formas exactas (sin espacios ni paréntesis) en que PostgreSQL devuelve
# `estado NOT IN ('CANCELADO', 'DISPONIBLE')` con pg_get_expr.
_TIPO_PG = r"(?:text|charactervarying|varchar|estadoticket)"
_COLUMNA_PG = rf"estado(?:::{_TIPO_PG})?"
_LITERAL_PG = rf"'([A-Z_]+)'(?:::{_TIPO_PG})?"
_FORMAS_PREDICADO_PG = (
    # estado <> ALL (ARRAY['CANCELADO'::estadoticket, 'DISPONIBLE'::estadoticket])
    re.compile(rf"{_COLUMNA_PG}<>ALLARRAY\[(?P<lista>{_LITERAL_PG}(?:,{_LITERAL_PG})*)\](?:::{_TIPO_PG}\[\])?"),
    # estado <> ALL ('{CANCELADO,DISPONIBLE}'::estadoticket[])
    re.compile(rf"{_COLUMNA_PG}<>ALL'\{{(?P<lista>[A-Z_]+(?:,[A-Z_]+)*)\}}'::{_TIPO_PG}\[\]"),
    # estado NOT IN ('CANCELADO', 'DISPONIBLE')
    re.compile(rf"{_COLUMNA_PG}NOTIN(?P<lista>{_LITERAL_PG}(?:,{_LITERAL_PG})*)"),
)


def predicado_pg_correcto(predicado: str | None) -> bool:
    """¿El predicado reflejado es exactamente `estado NOT IN (estados libres)`?

    PostgreSQL normaliza `estado NOT IN ('CANCELADO', 'DISPONIBLE')` de
    varias formas según el tipo de la columna, p. ej.
    `estado <> ALL (ARRAY['CANCELADO'::estadoticket, ...])` o
    `estado <> ALL ('{CANCELADO,DISPONIBLE}'::estadoticket[])`.

    Se exige la estructura completa (coincidencia total, sin NOT, OR, AND,
    IS ni otros operadores): un predicado invertido como
    `NOT (estado <> ALL (...))` menciona los mismos estados pero no protege.
    Quitar los paréntesis es seguro porque la coincidencia total no admite
    ningún otro operador que pudiera agruparse.
    """
    compacto = re.sub(r"[\s()]", "", predicado or "")
    for forma in _FORMAS_PREDICADO_PG:
        coincidencia = forma.fullmatch(compacto)
        if coincidencia:
            estados = [e.strip("'").split("::")[0].strip("'") for e in coincidencia["lista"].split(",")]
            return sorted(estados) == sorted(ESTADOS_LIBRES_INDICE)
    return False


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


def columnas_reservas(con: Connection) -> list[str]:
    """Añade las columnas e índice faltantes de `reservas` en `con`."""
    cambios: list[str] = []
    _columnas_reservas(con, cambios)
    return cambios


def asegurar_indice_asiento(con: Connection) -> bool:
    """Crea o actualiza el índice de asientos dentro de la transacción de `con`.

    Pensado para el comando de migración, que ya abrió la transacción (en
    SQLite con BEGIN IMMEDIATE). Ante duplicados activos lanza
    `MigracionFallida` sin datos; quien llama revierte todo.
    """
    try:
        if con.dialect.name == "postgresql":
            return _indice_asiento_postgresql(con)
        if con.dialect.name != "sqlite" or not inspect(con).has_table("tickets"):
            return False
        estado = _estado_indice_sqlite(con)
        if estado == "ok":
            return False
        if estado == "desactualizado":
            con.exec_driver_sql(f"DROP INDEX {INDICE_ASIENTO}")
        con.exec_driver_sql(_sql_crear_indice())
        return True
    except Exception as exc:
        logger.error("No se pudo crear o actualizar %s: %s", INDICE_ASIENTO, type(exc).__name__)
        raise MigracionFallida(
            f"No se pudo crear el índice {INDICE_ASIENTO}: revisa asientos ocupados duplicados "
            "en la tabla tickets. La migración se revirtió completa."
        ) from None


def restricciones_heredadas_en(con: Connection) -> list[str]:
    """Como `restricciones_heredadas`, sobre una conexión ya abierta."""
    if con.dialect.name != "sqlite" or not inspect(con).has_table("tickets"):
        return []
    encontrados = []
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


def restricciones_heredadas(engine: Engine) -> list[str]:
    """Solo lectura (SQLite): índices únicos antiguos que rompen la venta.

    UNIQUE(codigo_reserva) impide reservas de varios asientos y un UNIQUE
    total de (route_id, numero_asiento) impide revender asientos cancelados.
    No se corrigen automáticamente: exigiría reconstruir la tabla.
    """
    if engine.dialect.name != "sqlite":
        return []
    with engine.connect() as con:
        return restricciones_heredadas_en(con)


# --------------------------------------------- compatibilidad del esquema
# Columnas de la revisión base. Las marcadas True pueden ser NOT NULL en una
# base heredada; el resto debe admitir NULL porque la aplicación puede
# insertarlas sin valor.
COLUMNAS_ESQUEMA = {
    "buses": {"id": True, "placa": True, "modelo": True, "tipo": False, "capacidad_piso1": False,
              "capacidad_piso2": False, "total_asientos": False},
    "users": {"id": True, "email": True, "nombre": True, "hashed_password": True, "rol": False,
              "is_active": False},
    "routes": {"id": True, "origen": True, "destino": True, "fecha_salida": True, "hora_salida": True,
               "duracion_horas": False, "precio_base": True, "precio_vip": False, "bus_id": True},
    "reservas": {"id": True, "codigo": True, "email": False, "ruc": False, "subtotal": True, "igv": True,
                 "total_pagado": True, "cantidad_asientos": True, "estado": True, "fecha_emision": False,
                 "user_id": False, "metodo_pago": False},
    "tickets": {"id": True, "route_id": True, "numero_asiento": True, "piso": False, "tipo_documento": False,
                "documento": False, "nombres": False, "apellido_paterno": False, "apellido_materno": False,
                "sexo": False, "fecha_nacimiento": False, "telefono": False, "precio_pagado": False,
                "estado": True, "codigo_reserva": False, "creado_en": False},
}
# Columnas que añade columnas_reservas(): pueden faltar antes de los pasos aditivos.
COLUMNAS_ADITIVAS = {"reservas": {"ruc", "user_id", "metodo_pago"}}
# (tabla, columnas locales, tabla referida, columnas referidas): exactamente estas.
CLAVES_FORANEAS = {
    "buses": set(),
    "users": set(),
    "routes": {(("bus_id",), "buses", ("id",))},
    "reservas": {(("user_id",), "users", ("id",))},
    "tickets": {(("route_id",), "routes", ("id",))},
}
# Valores que deben caber en columnas enumeradas (tipo enum o VARCHAR(n)).
VALORES_COLUMNA = {
    ("tickets", "estado"): ("DISPONIBLE", "RESERVADO", "VENDIDO", "CANCELADO", "USADO"),
    ("users", "rol"): ("ADMIN", "VENDEDOR", "CLIENTE"),
    ("buses", "tipo"): ("ECONOMICO", "EJECUTIVO", "PREMIUM"),
}
ESTADOS_RESERVA = ("PAGADA", "CANCELADA", "REEMBOLSADA", "USADA")
# Únicos esenciales (columna única completa, no parcial). Si faltan se crean
# con estos nombres; con duplicados la creación falla y todo se revierte.
UNICOS_ESENCIALES = (
    ("buses", "placa", "uq_buses_placa"),
    ("users", "email", "uq_users_email"),
    ("reservas", "codigo", "uq_reservas_codigo"),
)
# Únicos admitidos en tablas de venta además de la PK y de INDICE_ASIENTO.
# Cualquier otro (p. ej. UNIQUE(codigo_reserva) o UNIQUE total de
# (route_id, numero_asiento)) impediría vender varios asientos o revender.
UNICOS_ADMITIDOS = {"tickets": set(), "reservas": {("codigo",)}}
# CHECK admitidos en tablas de venta: solo `estado IN (...)` que incluya
# todos los estados que usa la aplicación (ck_reserva_estado o el CHECK de
# Enum que generaban versiones antiguas de SQLAlchemy). Cualquier otro se rechaza.
CHECKS_ADMITIDOS = {
    "tickets": ("estado", VALORES_COLUMNA[("tickets", "estado")]),
    "reservas": ("estado", ESTADOS_RESERVA),
}


def _rechazar(motivo: str) -> None:
    logger.error("Esquema heredado incompatible: %s", motivo)
    raise MigracionFallida(
        f"Esquema heredado no reconocido o incompatible ({motivo}). La migración se revirtió "
        "completa sin modificar datos; ver backend/INICIALIZACION_SEGURA.md."
    )


def _es_parcial(indice: dict) -> bool:
    opciones = indice.get("dialect_options") or {}
    # Las cláusulas son expresiones SQLAlchemy (TextClause): coaccionarlas a bool
    # lanza TypeError, así que solo se comprueba su presencia.
    return any(opciones.get(clave) is not None for clave in ("sqlite_where", "postgresql_where"))


def _unicos(insp, tabla: str) -> list[tuple[str | None, tuple, bool]]:
    """(nombre, columnas, parcial) de restricciones e índices únicos de `tabla`."""
    unicos = [(u.get("name"), tuple(u["column_names"]), False) for u in insp.get_unique_constraints(tabla)]
    for ix in insp.get_indexes(tabla):
        if ix.get("unique"):
            unicos.append((ix.get("name"), tuple(ix.get("column_names") or ()), _es_parcial(ix)))
    return unicos


def validar_columnas_base(con: Connection) -> None:
    """Antes de los pasos aditivos: tablas, columnas y PK reconocibles."""
    _validar_columnas(inspect(con), aditivas_pendientes=True)


def _validar_columnas(insp, aditivas_pendientes: bool) -> None:
    for tabla, columnas in COLUMNAS_ESQUEMA.items():
        if not insp.has_table(tabla):
            _rechazar(f"falta la tabla {tabla}")
        reflejadas = {c["name"]: c for c in insp.get_columns(tabla)}
        pendientes = COLUMNAS_ADITIVAS.get(tabla, set()) if aditivas_pendientes else set()
        for nombre, puede_ser_not_null in columnas.items():
            if nombre not in reflejadas:
                if nombre in pendientes:
                    continue
                _rechazar(f"falta la columna {tabla}.{nombre}")
            if not puede_ser_not_null and not reflejadas[nombre].get("nullable", True):
                _rechazar(f"{tabla}.{nombre} no admite NULL")
        for nombre, columna in reflejadas.items():
            # Una columna extra NOT NULL sin valor por defecto haría fallar los INSERT.
            if (
                nombre not in columnas
                and not columna.get("nullable", True)
                and columna.get("default") is None
                and columna.get("autoincrement") is not True
            ):
                _rechazar(f"columna adicional obligatoria {tabla}.{nombre}")
        pk = list(insp.get_pk_constraint(tabla).get("constrained_columns") or [])
        if pk != ["id"]:
            _rechazar(f"la clave primaria de {tabla} debe ser (id)")
        for (t, columna), valores in VALORES_COLUMNA.items():
            if t != tabla or columna not in reflejadas:
                continue
            tipo = reflejadas[columna]["type"]
            enums = getattr(tipo, "enums", None)
            largo = getattr(tipo, "length", None)
            if enums and not set(valores) <= set(enums):
                _rechazar(f"{tabla}.{columna} no admite todos los valores requeridos")
            if largo is not None and largo < max(len(v) for v in valores):
                _rechazar(f"{tabla}.{columna} es demasiado corta")


def asegurar_unicos_esenciales(con: Connection) -> list[str]:
    """Crea los índices únicos esenciales que falten (solo CREATE INDEX)."""
    insp = inspect(con)
    creados = []
    for tabla, columna, nombre in UNICOS_ESENCIALES:
        if not insp.has_table(tabla):
            continue
        if any(cols == (columna,) and not parcial for _, cols, parcial in _unicos(insp, tabla)):
            continue
        try:
            con.execute(text(f"CREATE UNIQUE INDEX {nombre} ON {tabla} ({columna})"))
        except Exception as exc:
            logger.error("No se pudo crear %s: %s", nombre, type(exc).__name__)
            raise MigracionFallida(
                f"No se pudo crear el índice único {nombre}: revisa valores duplicados de "
                f"{tabla}.{columna}. La migración se revirtió completa."
            ) from None
        creados.append(nombre)
    return creados


def _valores_check(sqltext: str, columna: str) -> set[str] | None:
    """Valores de un CHECK `columna IN (...)` (o su forma PostgreSQL `= ANY`).

    None si el CHECK tiene cualquier otra estructura.
    """
    compacto = re.sub(r"[\s()]", "", sqltext or "")
    literal = r"'[A-Z_]+'(?:::\w+)?"
    patron = (
        rf"{re.escape(columna)}(?:::\w+)?(?:(?i:IN)(?P<a>{literal}(?:,{literal})*)"
        rf"|=ANYARRAY\[(?P<b>{literal}(?:,{literal})*)\](?:::\w+\[\])?)"
    )
    coincidencia = re.fullmatch(patron, compacto)
    if not coincidencia:
        return None
    return set(re.findall(r"'([A-Z_]+)'", coincidencia["a"] or coincidencia["b"]))


def validar_esquema_compatible(con: Connection) -> None:
    """Tras los pasos aditivos y antes de sellar la revisión.

    Comprueba columnas, PK, claves foráneas exactas, únicos esenciales,
    el índice parcial de asientos y la ausencia de restricciones únicas o
    CHECK que impedirían vender varios asientos por reserva o revender
    asientos liberados. Ante cualquier discrepancia lanza `MigracionFallida`
    (quien llama revierte la transacción completa). Nunca corrige
    reconstruyendo tablas ni borra datos.
    """
    insp = inspect(con)
    _validar_columnas(insp, aditivas_pendientes=False)
    for tabla, esperadas in CLAVES_FORANEAS.items():
        reflejadas = {
            (tuple(fk["constrained_columns"]), fk["referred_table"], tuple(fk["referred_columns"]))
            for fk in insp.get_foreign_keys(tabla)
        }
        if reflejadas != esperadas:
            _rechazar(f"claves foráneas de {tabla} no reconocidas")
    for tabla, columna, _ in UNICOS_ESENCIALES:
        if not any(cols == (columna,) and not parcial for _, cols, parcial in _unicos(insp, tabla)):
            _rechazar(f"falta el índice único de {tabla}.{columna}")
    for tabla, admitidos in UNICOS_ADMITIDOS.items():
        for nombre, cols, _ in _unicos(insp, tabla):
            if tabla == "tickets" and nombre == INDICE_ASIENTO:
                continue
            if "id" in cols or cols in admitidos:
                continue
            _rechazar(f"restricción única incompatible en {tabla}")
    for tabla, (columna, requeridos) in CHECKS_ADMITIDOS.items():
        for check in insp.get_check_constraints(tabla):
            valores = _valores_check(check.get("sqltext"), columna)
            if valores is None or not set(requeridos) <= valores:
                _rechazar(f"restricción CHECK no reconocida o incompatible en {tabla}")
    if con.dialect.name == "postgresql":
        if _estado_indice_postgresql(con) != "ok":
            _rechazar(f"índice {INDICE_ASIENTO} inválido")
    elif con.dialect.name == "sqlite":
        if _estado_indice_sqlite(con) != "ok":
            _rechazar(f"índice {INDICE_ASIENTO} inválido")


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
