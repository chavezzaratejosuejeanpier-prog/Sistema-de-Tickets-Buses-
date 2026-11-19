"""Migración explícita y versionada del esquema (Alembic).

La API no crea ni altera tablas al arrancar: este comando es el único que
ejecuta DDL. Usa la DATABASE_URL del entorno o de backend/.env y nunca la
imprime.

    python migrar.py              # aplica las revisiones pendientes
    python migrar.py --estado     # muestra la revisión; código 3 si hay pendientes

Antes de migrar una base con datos reales: copia de seguridad verificada
(ver DESPLIEGUE_RENDER_NEON.md y backend/INICIALIZACION_SEGURA.md).
"""
import argparse
import sys

from app.core.config import settings
from app.core.http import resumen_traza
from app.database import engine
from app.esquema import estado, migrar
from app.migraciones import MigracionFallida

CODIGO_PENDIENTE = 3


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Aplica o consulta las migraciones del esquema.")
    parser.add_argument("--estado", action="store_true", help="Solo muestra la revisión actual y la requerida")
    args = parser.parse_args(argv)

    motor = settings.motor_bd
    if args.estado:
        try:
            info = estado(engine)
        except Exception as exc:
            print(f"No se pudo leer el estado del esquema ({motor}): {type(exc).__name__}")
            return 1
        print(f"Motor: {motor}")
        print(f"Revisión actual: {info['actual'] or '(sin versionar)'}")
        print(f"Revisión requerida: {info['requerida']}")
        print("Esquema al día." if info["al_dia"] else "Hay migraciones pendientes: ejecuta python migrar.py")
        return 0 if info["al_dia"] else CODIGO_PENDIENTE

    try:
        antes, despues = migrar()
    except MigracionFallida as exc:
        print(f"Migración revertida: {exc}")
        return 1
    except Exception as exc:
        # Sin mensaje: puede incluir SQL, parámetros o la URL.
        print(f"Migración revertida. El esquema no cambió. Detalle: {resumen_traza(exc)}")
        return 1
    finally:
        engine.dispose()
    if antes == despues:
        print(f"Motor: {motor}. Sin cambios: el esquema ya estaba en {despues}.")
    else:
        print(f"Motor: {motor}. Esquema actualizado: {antes or '(sin versionar)'} -> {despues}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
