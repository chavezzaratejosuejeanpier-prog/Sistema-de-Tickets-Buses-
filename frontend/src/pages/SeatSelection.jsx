import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { getRouteSeats, getRoutes } from '../services/api.js'
import BusMap from '../components/bus/BusMap.jsx'
import Button from '../components/common/Button.jsx'

export default function SeatSelection() {
  const { routeId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [data, setData] = useState(null)
  const [seleccionados, setSeleccionados] = useState([])
  const [precio, setPrecio] = useState(location.state?.precio ?? null)
  const [rutaInfo, setRutaInfo] = useState({
    origen: location.state?.origen ?? '',
    destino: location.state?.destino ?? '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    setLoading(true)
    setError('')
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
      .catch(() => {
        if (!vivo) return
        // Fallback offline para no bloquear la UI si el backend está caído
        setData({ ocupados: [], total_piso1: 20, total_piso2: 40 })
        setError('No se pudo conectar con el backend. Mostrando mapa demo.')
      })
      .finally(() => vivo && setLoading(false))
    return () => { vivo = false }
  }, [routeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const continuar = () => {
    if (seleccionados.length === 0) return
    const asientos = [...seleccionados].sort((a, b) => a - b).map((n) => ({ id: n, number: n }))
    const payload = { routeId: Number(routeId), asientos, precio: precio != null ? Number(precio) : null }
    try {
      localStorage.setItem('reserva', JSON.stringify({ routeId: Number(routeId), asientos: [...seleccionados].sort((a, b) => a - b), precio: payload.precio }))
    } catch { /* almacenamiento no disponible */ }
    navigate('/checkout', { state: payload })
  }

  if (loading || !data) return (
    <div className="max-w-3xl mx-auto p-6 flex items-center justify-center gap-3 text-stone-500">
      <span className="spinner" aria-hidden="true" /> Cargando mapa...
    </div>
  )

  const totalEstimado = precio != null && seleccionados.length > 0
    ? `S/ ${(Number(precio) * seleccionados.length).toFixed(2)}`
    : null

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Link to="/buscar" className="text-sm font-semibold text-stone-500 hover:text-navy">← Volver a resultados</Link>
      <h1 className="text-2xl font-bold text-navy mb-1 mt-2">Selección de Asientos - Ruta #{routeId}</h1>
      {(rutaInfo.origen || precio != null) && (
        <p className="text-sm text-stone-500 mb-4">
          {[rutaInfo.origen, rutaInfo.destino].filter(Boolean).join(' → ')}{precio != null ? ` • S/ ${Number(precio).toFixed(2)} por asiento` : ''}
        </p>
      )}
      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm font-medium border bg-amber-50 border-amber-200 text-amber-800 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => window.location.reload()} className="font-bold underline shrink-0">Reintentar</button>
        </div>
      )}
      <BusMap totalPiso1={data.total_piso1} totalPiso2={data.total_piso2} ocupados={data.ocupados} onSelect={setSeleccionados} />
      <div className="mt-6 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <p className="text-sm text-stone-600">Seleccionados: <span className="font-bold text-navy">{seleccionados.join(', ') || 'ninguno'}</span>{totalEstimado && <span className="ml-2 font-bold text-navy">• Total est. {totalEstimado}</span>}</p>
        <Button disabled={seleccionados.length === 0} onClick={continuar}>Continuar a Pago</Button>
      </div>
    </div>
  )
}
