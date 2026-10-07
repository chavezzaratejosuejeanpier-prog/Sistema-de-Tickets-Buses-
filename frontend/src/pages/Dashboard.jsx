import { useEffect, useState } from 'react'
import { getBuses, getRoutes, getSalesSummary } from '../services/api.js'

export default function Dashboard() {
  const [buses, setBuses] = useState([])
  const [rutas, setRutas] = useState([])
  const [ventas, setVentas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getBuses(), getRoutes(), getSalesSummary()])
      .then(([b, r, v]) => {
        setBuses(b.data)
        setRutas(r.data)
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
    <div className="p-6 flex items-center justify-center gap-3 text-muted dark:text-stone-400">
      <span className="spinner" aria-hidden="true" /> Cargando panel...
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-navy dark:text-white">Panel Administrativo</h1>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className="card p-6">
          <p className="text-sm font-medium text-muted dark:text-stone-400">Ventas Hoy</p>
          <p className="text-2xl font-bold text-navy dark:text-white mt-1">{ventas?.ventas_hoy ?? '--'}</p>
          <p className="text-sm text-green-600 dark:text-green-400">{moneda(ventas?.recaudacion_hoy)}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-muted dark:text-stone-400">Buses</p>
          <p className="text-2xl font-bold text-navy dark:text-white mt-1">{buses.length}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-muted dark:text-stone-400">Rutas</p>
          <p className="text-2xl font-bold text-navy dark:text-white mt-1">{rutas.length}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        <div className="card overflow-hidden">
          <h2 className="text-lg font-bold text-navy dark:text-white px-4 py-3 border-b border-line dark:border-stone-700">
            Buses ({buses.length})
          </h2>
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
                {buses.length === 0 && <tr><td colSpan="4" className="px-4 py-3 text-muted dark:text-stone-500">Sin buses registrados</td></tr>}
                {buses.map(b => (
                  <tr key={b.id} className="border-t border-line dark:border-stone-700">
                    <td className="px-4 py-2 font-semibold">{b.placa}</td>
                    <td className="px-4 py-2">{b.modelo}</td>
                    <td className="px-4 py-2">{b.tipo}</td>
                    <td className="px-4 py-2 text-right">{b.total_asientos} ({b.capacidad_piso1}+{b.capacidad_piso2})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <h2 className="text-lg font-bold text-navy dark:text-white px-4 py-3 border-b border-line dark:border-stone-700">
            Rutas ({rutas.length})
          </h2>
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
                {rutas.length === 0 && <tr><td colSpan="4" className="px-4 py-3 text-muted dark:text-stone-500">Sin rutas registradas</td></tr>}
                {rutas.map(r => (
                  <tr key={r.id} className="border-t border-line dark:border-stone-700">
                    <td className="px-4 py-2 font-semibold">{r.origen} → {r.destino}</td>
                    <td className="px-4 py-2">{new Date(r.fecha_salida).toLocaleDateString()} - {r.hora_salida}</td>
                    <td className="px-4 py-2">{busById[r.bus_id]?.placa || `#${r.bus_id}`} ({busById[r.bus_id]?.tipo || '-'})</td>
                    <td className="px-4 py-2 text-right">{moneda(r.precio_base)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}