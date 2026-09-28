import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchRoutes } from '../services/api.js'
import Button from '../components/common/Button.jsx'

const CIUDADES = [
  'Lima', 'Arequipa', 'Cusco', 'Trujillo', 'Chiclayo', 'Piura', 'Huancayo',
  'Iquitos', 'Puno', 'Tacna', 'Ayacucho', 'Cajamarca', 'Huaraz', 'Ica',
  'Chimbote', 'Tarapoto', 'Pucallpa', 'Tumbes', 'Moquegua', 'Abancay',
]

function getFiltered(query, exclude) {
  const q = query.trim().toLowerCase()
  return CIUDADES.filter(c => c.toLowerCase().includes(q) && c.toLowerCase() !== exclude.toLowerCase()).slice(0, 6)
}

function AutocompleteField({ label, value, onChange, placeholder, exclude = '', onSwap }) {
  const [focused, setFocused] = useState(false)
  const filtered = useMemo(() => getFiltered(value, exclude), [value, exclude])
  const showList = focused && value.length >= 1 && filtered.length > 0

  return (
    <div className="flex-1 relative">
      <label className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-1.5 block">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-6-5.373-6-9a6 6 0 1 1 12 0c0 3.627-6 9-6 9z"/><circle cx="12" cy="12" r="2.5"/></svg>
        </span>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-primary dark:text-white placeholder:text-gray-400 focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
        />
      </div>
      {showList && (
        <ul className="absolute z-20 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden py-1">
          {filtered.map(c => (
            <li key={c}>
              <button
                type="button"
                onMouseDown={() => onChange(c)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary hover:text-white transition-colors flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 bg-accent rounded-full shrink-0" />{c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function SearchRoutes() {
  const [origen, setOrigen] = useState('Lima')
  const [destino, setDestino] = useState('Cusco')
  const [fecha, setFecha] = useState('')
  const [resultados, setResultados] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const navigate = useNavigate()

  const hoy = new Date().toISOString().split('T')[0]

  const canSearch = origen.trim().length >= 2 && destino.trim().length >= 2 && origen.trim().toLowerCase() !== destino.trim().toLowerCase()

  const swap = () => {
    setOrigen(destino)
    setDestino(origen)
  }

  const buscar = async (e) => {
    e.preventDefault()
    if (!canSearch) {
      setError(origen.toLowerCase() === destino.toLowerCase() ? 'Origen y destino no pueden ser iguales' : 'Completa origen y destino')
      return
    }
    setLoading(true); setError(''); setHasSearched(true)
    try {
      const { data } = await searchRoutes(origen.trim(), destino.trim(), fecha || undefined)
      // fallback filtro fecha en frontend si backend aún no filtra
      let filtered = data
      if (fecha && Array.isArray(data)) {
        filtered = data.filter(r => {
          if (!r.fecha_salida) return true
          const d = new Date(r.fecha_salida).toISOString().split('T')[0]
          return d === fecha
        })
      }
      setResultados(filtered)
      if (filtered.length === 0) setError('No se encontraron viajes para esa combinación. Prueba otra fecha o ciudades cercanas.')
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo conectar con el backend. Verifica que esté corriendo en :8000')
      setResultados([])
    } finally {
      setLoading(false)
    }
  }

  const limpiar = () => {
    setOrigen(''); setDestino(''); setFecha(''); setResultados([]); setError(''); setHasSearched(false)
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold text-primary dark:text-white tracking-tight">Buscar Viajes</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm md:text-base">Elige origen, destino y fecha. Resultados en tiempo real con asientos disponibles.</p>
      </div>

      {/* Form Card */}
      <form onSubmit={buscar} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 md:p-7">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
          <AutocompleteField label="Origen" value={origen} onChange={setOrigen} placeholder="Ej. Lima" exclude={destino} />

          <button
            type="button"
            onClick={swap}
            aria-label="Intercambiar origen y destino"
            title="Intercambiar"
            className="self-center md:self-end shrink-0 w-10 h-10 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm flex items-center justify-center text-primary dark:text-white hover:bg-primary hover:text-white hover:border-primary transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4"/></svg>
          </button>

          <AutocompleteField label="Destino" value={destino} onChange={setDestino} placeholder="Ej. Cusco" exclude={origen} />

          <div className="flex-1 md:max-w-[200px]">
            <label className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-1.5 block">Fecha</label>
            <div className="relative">
              <input
                type="date"
                value={fecha}
                min={hoy}
                onChange={e => setFecha(e.target.value)}
                className="w-full pl-4 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-primary dark:text-white focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/10 transition [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Opcional — filtra por día</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="submit" disabled={!canSearch || loading} className="disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px] flex items-center justify-center gap-2">
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Buscando...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M20 20L15 15"/></svg>
                Buscar viajes
              </>
            )}
          </Button>
          <button type="button" onClick={limpiar} className="px-6 py-2.5 rounded-xl font-semibold text-sm border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Limpiar
          </button>
          {!canSearch && origen && destino && (
            <span className="self-center text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">Origen ≠ Destino</span>
          )}
        </div>
      </form>

      {/* Estados */}
      {error && (
        <div className={`mt-5 rounded-xl px-4 py-3 text-sm font-medium border ${resultados.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {error}
        </div>
      )}

      {/* Resultados */}
      <div className="mt-6">
        {!hasSearched ? (
          <div className="bg-primary/5 dark:bg-white/5 border border-dashed border-primary/20 dark:border-white/10 rounded-2xl p-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300">Ingresa <span className="font-bold text-primary dark:text-white">origen</span> y <span className="font-bold text-primary dark:text-white">destino</span> y presiona <span className="font-bold">Buscar</span>. Usa el calendario para filtrar por fecha.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {['Lima → Cusco', 'Lima → Arequipa', 'Trujillo → Lima'].map(s => (
                <button key={s} onClick={() => { const [o,d]=s.split(' → '); setOrigen(o); setDestino(d) }} className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full hover:border-primary hover:text-primary transition-colors">{s}</button>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div className="grid gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/3" />
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-2/3 mt-3" />
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/4 mt-3" />
              </div>
            ))}
          </div>
        ) : resultados.length > 0 ? (
          <>
            <p className="text-xs font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase mb-3">{resultados.length} resultado(s) {fecha && `• ${new Date(fecha).toLocaleDateString()}`}</p>
            <div className="grid gap-4">
              {resultados.map(r => (
                <div key={r.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5 flex flex-col sm:flex-row justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-extrabold text-primary dark:text-white text-base flex items-center gap-2">
                      {r.origen} <span className="text-accent">→</span> {r.destino}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {r.fecha_salida ? new Date(r.fecha_salida).toLocaleDateString('es-PE', { weekday:'short', day:'2-digit', month:'short', year:'numeric' }) : 'Fecha por confirmar'} • {r.hora_salida} • Bus {r.bus_placa} <span className="inline-block bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full text-xs font-bold ml-1">{r.bus_tipo}</span>
                    </p>
                    <p className="text-sm mt-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${r.asientos_disponibles > 10 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : r.asientos_disponibles > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        <span className={`w-2 h-2 rounded-full ${r.asientos_disponibles > 10 ? 'bg-emerald-500' : r.asientos_disponibles > 0 ? 'bg-amber-500' : 'bg-red-500'}`} />
                        {r.asientos_disponibles} asientos libres
                      </span>
                    </p>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 sm:text-right shrink-0">
                    <p className="text-2xl font-extrabold text-primary dark:text-white">S/ {Number(r.precio_base).toFixed(2)}</p>
                    <Button onClick={() => navigate(`/asientos/${r.id}`)} disabled={r.asientos_disponibles === 0} className="disabled:opacity-40">
                      Ver Asientos
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <p className="text-[11px] text-gray-400 mt-6 text-center">Ciudades sugeridas: {CIUDADES.slice(0,8).join(' • ')} • Escribe para filtrar</p>
    </div>
  )
}
