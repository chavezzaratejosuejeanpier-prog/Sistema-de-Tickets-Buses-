"""Datos de demostración para DESARROLLO: buses del catálogo y salidas.

Requisitos (si falta alguno, no hace nada y termina con código 2):
- opt-in explícito: `python seed.py --desarrollo`;
- `DATABASE_URL` definida explícitamente (entorno o backend/.env) y de
  tipo SQLite en archivo. No hay valor por defecto ni ruta de respaldo: el
  seed nunca escribe en una base que no se haya indicado.

Nunca crea, modifica ni desactiva usuarios (el primer administrador se
crea con `bootstrap_admin.py`) y nunca reconstruye ni borra tablas: solo
crea las que faltan y aplica las migraciones aditivas de la API.
"""
import argparse
import sys

from sqlalchemy.engine import make_url

from app.core.catalogo import BUSES
from app.core.config import settings
from app.database import Base, SessionLocal, engine
from app.migraciones import MigracionFallida, aplicar_migraciones, restricciones_heredadas
from app.models.bus import Bus, BusTipo
from app.services import programa

CODIGO_RECHAZADO = 2


class SeedRechazado(RuntimeError):
    pass


def verificar_destino() -> str:
    """Devuelve la ruta del archivo SQLite de DATABASE_URL o lanza SeedRechazado."""
    if "DATABASE_URL" not in settings.model_fields_set:
        raise SeedRechazado(
            "DATABASE_URL no está definida. Indica una base SQLite de desarrollo, "
            "p. ej. DATABASE_URL=sqlite:////ruta/absoluta/dev.db"
        )
    try:
        url = make_url(settings.DATABASE_URL)
    except Exception:
        raise SeedRechazado("DATABASE_URL no es una URL válida") from None
    if url.get_backend_name() != "sqlite":
        raise SeedRechazado("El seed de demostración solo se ejecuta sobre SQLite de desarrollo")
    if not url.database or url.database == ":memory:" or url.database.startswith("file::memory:"):
        raise SeedRechazado("DATABASE_URL debe apuntar a un archivo SQLite")
    return url.database


def cargar_demo() -> tuple[int, int]:
    """Crea tablas faltantes, buses (si no hay) y salidas faltantes."""
    Base.metadata.create_all(bind=engine)
    aplicar_migraciones(engine)
    db = SessionLocal()
    try:
        buses = 0
        if db.query(Bus.id).first() is None:
            for datos in BUSES:
                db.add(Bus(**{**datos, "tipo": BusTipo(datos["tipo"])}))
            db.commit()
            buses = len(BUSES)
        salidas = programa.sincronizar_ventana(db)
    finally:
        db.close()
    return buses, salidas


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Carga buses y salidas de demostración en una base SQLite de desarrollo."
    )
    parser.add_argument(
        "--desarrollo", action="store_true",
        help="Confirma que la base de DATABASE_URL es de desarrollo (obligatorio)",
    )
    args = parser.parse_args(argv)

    if not args.desarrollo:
        print("Seed no ejecutado: es solo para desarrollo. Usa --desarrollo para confirmarlo.")
        return CODIGO_RECHAZADO
    try:
        verificar_destino()
    except SeedRechazado as exc:
        print(f"Seed no ejecutado: {exc}")
        return CODIGO_RECHAZADO

    try:
        buses, salidas = cargar_demo()
    except MigracionFallida as exc:
        print(f"Seed no ejecutado: {exc}")
        return 1

    print(f" buses creados: {buses}")
    print(f" salidas creadas: {salidas}")
    if restricciones_heredadas(engine):
        print(" AVISO: la tabla tickets tiene restricciones únicas heredadas; "
              "ver backend/INICIALIZACION_SEGURA.md")
    print("Listo. No se crearon ni modificaron usuarios (ver bootstrap_admin.py).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
