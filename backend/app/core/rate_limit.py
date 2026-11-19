"""Limitador de intentos en memoria, por clave (IP o cuenta).

Límite de un solo proceso: con varios workers o réplicas cada uno lleva su
propia cuenta. Para producción con varias instancias se requiere un almacén
compartido (p. ej. Redis). Las claves caducadas se purgan periódicamente y
el número de claves está acotado para que la memoria no crezca sin límite.
"""
import threading
import time
from collections import deque

from fastapi import HTTPException

MAX_CLAVES = 10_000
INTERVALO_PURGA = 60

_eventos: dict[str, deque] = {}
_ventanas: dict[str, int] = {}
_lock = threading.Lock()
_ultima_purga = 0.0


def _purgar(ahora: float) -> None:
    global _ultima_purga
    if ahora - _ultima_purga < INTERVALO_PURGA and len(_eventos) < MAX_CLAVES:
        return
    _ultima_purga = ahora
    for clave in list(_eventos):
        cola = _eventos[clave]
        ventana = _ventanas.get(clave, 60)
        while cola and cola[0] < ahora - ventana:
            cola.popleft()
        if not cola:
            _eventos.pop(clave, None)
            _ventanas.pop(clave, None)
    # Si aún se supera el tope, se descartan las claves más antiguas.
    if len(_eventos) >= MAX_CLAVES:
        for clave in sorted(_eventos, key=lambda c: _eventos[c][-1])[: len(_eventos) - MAX_CLAVES + 1]:
            _eventos.pop(clave, None)
            _ventanas.pop(clave, None)


def verificar_limite(
    clave: str,
    maximo: int = 5,
    ventana: int = 60,
    mensaje: str = "Demasiados intentos fallidos. Espera un momento e inténtalo de nuevo.",
) -> None:
    ahora = time.time()
    with _lock:
        _purgar(ahora)
        cola = _eventos.get(clave)
        if not cola:
            return
        while cola and cola[0] < ahora - ventana:
            cola.popleft()
        if len(cola) >= maximo:
            espera = max(1, int(cola[0] + ventana - ahora) + 1)
            raise HTTPException(status_code=429, detail=mensaje, headers={"Retry-After": str(espera)})


def registrar_fallo(clave: str, ventana: int = 60) -> None:
    ahora = time.time()
    with _lock:
        _purgar(ahora)
        _eventos.setdefault(clave, deque()).append(ahora)
        _ventanas[clave] = max(_ventanas.get(clave, 0), ventana)


def consumir(limites, mensaje: str = "Demasiados intentos fallidos. Espera un momento e inténtalo de nuevo.") -> tuple:
    """Comprueba y reserva un intento en varias claves de forma atómica.

    `limites` es una lista de (clave, maximo, ventana). Con `maximo=None` el
    intento se contabiliza sin comprobar el límite. Si alguna clave está
    agotada responde 429 sin registrar nada. Si no, registra el intento en
    todas y devuelve una marca para `reembolsar`. Al hacerse todo bajo el
    mismo cerrojo, peticiones concurrentes no pueden superar el límite.
    """
    ahora = time.time()
    with _lock:
        _purgar(ahora)
        espera = 0
        for clave, maximo, ventana in limites:
            if maximo is None:
                continue
            cola = _eventos.get(clave)
            if not cola:
                continue
            while cola and cola[0] < ahora - ventana:
                cola.popleft()
            if len(cola) >= maximo:
                espera = max(espera, int(cola[0] + ventana - ahora) + 1, 1)
        if espera:
            raise HTTPException(status_code=429, detail=mensaje, headers={"Retry-After": str(espera)})
        for clave, _maximo, ventana in limites:
            _eventos.setdefault(clave, deque()).append(ahora)
            _ventanas[clave] = max(_ventanas.get(clave, 0), ventana)
    return ahora, tuple(clave for clave, _m, _v in limites)


def reembolsar(marca: tuple) -> None:
    """Devuelve solo el intento reservado por `consumir` (no el historial)."""
    instante, claves = marca
    with _lock:
        for clave in claves:
            cola = _eventos.get(clave)
            if not cola:
                continue
            try:
                cola.remove(instante)
            except ValueError:
                continue
            if not cola:
                _eventos.pop(clave, None)
                _ventanas.pop(clave, None)


def marcar(clave: str, ventana: int) -> None:
    """Registra una marca con caducidad (p. ej. IP de confianza)."""
    registrar_fallo(clave, ventana)


def vigente(clave: str, ventana: int) -> bool:
    ahora = time.time()
    with _lock:
        cola = _eventos.get(clave)
        return bool(cola) and cola[-1] >= ahora - ventana


def limpiar(clave: str) -> None:
    with _lock:
        _eventos.pop(clave, None)
        _ventanas.pop(clave, None)


def reiniciar() -> None:
    """Vacía todo el estado (uso en pruebas)."""
    global _ultima_purga
    with _lock:
        _eventos.clear()
        _ventanas.clear()
        _ultima_purga = 0.0


def claves_activas() -> int:
    with _lock:
        return len(_eventos)
