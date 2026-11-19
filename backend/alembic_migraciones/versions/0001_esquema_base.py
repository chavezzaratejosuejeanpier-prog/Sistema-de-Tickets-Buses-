"""Esquema base (buses, users, routes, reservas, tickets) y adopción de bases previas.

Revisión: 0001_esquema_base
Anterior: ninguna

- Base vacía: crea las cinco tablas con el DDL explícito de esta revisión
  (no depende de los modelos actuales, que pueden cambiar en revisiones
  posteriores).
- Base creada por versiones anteriores con `create_all` (sin
  `alembic_version`): crea solo las tablas que falten, valida que las
  existentes sean reconocibles, aplica los pasos aditivos de
  `app/migraciones.py` (columnas de `reservas`, únicos esenciales e índice
  único parcial de asientos) y valida la compatibilidad completa antes de
  sellar. Nunca borra tablas, columnas ni filas ni reconstruye tablas.

Todo ocurre en la transacción del comando `python migrar.py`: si el esquema
heredado no es compatible (columnas o claves foráneas distintas, únicos
heredados que impiden vender varios asientos o revender) o un índice no
puede crearse (duplicados) se revierte la revisión completa, incluida la
tabla `alembic_version`.
"""
import logging

import sqlalchemy as sa
from alembic import op

from app import migraciones

revision = "0001_esquema_base"
down_revision = None
branch_labels = None
depends_on = None

logger = logging.getLogger("buss.migraciones")

ESTADOS_TICKET = ("DISPONIBLE", "RESERVADO", "VENDIDO", "CANCELADO", "USADO")


def _crear_buses() -> None:
    op.create_table(
        "buses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("placa", sa.String(), nullable=False),
        sa.Column("modelo", sa.String(), nullable=False),
        sa.Column("tipo", sa.Enum("ECONOMICO", "EJECUTIVO", "PREMIUM", name="bustipo"), nullable=True),
        sa.Column("capacidad_piso1", sa.Integer(), nullable=True),
        sa.Column("capacidad_piso2", sa.Integer(), nullable=True),
        sa.Column("total_asientos", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("placa"),
    )
    op.create_index("ix_buses_id", "buses", ["id"])


def _crear_users() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("nombre", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("rol", sa.Enum("ADMIN", "VENDEDOR", "CLIENTE", name="rolusuario"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def _crear_routes() -> None:
    op.create_table(
        "routes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("origen", sa.String(), nullable=False),
        sa.Column("destino", sa.String(), nullable=False),
        sa.Column("fecha_salida", sa.DateTime(), nullable=False),
        sa.Column("hora_salida", sa.String(), nullable=False),
        sa.Column("duracion_horas", sa.Float(), nullable=True),
        sa.Column("precio_base", sa.Float(), nullable=False),
        sa.Column("precio_vip", sa.Float(), nullable=True),
        sa.Column("bus_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["bus_id"], ["buses.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_routes_id", "routes", ["id"])
    op.create_index("ix_routes_origen", "routes", ["origen"])
    op.create_index("ix_routes_destino", "routes", ["destino"])


def _crear_reservas() -> None:
    op.create_table(
        "reservas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("ruc", sa.String(), nullable=True),
        sa.Column("subtotal", sa.Float(), nullable=False),
        sa.Column("igv", sa.Float(), nullable=False),
        sa.Column("total_pagado", sa.Float(), nullable=False),
        sa.Column("cantidad_asientos", sa.Integer(), nullable=False),
        sa.Column("estado", sa.String(), nullable=False),
        sa.Column("fecha_emision", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("metodo_pago", sa.String(), nullable=True),
        sa.CheckConstraint(
            "estado IN ('PAGADA', 'CANCELADA', 'REEMBOLSADA', 'USADA')",
            name="ck_reserva_estado",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reservas_id", "reservas", ["id"])
    op.create_index("ix_reservas_codigo", "reservas", ["codigo"], unique=True)
    op.create_index("ix_reservas_user_id", "reservas", ["user_id"])


def _crear_tickets() -> None:
    op.create_table(
        "tickets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("route_id", sa.Integer(), nullable=False),
        sa.Column("numero_asiento", sa.Integer(), nullable=False),
        sa.Column("piso", sa.Integer(), nullable=True),
        sa.Column("tipo_documento", sa.String(), nullable=True),
        sa.Column("documento", sa.String(), nullable=True),
        sa.Column("nombres", sa.String(), nullable=True),
        sa.Column("apellido_paterno", sa.String(), nullable=True),
        sa.Column("apellido_materno", sa.String(), nullable=True),
        sa.Column("sexo", sa.String(), nullable=True),
        sa.Column("fecha_nacimiento", sa.Date(), nullable=True),
        sa.Column("telefono", sa.String(), nullable=True),
        sa.Column("precio_pagado", sa.Float(), nullable=True),
        sa.Column("estado", sa.Enum(*ESTADOS_TICKET, name="estadoticket"), nullable=False),
        sa.Column("codigo_reserva", sa.String(), nullable=True),
        sa.Column("creado_en", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["route_id"], ["routes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tickets_id", "tickets", ["id"])
    op.create_index("ix_tickets_codigo_reserva", "tickets", ["codigo_reserva"])
    # El índice único parcial de asientos lo crea asegurar_indice_asiento()
    # con el mismo predicado que la consulta de disponibilidad.


# Orden compatible con las claves foráneas.
TABLAS = (
    ("buses", _crear_buses),
    ("users", _crear_users),
    ("routes", _crear_routes),
    ("reservas", _crear_reservas),
    ("tickets", _crear_tickets),
)


def upgrade() -> None:
    con = op.get_bind()
    existentes = set(sa.inspect(con).get_table_names())
    creadas = []
    for nombre, crear in TABLAS:
        if nombre not in existentes:
            crear()
            creadas.append(nombre)
    adoptadas = [n for n, _ in TABLAS if n in existentes]
    if adoptadas:
        logger.info("Adoptando tablas existentes sin versión: %s", ", ".join(adoptadas))
    # Columnas y PK reconocibles antes de alterar nada (p. ej. un `buses`
    # sin placa ni modelo no se adopta).
    migraciones.validar_columnas_base(con)
    # Pasos aditivos e idempotentes (también válidos sobre tablas recién creadas).
    migraciones.columnas_reservas(con)
    migraciones.asegurar_unicos_esenciales(con)
    migraciones.asegurar_indice_asiento(con)
    # Antes de que Alembic selle la revisión: cualquier incompatibilidad
    # (claves foráneas, CHECK, únicos heredados como UNIQUE(codigo_reserva)
    # o UNIQUE total de asientos) revierte toda la transacción.
    migraciones.validar_esquema_compatible(con)


def downgrade() -> None:
    # Revertir la base eliminaría todas las ventas: se restaura una copia.
    raise RuntimeError(
        "La revisión base no se revierte automáticamente: restaura una copia de seguridad verificada."
    )
