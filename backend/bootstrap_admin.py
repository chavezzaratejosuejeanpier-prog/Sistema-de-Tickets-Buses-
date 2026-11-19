"""Crea el primer administrador. No carga datos de ejemplo ni toca el esquema.

Uso interactivo (la contraseña se pide sin eco):

    python bootstrap_admin.py --email admin@tu-dominio.example

Uso no interactivo (solo variables de la sesión, nunca en archivos):

    BUSS_ADMIN_EMAIL=... BUSS_ADMIN_PASSWORD=... python bootstrap_admin.py

Reglas:
- Nunca modifica ni desactiva cuentas existentes: si el correo ya existe,
  termina con error sin cambiar nada.
- No crea ni repara tablas: la base debe estar migrada antes con
  `python migrar.py` (la API tampoco crea el esquema al arrancar).
- Nunca imprime la contraseña.
"""
import argparse
import getpass
import os
import sys

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, inspect

from app.core.security import MAX_BYTES_PASSWORD, hashear_password, password_demasiado_larga
from app.database import SessionLocal, engine
from app.models.user import RolUsuario, User

MIN_LARGO_PASSWORD_ADMIN = 12
ENV_ADMIN_EMAIL = "BUSS_ADMIN_EMAIL"
ENV_ADMIN_PASSWORD = "BUSS_ADMIN_PASSWORD"
ENV_ADMIN_NOMBRE = "BUSS_ADMIN_NOMBRE"
MAX_LARGO_NOMBRE = 80

_EMAIL = TypeAdapter(EmailStr)


class AdminInvalido(ValueError):
    """Error de validación; el mensaje nunca contiene la contraseña."""


def validar_email(email: str) -> str:
    email = (email or "").strip()
    if not email or len(email) > 254:
        raise AdminInvalido("Correo de administrador inválido")
    try:
        return _EMAIL.validate_python(email)
    except ValidationError:
        raise AdminInvalido("Correo de administrador inválido") from None


def validar_password_admin(password: str, email: str) -> None:
    if len(password) < MIN_LARGO_PASSWORD_ADMIN:
        raise AdminInvalido(f"La contraseña de administrador debe tener al menos {MIN_LARGO_PASSWORD_ADMIN} caracteres")
    if password_demasiado_larga(password):
        raise AdminInvalido(f"La contraseña no puede superar {MAX_BYTES_PASSWORD} bytes")
    if password.strip() != password or len(set(password)) < 4:
        raise AdminInvalido("La contraseña es demasiado simple")
    local = email.split("@", 1)[0].lower()
    if len(local) >= 4 and local in password.lower():
        raise AdminInvalido("La contraseña no puede contener el nombre del correo")


def _nombre(nombre: str | None) -> str:
    nombre = " ".join((nombre or "").split())[:MAX_LARGO_NOMBRE]
    if len(nombre) < 3 or any(not c.isprintable() for c in nombre):
        return "Administrador"
    return nombre


def esquema_listo() -> bool:
    return inspect(engine).has_table(User.__tablename__)


def crear_admin(db, email: str, password: str, nombre: str = "Administrador") -> User:
    """Crea una cuenta ADMIN nueva. Nunca modifica una existente."""
    email = validar_email(email)
    validar_password_admin(password, email)
    if db.query(User.id).filter(func.lower(User.email) == email.lower()).first() is not None:
        raise AdminInvalido("Ya existe una cuenta con ese correo; no se modifica")
    user = User(
        email=email,
        nombre=_nombre(nombre),
        hashed_password=hashear_password(password),
        rol=RolUsuario.ADMIN,
        is_active=True,
    )
    db.add(user)
    db.commit()
    return user


def leer_credenciales(email_argumento: str | None) -> tuple[str, str, str]:
    """--email con getpass, o BUSS_ADMIN_EMAIL + BUSS_ADMIN_PASSWORD."""
    nombre = os.environ.get(ENV_ADMIN_NOMBRE, "Administrador")
    if email_argumento:
        password = getpass.getpass("Contraseña del administrador: ")
        if password != getpass.getpass("Repite la contraseña: "):
            raise AdminInvalido("Las contraseñas no coinciden")
        return email_argumento, password, nombre
    email = os.environ.get(ENV_ADMIN_EMAIL, "").strip()
    password = os.environ.get(ENV_ADMIN_PASSWORD, "")
    if email and password:
        return email, password, nombre
    if email or password:
        raise AdminInvalido(f"Define {ENV_ADMIN_EMAIL} y {ENV_ADMIN_PASSWORD} juntas")
    raise AdminInvalido(f"Indica --email o las variables {ENV_ADMIN_EMAIL} y {ENV_ADMIN_PASSWORD}")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Crea el primer administrador (sin datos de ejemplo).")
    parser.add_argument("--email", help="Correo del ADMIN; la contraseña se pide sin eco")
    args = parser.parse_args(argv)

    try:
        email, password, nombre = leer_credenciales(args.email)
    except AdminInvalido as exc:
        print(f"Administrador no creado: {exc}")
        return 1

    if not esquema_listo():
        print("Administrador no creado: la base no está inicializada. Ejecuta python migrar.py y repite.")
        return 1

    db = SessionLocal()
    try:
        creado = crear_admin(db, email, password, nombre).email
    except AdminInvalido as exc:
        db.rollback()
        print(f"Administrador no creado: {exc}")
        return 1
    finally:
        db.close()
    print(f"Administrador creado: {creado} (contraseña no mostrada)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
