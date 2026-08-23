from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.models.bus import Asiento

router = APIRouter(prefix="/api/buses", tags=["Buses"])

@router.get("/disponibilidad")
def ver_disponibilidad(fecha: str, db: Session = Depends(get_db)):
    asientos = db.query(Asiento).filter(Asiento.fecha_viaje == fecha).all()
    
    # Lógica clave: Si un asiento estaba "reservado" pero pasaron los 5 minutos, lo liberamos
    ahora = datetime.utcnow()
    for asiento in asientos:
        if asiento.estado == "reservado" and asiento.expiracion_reserva and asiento.expiracion_reserva < ahora:
            asiento.estado = "libre"
            asiento.expiracion_reserva = None
    db.commit()
    
    return asientos