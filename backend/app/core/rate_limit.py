import time
from collections import defaultdict, deque

from fastapi import HTTPException

_fallos = defaultdict(deque)


def verificar_limite(clave: str, maximo: int = 5, ventana: int = 60) -> None:
    ahora = time.time()
    cola = _fallos[clave]
    while cola and cola[0] < ahora - ventana:
        cola.popleft()
    if len(cola) >= maximo:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos fallidos. Espera un minuto e inténtalo de nuevo.",
        )


def registrar_fallo(clave: str) -> None:
    _fallos[clave].append(time.time())


def limpiar(clave: str) -> None:
    _fallos.pop(clave, None)
