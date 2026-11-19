import bcrypt

# bcrypt solo considera los primeros 72 bytes y bcrypt>=5 rechaza entradas
# más largas con ValueError: se valida antes para no truncar ni fallar.
MAX_BYTES_PASSWORD = 72
MIN_LARGO_PASSWORD = 8


def password_demasiado_larga(password: str) -> bool:
    return len(password.encode("utf-8")) > MAX_BYTES_PASSWORD


def hashear_password(password: str) -> str:
    if password_demasiado_larga(password):
        raise ValueError(f"La contraseña no puede superar {MAX_BYTES_PASSWORD} bytes")
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, hashed: str) -> bool:
    if not password or not hashed or password_demasiado_larga(password):
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        # Hash corrupto o con formato no bcrypt: nunca autentica.
        return False


# Hash de relleno para igualar el tiempo de respuesta cuando el correo no
# existe (evita enumerar cuentas por tiempo). No corresponde a ninguna cuenta.
_HASH_RELLENO = bcrypt.hashpw(b"relleno-sin-cuenta", bcrypt.gensalt()).decode("utf-8")


def verificar_relleno(password: str) -> None:
    verificar_password(password or "x", _HASH_RELLENO)
