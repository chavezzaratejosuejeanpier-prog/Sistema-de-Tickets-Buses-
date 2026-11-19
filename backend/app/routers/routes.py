from fastapi import APIRouter, Depends, Path, Query, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from datetime import date, datetime, time, timedelta
from ..database import get_db
from ..models.bus import Bus
from ..models.route import Route
from ..models.ticket import Ticket
from ..schemas.ticket_schema import (
    MAX_ID_DB,
    RouteCreate,
    RouteResponse,
    RouteSearchResponse,
    ProximasSalidasResponse,
)
from ..core.deps import require_admin
from ..core import catalogo
from ..core.rate_limit import consumir
from ..core.tiempo import hoy_lima
from ..models.user import User
from ..services import programa
from ..services.ticket_service import ESTADOS_LIBRES, asientos_ocupados
from typing import List, Optional

router = APIRouter()

# Horizonte máximo de búsqueda y de generación de salidas (días desde hoy en Lima).
MAX_DIAS_BUSQUEDA = 90
# Generación explícita de salidas (POST /generar): pública pero acotada a
# ciudades del catálogo, al horizonte y a este número de intentos por IP.
GENERAR_IP_MAX, GENERAR_IP_VENTANA = 30, 60 * 60
# GET /api/routes/: los consumidores (inicio y panel) solo usan las primeras
# salidas. La selección de asientos consulta GET /api/routes/{id} en lugar
# de buscar el viaje en este listado acotado.
LIMITE_LISTADO_DEFECTO, LIMITE_LISTADO_MAX = 200, 2000


class GenerarSalidasRequest(BaseModel):
    origen: str = Field(min_length=1, max_length=80)
    destino: str = Field(min_length=1, max_length=80)
    fecha: Optional[str] = Field(None, max_length=10)


@router.get("/", response_model=ProximasSalidasResponse)
def listar_rutas(
    db: Session = Depends(get_db),
    limite: int = Query(LIMITE_LISTADO_DEFECTO, ge=1, le=LIMITE_LISTADO_MAX),
):
    inicio = datetime.combine(hoy_lima(), time(0, 0))
    total = db.query(func.count(Route.id)).filter(Route.fecha_salida >= inicio).scalar() or 0
    pares = db.query(func.count(func.distinct(Route.origen + "|" + Route.destino))).filter(
        Route.fecha_salida >= inicio
    ).scalar() or 0
    rutas = db.query(Route).filter(Route.fecha_salida >= inicio).order_by(
        Route.fecha_salida, Route.hora_salida, Route.id
    ).limit(limite).all()
    return {"total": total, "pares": pares, "rutas": [RouteResponse.model_validate(r).model_dump() for r in rutas]}


@router.post("/", response_model=RouteResponse, status_code=201)
def crear_ruta(data: RouteCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    if db.query(Bus.id).filter(Bus.id == data.bus_id).first() is None:
        raise HTTPException(400, "El bus indicado no existe")
    ruta = Route(**data.model_dump())
    db.add(ruta)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "No se pudo registrar el viaje por un conflicto de datos")
    db.refresh(ruta)
    return ruta


@router.get("/buscar", response_model=List[RouteSearchResponse])
def buscar_viajes(
    origen: str = Query(..., min_length=1, max_length=80),
    destino: str = Query(..., min_length=1, max_length=80),
    fecha: Optional[str] = Query(None, max_length=10),
    db: Session = Depends(get_db),
):
    """Solo lectura: devuelve las salidas existentes que aún no partieron.

    Si el par o la fecha no están programados devuelve una lista vacía; el
    cliente puede pedir su programación con POST /api/routes/generar.
    """
    origen_ciudad, destino_ciudad, fecha_buscada = _validar_busqueda(origen, destino, fecha)
    return _resultados(db, programa.salidas_del_dia(db, origen_ciudad, destino_ciudad, fecha_buscada))


@router.post("/generar", response_model=List[RouteSearchResponse])
def generar_salidas(data: GenerarSalidasRequest, request: Request, db: Session = Depends(get_db)):
    """Programa las salidas que faltan de un par y fecha y las devuelve.

    Creación controlada: solo ciudades del catálogo, fechas entre hoy (Lima)
    y el horizonte, una salida por bus y día, sin modificar las existentes,
    y con límite de intentos por IP.
    """
    origen_ciudad, destino_ciudad, fecha_buscada = _validar_busqueda(data.origen, data.destino, data.fecha)
    ip = request.client.host if request.client else "desconocido"
    consumir(
        [(f"generar:{ip}", GENERAR_IP_MAX, GENERAR_IP_VENTANA)],
        "Demasiadas solicitudes de programación. Inténtalo más tarde.",
    )
    programa.generar_salidas_faltantes(db, origen_ciudad, destino_ciudad, fecha_buscada)
    return _resultados(db, programa.salidas_del_dia(db, origen_ciudad, destino_ciudad, fecha_buscada))


