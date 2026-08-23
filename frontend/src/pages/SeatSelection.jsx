import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRouteSeats } from '../services/api.js'
import BusMap from '../components/bus/BusMap.jsx'
import Button from '../components/common/Button.jsx'

export default function SeatSelection() {
  const { routeId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [seleccionados, setSeleccionados] = useState([])

  useEffect(()=>{
    getRouteSeats(routeId).then(r=>setData(r.data)).catch(()=>setData({ocupados:[], total_piso1:20, total_piso2:40}))
  },[routeId])

  const continuar = () => {
    localStorage.setItem('reserva', JSON.stringify({ routeId, asientos: seleccionados }))
    navigate('/checkout')
  }

  if(!data) return <p className="p-6">Cargando mapa...</p>
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-primary mb-4">Selección de Asientos - Ruta #{routeId}</h1>
      <BusMap totalPiso1={data.total_piso1} totalPiso2={data.total_piso2} ocupados={data.ocupados} onSelect={setSeleccionados} />
      <div className="mt-6 flex justify-between items-center">
        <p>Seleccionados: <span className="font-bold">{seleccionados.join(', ') || 'ninguno'}</span></p>
        <Button disabled={seleccionados.length===0} onClick={continuar}>Continuar a Pago</Button>
      </div>
    </div>
  )
}
