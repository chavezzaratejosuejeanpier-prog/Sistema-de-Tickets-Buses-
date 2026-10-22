from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from ..database import get_db
from ..models.route import Route
from ..models.bus import Bus
from ..models.ticket import Ticket, EstadoTicket
from ..schemas.ticket_schema import RouteCreate, RouteResponse
from ..core.deps import require_admin
from ..models.user import User
from ..services.ticket_service import ESTADOS_LIBRES
from typing import List, Optional

router = APIRouter()

@router.get("/", response_model=List[RouteResponse])
def listar_rutas(db: Session = Depends(get_db)):
    return db.query(Route).order_by(Route.fecha_salida).all()

@router.post("/", response_model=RouteResponse, status_code=201)
def crear_ruta(data: RouteCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    ruta = Route(**data.model_dump())
    db.add(ruta); db.commit(); db.refresh(ruta)
    return ruta

@router.get("/buscar")
def buscar_viajes(origen: str, destino: str, fecha: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Route).join(Bus).filter(
        Route.origen.ilike(f"%{origen}%"),
        Route.destino.ilike(f"%{destino}%")
    )
    if fecha:
        try:
            dia = datetime.strptime(fecha, "%Y-%m-%d").date().isoformat()
        except ValueError:
            raise HTTPException(400, "Formato de fecha inválido (se espera YYYY-MM-DD)")
        q = q.filter(func.date(Route.fecha_salida) == dia)
    rutas = q.all()

    # Una sola consulta para todos los asientos ocupados (evita N+1)
    ids = [r.id for r in rutas]
    ocupados_por_ruta = dict(
        db.query(Ticket.route_id, func.count(Ticket.id))
        .filter(Ticket.route_id.in_(ids), Ticket.estado.notin_(ESTADOS_LIBRES))
        .group_by(Ticket.route_id)
        .all()
    ) if ids else {}

    result = []
    for r in rutas:
        ocupados = ocupados_por_ruta.get(r.id, 0)
        total = r.bus.total_asientos if r.bus else 60
        result.append({
            "id": r.id, "origen": r.origen, "destino": r.destino,
            "fecha_salida": r.fecha_salida, "hora_salida": r.hora_salida,
            "precio_base": r.precio_base, "asientos_disponibles": total - ocupados,
            "bus_placa": r.bus.placa if r.bus else "N/A", "bus_tipo": r.bus.tipo.value if r.bus else "ECONOMICO"
        })
    return result

@router.get("/ciudades")
def listar_ciudades(db: Session = Depends(get_db)):
    """Ciudades con rutas disponibles.

    Es la unica fuente de verdad de los destinos: el autocompletado del frontend
    lo consume, asi que nunca ofrece una ciudad sin buses.
    """
    origenes = {o for (o,) in db.query(Route.origen).distinct().all()}
    destinos = {d for (d,) in db.query(Route.destino).distinct().all()}
    return sorted(origenes | destinos)

@router.get("/{route_id}/asientos")
def asientos_por_ruta(route_id: int, db: Session = Depends(get_db)):
    ruta = db.query(Route).filter(Route.id == route_id).first()
    if not ruta:
        raise HTTPException(404, "Ruta no encontrada")
    # Un asiento esta ocupado si su ticket no esta DISPONIBLE ni CANCELADO
    ocupados = [
        t.numero_asiento for t in db.query(Ticket).filter(
            Ticket.route_id == route_id, Ticket.estado.notin_(ESTADOS_LIBRES)
        ).all()
    ]
    bus = ruta.bus
    return {"route_id": route_id, "ocupados": ocupados, "total_piso1": bus.capacidad_piso1, "total_piso2": bus.capacidad_piso2}
