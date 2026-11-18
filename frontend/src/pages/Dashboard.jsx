import { useEffect, useState } from 'react'
import { TrendingUp, Bus, MapPin } from 'lucide-react'
import Skeleton from '../components/common/Skeleton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { getBuses, getRoutes, getSalesSummary } from '../services/api.js'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const MAX_FILAS = 100

export default function Dashboard() {
  const [buses, setBuses] = useState([])
  const [salidas, setSalidas] = useState([])
  const [programa, setPrograma] = useState({ total: 0, pares: 0 })
  const [ventas, setVentas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getBuses(), getRoutes(), getSalesSummary()])
      .then(([b, r, v]) => {
        setBuses(b.data)
        setSalidas(r.data.rutas)
        setPrograma({ total: r.data.total, pares: r.data.pares })
        setVentas(v.data)
      })
      .catch((err) => setError(
        err.response?.status === 403
          ? 'Necesitas una cuenta de administrador para ver el panel.'
          : err.response?.status === 401
            ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
            : 'No se pudieron cargar los datos. Verifica que el backend esté activo.'
      ))
      .finally(() => setLoading(false))
  }, [])

  const busById = Object.fromEntries(buses.map(b => [b.id, b]))
  const moneda = n => `S/ ${Number(n || 0).toFixed(2)}`

  if (loading) return (
    <div className="max-w-5xl mx-auto animate-pulse">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {[1,2,3].map(i => (
          <div key={i} className="card p-6 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-6">
        {[1,2].map(i => (
          <div key={i} className="card p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            {[1,2,3,4].map(j => <Skeleton key={j} className="h-4 w-full" />)}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-navy dark:text-white">Panel Administrativo</h1>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className="card p-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted dark:text-stone-400">Ventas Hoy</p>
            <p className="text-2xl font-bold text-navy dark:text-white mt-1">{ventas?.ventas_hoy ?? '--'}</p>
            <p className="text-sm text-green-600 dark:text-green-400">{moneda(ventas?.recaudacion_hoy)}</p>
          </div>
          <span className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary">
            <TrendingUp size={20} aria-hidden="true" />
          </span>
        </div>
        <div className="card p-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted dark:text-stone-400">Buses</p>
            <p className="text-2xl font-bold text-navy dark:text-white mt-1">{buses.length}</p>
          </div>
          <span className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary">
            <Bus size={20} aria-hidden="true" />
          </span>
        </div>
        <div className="card p-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted dark:text-stone-400">Rutas</p>
            <p className="text-2xl font-bold text-navy dark:text-white mt-1">{programa.pares}</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">{programa.total} salidas programadas</p>
          </div>
          <span className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary">
            <MapPin size={20} aria-hidden="true" />
          </span>
        </div>
      </div>

      <div className="mt-6 card p-6">
        <h2 className="text-lg font-bold text-navy dark:text-white mb-4">Buses por tipo</h2>
        {buses.length === 0 ? (
          <EmptyState icon={Bus} title="Sin datos" description="No hay buses para graficar." />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Object.entries(buses.reduce((acc, b) => { acc[b.tipo] = (acc[b.tipo] || 0) + 1; return acc }, {})).map(([tipo, count]) => ({ tipo, count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="tipo" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="count" fill="#F97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6">
        <div className="card overflow-hidden">
          <h2 className="text-lg font-bold text-navy dark:text-white px-4 py-3 border-b border-line dark:border-stone-700">
            Buses ({buses.length})
          </h2>
          {buses.length === 0 ? (
            <EmptyState className="m-4" icon={Bus} title="Sin buses registrados" description="Agrega buses desde el backend para verlos aquí." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-stone-800 text-left text-muted dark:text-stone-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Placa</th>
                    <th className="px-4 py-2 font-semibold">Modelo</th>
                    <th className="px-4 py-2 font-semibold">Tipo</th>
                    <th className="px-4 py-2 font-semibold text-right">Asientos</th>
                  </tr>
                </thead>
                <tbody className="text-navy dark:text-stone-200">
                  {buses.map(b => (
                    <tr key={b.id} className="border-t border-line dark:border-stone-700 transition-colors hover:bg-slate-50 dark:hover:bg-stone-800/60">
                      <td className="px-4 py-2 font-semibold">{b.placa}</td>
                      <td className="px-4 py-2">{b.modelo}</td>
                      <td className="px-4 py-2">{b.tipo}</td>
                      <td className="px-4 py-2 text-right">{b.total_asientos} ({b.capacidad_piso1}+{b.capacidad_piso2})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <h2 className="text-lg font-bold text-navy dark:text-white px-4 py-3 border-b border-line dark:border-stone-700">
            Próximas salidas ({programa.total})
          </h2>
          {salidas.length === 0 ? (
            <EmptyState className="m-4" icon={MapPin} title="Sin salidas programadas" description="Programa rutas desde el backend." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-stone-800 text-left text-muted dark:text-stone-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Ruta</th>
                    <th className="px-4 py-2 font-semibold">Salida</th>
                    <th className="px-4 py-2 font-semibold">Bus</th>
                    <th className="px-4 py-2 font-semibold text-right">Precio</th>
                  </tr>
                </thead>
                <tbody className="text-navy dark:text-stone-200">
                  {salidas.slice(0, MAX_FILAS).map(r => (
                    <tr key={r.id} className="border-t border-line dark:border-stone-700 transition-colors hover:bg-slate-50 dark:hover:bg-stone-800/60">
                      <td className="px-4 py-2 font-semibold">{r.origen} → {r.destino}</td>
                      <td className="px-4 py-2">{new Date(r.fecha_salida).toLocaleDateString('es-PE')} - {r.hora_salida}</td>
                      <td className="px-4 py-2">{busById[r.bus_id]?.placa || `#${r.bus_id}`} ({busById[r.bus_id]?.tipo || '-'})</td>
                      <td className="px-4 py-2 text-right">{moneda(r.precio_base)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {programa.total > MAX_FILAS && (
            <p className="px-4 py-2 text-xs text-muted dark:text-stone-400 border-t border-line dark:border-stone-700">
              Mostrando las {MAX_FILAS} salidas más próximas de {programa.total}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}