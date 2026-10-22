from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, time
from ..database import get_db
from ..models.route import Route
from ..models.ticket import Ticket
from ..schemas.ticket_schema import RouteCreate, RouteResponse, RouteSearchResponse, ProximasSalidasResponse
from ..core.deps import require_admin
from ..core import catalogo
from ..models.user import User
from ..services import programa
from ..services.ticket_service import ESTADOS_LIBRES
from typing import List, Optional

router = APIRouter()


@router.get("/", response_model=ProximasSalidasResponse)
def listar_rutas(db: Session = Depends(get_db), limite: int = Query(200, ge=1, le=2000)):
    inicio = datetime.combine(date.today(), time(0, 0))
    total = db.query(func.count(Route.id)).filter(Route.fecha_salida >= inicio).scalar() or 0
    pares = db.query(func.count(func.distinct(Route.origen + "|" + Route.destino))).filter(
        Route.fecha_salida >= inicio
    ).scalar() or 0
    rutas = db.query(Route).filter(Route.fecha_salida >= inicio).order_by(
        Route.fecha_salida, Route.hora_salida
    ).limit(limite).all()
    return {"total": total, "pares": pares, "rutas": [RouteResponse.model_validate(r).model_dump() for r in rutas]}


@router.post("/", response_model=RouteResponse, status_code=201)
def crear_ruta(data: RouteCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    ruta = Route(**data.model_dump())
    db.add(ruta); db.commit(); db.refresh(ruta)
    return ruta


@router.get("/buscar", response_model=List[RouteSearchResponse])
def buscar_viajes(origen: str, destino: str, fecha: Optional[str] = None, db: Session = Depends(get_db)):
    origen_ciudad = _resolver(origen, "origen")
    destino_ciudad = _resolver(destino, "destino")
    if origen_ciudad == destino_ciudad:
        raise HTTPException(400, "Origen y destino no pueden ser iguales")

    fecha_buscada = _parse_fecha(fecha)
    programa.sincronizar_si_cambio_el_dia(db)
    rutas = programa.asegurar_salidas(db, origen_ciudad, destino_ciudad, fecha_buscada)

    ids = [r.id for r in rutas]
    ocupados_por_ruta = dict(
        db.query(Ticket.route_id, func.count(Ticket.id))
        .filter(Ticket.route_id.in_(ids), Ticket.estado.notin_(ESTADOS_LIBRES))
        .group_by(Ticket.route_id)
        .all()
    ) if ids else {}

    resultado = []
    for r in rutas:
        ocupados = ocupados_por_ruta.get(r.id, 0)
        total = r.bus.total_asientos if r.bus else 60
        resultado.append({
            "id": r.id, "origen": r.origen, "destino": r.destino,
            "fecha_salida": r.fecha_salida, "hora_salida": r.hora_salida,
            "precio_base": r.precio_base, "duracion_horas": r.duracion_horas,
            "asientos_disponibles": total - ocupados,
            "bus_placa": r.bus.placa if r.bus else "N/A",
            "bus_tipo": r.bus.tipo.value if r.bus else "ECONOMICO"
        })
    return resultado


@router.get("/ciudades")
def listar_ciudades():
    return catalogo.CIUDADES


@router.get("/{route_id}/asientos")
def asientos_por_ruta(route_id: int, db: Session = Depends(get_db)):
    ruta = db.query(Route).filter(Route.id == route_id).first()
    if not ruta:
        raise HTTPException(404, "Ruta no encontrada")
    ocupados = [
        t.numero_asiento for t in db.query(Ticket).filter(
            Ticket.route_id == route_id, Ticket.estado.notin_(ESTADOS_LIBRES)
        ).all()
    ]
    bus = ruta.bus
    return {"route_id": route_id, "ocupados": ocupados, "total_piso1": bus.capacidad_piso1, "total_piso2": bus.capacidad_piso2}


def _resolver(texto: str, campo: str) -> str:
    candidatas = catalogo.coincidencias(texto)
    if not candidatas:
        raise HTTPException(404, f"No encontramos la ciudad de {campo} '{texto}'")
    if len(candidatas) > 1:
        raise HTTPException(400, f"Ciudad de {campo} ambigua '{texto}': elige entre {', '.join(candidatas[:6])}")
    return candidatas[0]


def _parse_fecha(fecha: Optional[str]) -> date:
    if not fecha:
        return date.today()
    try:
        return datetime.strptime(fecha, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Formato de fecha inválido (se espera YYYY-MM-DD)")
