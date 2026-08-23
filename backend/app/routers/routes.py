from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from ..database import get_db
from ..models.route import Route
from ..models.bus import Bus
from ..models.ticket import Ticket, EstadoTicket
from ..schemas.ticket_schema import RouteCreate, RouteResponse
from typing import List, Optional

router = APIRouter()

@router.get("/", response_model=List[RouteResponse])
def listar_rutas(db: Session = Depends(get_db)):
    return db.query(Route).all()

@router.post("/", response_model=RouteResponse, status_code=201)
def crear_ruta(data: RouteCreate, db: Session = Depends(get_db)):
    ruta = Route(**data.model_dump())
    db.add(ruta); db.commit(); db.refresh(ruta)
    return ruta

@router.get("/buscar")
def buscar_viajes(origen: str, destino: str, fecha: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Route).join(Bus).filter(
        Route.origen.ilike(f"%{origen}%"),
        Route.destino.ilike(f"%{destino}%")
    )
    rutas = q.all()
    result = []
    for r in rutas:
        vendidos = db.query(Ticket).filter(Ticket.route_id == r.id, Ticket.estado == EstadoTicket.VENDIDO).count()
        total = r.bus.total_asientos if r.bus else 60
        result.append({
            "id": r.id, "origen": r.origen, "destino": r.destino,
            "fecha_salida": r.fecha_salida, "hora_salida": r.hora_salida,
            "precio_base": r.precio_base, "asientos_disponibles": total - vendidos,
            "bus_placa": r.bus.placa if r.bus else "N/A", "bus_tipo": r.bus.tipo.value if r.bus else "ECONOMICO"
        })
    return result

@router.get("/{route_id}/asientos")
def asientos_por_ruta(route_id: int, db: Session = Depends(get_db)):
    tickets = db.query(Ticket).filter(Ticket.route_id == route_id, Ticket.estado == Ticket.estado.VENDIDO).all() if False else db.query(Ticket).filter(Ticket.route_id == route_id, Ticket.estado != EstadoTicket.DISPONIBLE).all()
    # alternativa simple: lista de asientos ocupados
    ocupados = [t.numero_asiento for t in tickets]
    ruta = db.query(Route).filter(Route.id == route_id).first()
    if not ruta:
        from fastapi import HTTPException
        raise HTTPException(404, "Ruta no encontrada")
    bus = ruta.bus
    return {"route_id": route_id, "ocupados": ocupados, "total_piso1": bus.capacidad_piso1, "total_piso2": bus.capacidad_piso2}
