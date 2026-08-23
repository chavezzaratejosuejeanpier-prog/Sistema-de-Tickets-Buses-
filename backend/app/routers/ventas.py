from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app.models.bus import Asiento
from app.models.ticket import Venta, Boleto
from app.schemas.schemas import ReservaRequest, VentaRequest

router = APIRouter(prefix="/api/ventas", tags=["Ventas"])

@router.post("/bloquear")
def bloquear_asientos(request: ReservaRequest, db: Session = Depends(get_db)):
    asientos = db.query(Asiento).filter(Asiento.id.in_(request.asientos_ids)).with_for_update().all()
    
    for asiento in asientos:
        if asiento.estado == "ocupado":
            raise HTTPException(status_code=409, detail=f"El asiento {asiento.numero_asiento} ya fue comprado.")
        if asiento.estado == "reservado" and asiento.expiracion_reserva > datetime.utcnow():
            raise HTTPException(status_code=409, detail=f"El asiento {asiento.numero_asiento} está siendo comprado por alguien más.")
    
    expiracion = datetime.utcnow() + timedelta(minutes=5)
    for asiento in asientos:
        asiento.estado = "reservado"
        asiento.expiracion_reserva = expiracion
    
    db.commit()
    return {"mensaje": "Asientos bloqueados exitosamente por 5 minutos"}

@router.post("/confirmar_pago")
def confirmar_pago(request: VentaRequest, db: Session = Depends(get_db)):
    nueva_venta = Venta(origen=request.origen, destino=request.destino, total=request.total)
    db.add(nueva_venta)
    db.commit()
    db.refresh(nueva_venta)

    for pasajero in request.pasajeros:
        asiento = db.query(Asiento).filter(Asiento.id == pasajero.asiento_id).first()
        if not asiento or asiento.estado == "ocupado":
            raise HTTPException(status_code=400, detail="Error: Asiento inválido o ya ocupado.")
        
        asiento.estado = "ocupado"
        asiento.expiracion_reserva = None

        nuevo_boleto = Boleto(
            venta_id=nueva_venta.id,
            asiento_id=pasajero.asiento_id,
            dni=pasajero.dni,
            nombres=pasajero.nombres
        )
        db.add(nuevo_boleto)

    db.commit()
    return {"mensaje": "Compra exitosa, pasajes emitidos.", "codigo_venta": nueva_venta.id}