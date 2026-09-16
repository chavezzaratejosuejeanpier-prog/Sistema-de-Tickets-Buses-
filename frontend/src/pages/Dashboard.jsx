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
      .catch(() => setError('No se pudieron cargar los datos. Verifica que el backend esté activo.'))
      .finally(() => setLoading(false))
  }, [])

  const busById = Object.fromEntries(buses.map(b => [b.id, b]))
  const moneda = n => `S/ ${Number(n || 0).toFixed(2)}`

  if (loading) return <p className="p-6">Cargando dashboard...</p>

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-primary">Dashboard Administrativo</h1>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-white p-6 rounded shadow">
          <p className="text-gray-500">Ventas Hoy</p>
          <p className="text-2xl font-bold">{ventas?.ventas_hoy ?? '--'}</p>
          <p className="text-sm text-green-600">{moneda(ventas?.recaudacion_hoy)}</p>
        </div>
        <div className="bg-white p-6 rounded shadow">
          <p className="text-gray-500">Buses</p>
          <p className="text-2xl font-bold">{buses.length}</p>
        </div>
        <div className="bg-white p-6 rounded shadow">
          <p className="text-gray-500">Rutas</p>
          <p className="text-2xl font-bold">{rutas.length}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        <div className="bg-white rounded shadow overflow-hidden">
          <h2 className="text-lg font-bold text-primary px-4 py-3 border-b">Buses ({buses.length})</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Placa</th>
                <th className="px-4 py-2">Modelo</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2 text-right">Asientos</th>
              </tr>
            </thead>
            <tbody>
              {buses.length === 0 && <tr><td colSpan="4" className="px-4 py-3 text-gray-400">Sin buses registrados</td></tr>}
              {buses.map(b => (
                <tr key={b.id} className="border-t">
                  <td className="px-4 py-2 font-semibold">{b.placa}</td>
                  <td className="px-4 py-2">{b.modelo}</td>
                  <td className="px-4 py-2">{b.tipo}</td>
                  <td className="px-4 py-2 text-right">{b.total_asientos} ({b.capacidad_piso1}+{b.capacidad_piso2})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded shadow overflow-hidden">
          <h2 className="text-lg font-bold text-primary px-4 py-3 border-b">Rutas ({rutas.length})</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Ruta</th>
                <th className="px-4 py-2">Salida</th>
                <th className="px-4 py-2">Bus</th>
                <th className="px-4 py-2 text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              {rutas.length === 0 && <tr><td colSpan="4" className="px-4 py-3 text-gray-400">Sin rutas registradas</td></tr>}
              {rutas.map(r => (
                <tr key={r.id} className="border-t">
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
  )
}