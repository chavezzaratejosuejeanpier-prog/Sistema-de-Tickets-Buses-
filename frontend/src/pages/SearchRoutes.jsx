import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeftRight, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { buscarOProgramar } from '../services/api.js'
import { hoyLima } from '../utils/fecha.js'
import Button from '../components/common/Button.jsx'
import CityField from '../components/common/CityField.jsx'
import DateField from '../components/common/DateField.jsx'
import DestinationGrid from '../components/DestinationGrid.jsx'
import RouteLoadingLine from '../components/common/RouteLoadingLine.jsx'
import { mensajeError } from '../utils/errores.js'

function mensajeErrorApi(err) {
  return mensajeError(err, `Error del servidor (${err?.response?.status ?? 'sin respuesta'}).`)
}

export default function SearchRoutes() {
  const hoy = hoyLima()
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [resultados, setResultados] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [filtroHorario, setFiltroHorario] = useState('todos')
  const [recientes, setRecientes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('busquedasRecientes') || '[]') } catch { return [] }
  })
  const navigate = useNavigate()
  const location = useLocation()

  const canSearch = origen.trim().length >= 2 && destino.trim().length >= 2 && origen.trim().toLowerCase() !== destino.trim().toLowerCase()

  const swap = () => { setOrigen(destino); setDestino(origen) }

  const ejecutar = async (o, d, f) => {
    setLoading(true); setError(''); setHasSearched(true)
    try {
      const { data } = await buscarOProgramar(o.trim(), d.trim(), f || undefined)
      setResultados(data)
      if (data.length > 0) {
        setRecientes(prev => {
          const item = { origen: o.trim(), destino: d.trim() }
          const filtrado = prev.filter(r => !(r.origen === item.origen && r.destino === item.destino))
          const nuevo = [item, ...filtrado].slice(0, 5)
          try { localStorage.setItem('busquedasRecientes', JSON.stringify(nuevo)) } catch {}
          return nuevo
        })
      }
      if (data.length === 0) setError('No se encontraron viajes para esa combinación.')
    } catch (err) {
      setError(mensajeErrorApi(err))
      setResultados([])
    } finally { setLoading(false) }
  }

  useEffect(() => {
    const entrada = location.state
    if (!entrada) return
    const fechaEntrada = entrada.fecha ?? hoyLima()
    setOrigen(entrada.origen); setDestino(entrada.destino); setFecha(fechaEntrada)
    ejecutar(entrada.origen, entrada.destino, fechaEntrada)
  }, [location.state])

  const buscar = (e) => {
    e.preventDefault()
    if (!canSearch) { setError(origen.toLowerCase() === destino.toLowerCase() ? 'Origen y destino no pueden ser iguales' : 'Completa origen y destino'); return }
    ejecutar(origen, destino, fecha)
  }

  const limpiar = () => { setOrigen(''); setDestino(''); setFecha(hoy); setResultados([]); setError(''); setHasSearched(false) }

  const elegirDestino = (ciudad) => {
    if (ciudad.toLowerCase() === origen.trim().toLowerCase()) return
    setOrigen('Lima'); setDestino(ciudad); setFecha(hoy); setResultados([]); setError(''); setHasSearched(false); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resultadosFiltrados = resultados.filter(r => {
    const hora = parseInt((r.hora_salida || '0').split(':')[0], 10)
    if (filtroHorario === 'manana' && !(hora < 12)) return false
    if (filtroHorario === 'tarde' && !(hora >= 12 && hora < 18)) return false
    if (filtroHorario === 'noche' && !(hora >= 18)) return false
    return true
  })

  const mostrarGrid = !hasSearched
  const mostrarCargando = loading
  const mostrarResultados = resultados.length > 0 && !loading

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <nav className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400 mb-2">
          <span>Inicio</span><span className="text-primary">/</span><span>Buscar Viajes</span>
          {origen && destino && (<><span className="text-primary">/</span><span className="font-semibold text-navy dark:text-white">{origen} → {destino}</span></>)}
        </nav>
        <h1 className="text-3xl md:text-4xl font-extrabold text-navy dark:text-white tracking-tight">{new Date().getHours() < 12 ? 'Buenos días, señor' : 'Buenas tardes, señor'} · Buscar Viajes</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-2 text-sm md:text-base">Elige origen, destino y fecha. Resultados en tiempo real con asientos disponibles.</p>
      </div>

      <form onSubmit={buscar} className="bg-white dark:bg-stone-800 rounded-xl shadow-soft border border-black/5 dark:border-stone-700 p-6 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="min-w-0 flex-1"><CityField label="Origen" value={origen} onChange={setOrigen} placeholder="Ingrese una ciudad" exclude={destino} /></div>
          <button type="button" onClick={swap} aria-label="Intercambiar origen y destino" title="Intercambiar origen y destino" className="self-center md:self-end shrink-0 w-10 h-10 rounded-full bg-white dark:bg-stone-700 border border-black/10 dark:border-stone-600 shadow-soft flex items-center justify-center text-navy dark:text-white hover:bg-navy hover:text-white hover:border-navy transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeftRight size={18} aria-hidden="true" /></button>
          <div className="min-w-0 flex-1"><CityField label="Destino" value={destino} onChange={setDestino} placeholder="Ingrese el destino" exclude={origen} /></div>
          <div className="w-full shrink-0 md:w-[220px]"><DateField label="Fecha" value={fecha} onChange={e => setFecha(e.target.value)} min={hoy} /></div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!canSearch || loading} className="disabled:opacity-50 disabled:cursor-not-allowed min-w-[150px] flex items-center justify-center gap-2">
            {loading ? (<span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Buscando...</span>) : (<span className="flex items-center gap-2"><Search size={16} aria-hidden="true" /> Buscar viajes</span>)}
          </Button>
          <Button type="button" variant="outline" onClick={limpiar}>Limpiar</Button>
          {!canSearch && origen && destino && (<span className="self-center text-xs font-semibold text-primary bg-gray-50 dark:bg-stone-800 border border-black/5 dark:border-stone-700 px-3 py-1.5 rounded-full">Origen ≠ Destino</span>)}
        </div>
      </form>

      {recientes.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-stone-400">Recientes:</span>
          {recientes.map((r, i) => (
            <button key={i} type="button" onClick={() => { setOrigen(r.origen); setDestino(r.destino); setFecha(hoy); ejecutar(r.origen, r.destino, hoy) }} className="inline-flex items-center gap-1.5 rounded-full border border-line dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-1.5 text-xs font-medium text-navy dark:text-stone-200 hover:border-primary hover:text-primary transition-colors">{r.origen} → {r.destino}</button>
          ))}
          <button type="button" onClick={() => { setRecientes([]); try { localStorage.removeItem('busquedasRecientes') } catch {} }} className="text-xs text-muted hover:text-red-600 dark:hover:text-red-400">Limpiar</button>
        </div>
      )}

      {error && (<div className={`mt-5 rounded-xl px-4 py-3 text-sm font-medium border ${resultados.length > 0 ? 'bg-gray-50 dark:bg-stone-800 border-black/5 dark:border-stone-700 text-stone-600 dark:text-stone-300' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'}`}>{error}</div>)}

      <div className="mt-6" aria-live="polite" aria-busy={loading}>
        {mostrarGrid && <DestinationGrid onSelect={elegirDestino} exclude={origen} />}
        {mostrarCargando && (<><RouteLoadingLine activo /><p className="text-stone-400 text-sm text-center">Trazando rutas disponibles…</p></>)}
        {mostrarResultados && (
          <div className="space-y-6">
            <p className="text-xs font-bold tracking-widest text-stone-400 dark:text-stone-500 uppercase mb-3">{resultadosFiltrados.length} de {resultados.length} resultado(s)</p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-stone-400">Horario:</span>
              {['todos', 'manana', 'tarde', 'noche'].map(h => (
                <button key={h} type="button" onClick={() => setFiltroHorario(h)} className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filtroHorario === h ? 'bg-primary text-white border-primary' : 'border-line dark:border-stone-700 text-navy dark:text-stone-200 hover:border-primary'}`}>{h === 'todos' ? 'Todos' : h === 'manana' ? 'Mañana' : h === 'tarde' ? 'Tarde' : 'Noche'}</button>
              ))}
            </div>
            <div className="grid gap-4">{resultadosFiltrados.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.05 }} className="bg-white dark:bg-stone-800 rounded-xl border border-black/5 dark:border-stone-700 shadow-soft p-5 flex flex-row items-center justify-between gap-4">
                <div className="flex-1 min-w-0"><p className="font-extrabold text-navy dark:text-white text-sm flex items-center gap-1">{r.origen} <span className="text-primary">→</span> {r.destino}</p><p className="text-xs text-stone-500 dark:text-stone-400 mt-1">{r.fecha_salida ? new Date(r.fecha_salida).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : 'Fecha por confirmar'} • {r.hora_salida} • {r.duracion_horas} h • {r.bus_tipo}</p></div><div className="flex items-center gap-3"><p className="text-xl font-extrabold text-navy dark:text-white">S/ {Number(r.precio_base).toFixed(2)}</p><Button onClick={() => navigate(`/asientos/${r.id}`, { state: { precio: r.precio_base, origen: r.origen, destino: r.destino, fecha: r.fecha_salida, hora: r.hora_salida, placa: r.bus_placa, tipo: r.bus_tipo } })} disabled={r.asientos_disponibles === 0} className="disabled:opacity-40 text-xs px-3 py-2">Ver Asientos</Button></div></motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}