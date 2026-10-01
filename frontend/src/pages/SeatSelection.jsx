import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { getRouteSeats } from '../services/api.js'
import BusMap from '../components/bus/BusMap.jsx'
import Button from '../components/common/Button.jsx'

export default function SeatSelection() {
  const { routeId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [seleccionados, setSeleccionados] = useState([])

  const precioBase = Number(location.state?.precio ?? 45)
  const total = seleccionados.length * precioBase

  useEffect(() => {
    getRouteSeats(routeId)
      .then(r => setData(r.data))
      .catch(() => setData({ ocupados: [], total_piso1: 20, total_piso2: 40 }))
  }, [routeId])

  const continuar = () => {
    const asientos = seleccionados.map(n => ({ id: n, number: n }))
    localStorage.setItem('reserva', JSON.stringify({ routeId, asientos }))
    navigate('/checkout', { state: { asientos, precio: precioBase } })
  }

  if (!data) return (
    <div className="max-w-3xl mx-auto p-10 flex items-center justify-center gap-3 text-stone-500">
      <span className="spinner" aria-hidden="true" /> Cargando mapa...
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold text-navy dark:text-white tracking-tight">Elige tus Asientos</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-2 text-sm md:text-base">
          Ruta #{routeId} · Marca los asientos libres que deseas y continua al pago.
        </p>
      </div>

      <BusMap
        totalPiso1={data.total_piso1}
        totalPiso2={data.total_piso2}
        ocupados={data.ocupados}
        onSelect={setSeleccionados}
      />

      <div className="mt-6 card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          {seleccionados.length > 0 ? (
            <p className="text-sm text-stone-500">
              Asientos: <span className="font-bold text-navy dark:text-white">{seleccionados.join(', ')}</span>
            </p>
          ) : (
            <p className="text-sm text-stone-500">Aun no has seleccionado asientos</p>
          )}
          <p className="text-2xl font-extrabold text-navy dark:text-white mt-1">Total: S/ {total.toFixed(2)}</p>
        </div>
        <Button disabled={seleccionados.length === 0} onClick={continuar} className="w-full sm:w-auto">
          Continuar a Pago
        </Button>
      </div>
    </div>
  )
}