@router.get("/ciudades")
def listar_ciudades():
    return catalogo.CIUDADES


@router.get("/pares")
def listar_pares_rutas(db: Session = Depends(get_db)):
    filas = db.query(Route.origen, Route.destino).distinct().order_by(Route.origen, Route.destino).all()
    return [{"origen": origen, "destino": destino} for origen, destino in filas]

@router.get("/{route_id}", response_model=RouteResponse)
def obtener_ruta(route_id: int = Path(..., ge=1, le=MAX_ID_DB), db: Session = Depends(get_db)):
    ruta = db.query(Route).filter(Route.id == route_id).first()
    if not ruta:
        raise HTTPException(404, "Ruta no encontrada")
    return ruta


@router.get("/{route_id}/asientos")
def asientos_por_ruta(route_id: int = Path(..., ge=1, le=MAX_ID_DB), db: Session = Depends(get_db)):
    ruta = db.query(Route).filter(Route.id == route_id).first()
    if not ruta or ruta.bus is None:
        raise HTTPException(404, "Ruta no encontrada")
    bus = ruta.bus
    return {
        "route_id": route_id,
        "ocupados": asientos_ocupados(db, route_id),
        "total_piso1": bus.capacidad_piso1,
        "total_piso2": bus.capacidad_piso2,
    }


def _resultados(db: Session, rutas: list[Route]) -> list[dict]:
    ids = [r.id for r in rutas]
    ocupados_por_ruta = dict(
        db.query(Ticket.route_id, func.count(func.distinct(Ticket.numero_asiento)))
        .filter(Ticket.route_id.in_(ids), Ticket.estado.notin_(ESTADOS_LIBRES))
        .group_by(Ticket.route_id)
        .all()
    ) if ids else {}

    resultado = []
    for r in rutas:
        ocupados = ocupados_por_ruta.get(r.id, 0)
        total = (r.bus.total_asientos or 0) if r.bus else 0
        resultado.append({
            "id": r.id, "origen": r.origen, "destino": r.destino,
            "fecha_salida": r.fecha_salida, "hora_salida": r.hora_salida,
            "precio_base": r.precio_base, "duracion_horas": r.duracion_horas,
            "asientos_disponibles": max(total - ocupados, 0),
            "bus_placa": r.bus.placa if r.bus else "N/A",
            "bus_tipo": r.bus.tipo.value if r.bus and r.bus.tipo else "ECONOMICO",
        })
    return resultado


def _validar_busqueda(origen: str, destino: str, fecha: Optional[str]):
    origen_ciudad = _resolver(origen, "origen")
    destino_ciudad = _resolver(destino, "destino")
    if origen_ciudad == destino_ciudad:
        raise HTTPException(400, "Origen y destino no pueden ser iguales")
    return origen_ciudad, destino_ciudad, _parse_fecha(fecha)


def _resolver(texto: str, campo: str) -> str:
    # Los mensajes no repiten el texto recibido.
    candidatas = catalogo.coincidencias(texto)
    if not candidatas:
        raise HTTPException(404, f"No encontramos la ciudad de {campo} en el catálogo")
    if len(candidatas) > 1:
        raise HTTPException(400, f"Ciudad de {campo} ambigua: elige entre {', '.join(candidatas[:6])}")
    return candidatas[0]


def _parse_fecha(fecha: Optional[str]) -> date:
    # Calendario de Lima: el servicio opera en Perú, sea cual sea la zona
    # horaria del servidor.
    hoy = hoy_lima()
    if not fecha:
        return hoy
    try:
        valor = datetime.strptime(fecha, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Formato de fecha inválido (se espera YYYY-MM-DD)")
    if valor < hoy:
        raise HTTPException(400, "La fecha de viaje no puede ser anterior a hoy")
    if valor > hoy + timedelta(days=MAX_DIAS_BUSQUEDA):
        raise HTTPException(400, f"Solo se pueden buscar viajes hasta {MAX_DIAS_BUSQUEDA} días en adelante")
    return valor
