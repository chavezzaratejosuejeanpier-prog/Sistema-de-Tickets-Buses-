"""Migraciones idempotentes para bases existentes.

`Base.metadata.create_all` crea tablas nuevas pero no agrega columnas a
tablas que ya existen. Este módulo añade las columnas de titularidad y
modalidad de pago a `reservas` sin tocar los datos: las filas históricas
quedan con `user_id` NULL (sin reasignación por email ni por ningún otro
criterio) y solo un ADMIN puede consultarlas.

Se puede ejecutar cualquier número de veces; cada paso comprueba el
esquema antes de modificarlo. Funciona en SQLite y PostgreSQL.
"""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def aplicar_migraciones(engine: Engine) -> list[str]:
    cambios: list[str] = []
    with engine.begin() as con:
        insp = inspect(con)
        if not insp.has_table("reservas"):
            return cambios
        columnas = {c["name"] for c in insp.get_columns("reservas")}
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
    return cambios
