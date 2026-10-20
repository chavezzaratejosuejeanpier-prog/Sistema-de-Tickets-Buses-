import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { getRouteSeats, getRoutes } from '../services/api.js'
import BusMap from '../components/bus/BusMap.jsx'
import Button from '../components/common/Button.jsx'

export default function SeatSelection() {
  const { routeId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [seleccionados, setSeleccionados] = useState([])
  const [precio, setPrecio] = useState(location.state?.precio ?? null)
  const [rutaInfo, setRutaInfo] = useState({
    origen: location.state?.origen ?? '',
    destino: location.state?.destino ?? '',
  })

  const info = location.state || {}
  const total = seleccionados.length * Number(precio ?? 0)

  useEffect(() => {
    let vivo = true
    setError('')
    // Si no vino el precio en el state, se obtiene del backend (evita bloquear el flujo)
    Promise.all([
      getRouteSeats(routeId),
      precio == null ? getRoutes().catch(() => null) : Promise.resolve(null),
    ])
      .then(([seatsRes, routesRes]) => {
        if (!vivo) return
        setData(seatsRes.data)
        if (precio == null && routesRes?.data) {
          const ruta = routesRes.data.find((r) => String(r.id) === String(routeId))
          if (ruta) {
            setPrecio(Number(ruta.precio_base))
            setRutaInfo({ origen: ruta.origen ?? '', destino: ruta.destino ?? '' })
          }
        }
      })
      .catch((err) => {
        if (!vivo) return
        setData({ ocupados: [], total_piso1: 20, total_piso2: 40 })
        setError(
          err.response?.status === 404
            ? 'Este viaje ya no está disponible.'
            : 'No pudimos cargar los asientos. Mostrando mapa demo.'
        )
      })
    return () => { vivo = false }
  }, [routeId, precio])

  const continuar = () => {
    if (seleccionados.length === 0) return
    const asientos = [...seleccionados].sort((a, b) => a - b).map((n) => ({ id: n, number: n }))
    try {
      localStorage.setItem('reserva', JSON.stringify({ routeId: Number(routeId), asientos: [...seleccionados].sort((a, b) => a - b), precio: precio != null ? Number(precio) : null }))
    } catch { /* almacenamiento no disponible */ }
    navigate('/checkout', { state: { rutaId: Number(routeId), asientos, precio: precio != null ? Number(precio) : null } })
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
          {rutaInfo.origen && rutaInfo.destino ? `${rutaInfo.origen} → ${rutaInfo.destino}` : `Ruta #${routeId}`}
          {info.fecha ? ` · ${new Date(info.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}` : ''}
          {info.hora ? ` · ${info.hora}` : ''} · Elige tus asientos y continúa al pago.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm font-medium border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => window.location.reload()} className="font-bold underline shrink-0">Reintentar</button>
        </div>
      )}

      <BusMap
        totalPiso1={data.total_piso1}
        totalPiso2={data.total_piso2}
        ocupados={data.ocupados}
        onSelect={setSeleccionados}
      />

      <div className="mt-6 card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          {seleccionados.length > 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Asientos: <span className="font-bold text-navy dark:text-white">{seleccionados.join(', ')}</span>
            </p>
          ) : (
            <p className="text-sm text-stone-500 dark:text-stone-400">Aun no has seleccionado asientos</p>
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
