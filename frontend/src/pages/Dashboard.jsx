import { useEffect, useState } from 'react'
import { getBuses, getRoutes } from '../services/api.js'

const empty = () => [
  { key: 'Ventas Hoy', value: '--' },
  { key: 'Buses Activos', value: '--' },
  { key: 'Rutas', value: '--' },
]

export default function Dashboard() {
  const [stats, setStats] = useState(empty())

  useEffect(() => {
    let activo = true
    Promise.allSettled([getBuses(), getRoutes()])
      .then(([buses, rutas]) => {
        if (!activo) return
        const busesOK = buses.status === 'fulfilled' ? buses.value?.data?.length ?? 0 : 0
        const rutasOK = rutas.status === 'fulfilled' ? rutas.value?.data?.length ?? 0 : 0
        setStats([
          { key: 'Ventas Hoy', value: '--' },
          { key: 'Buses Activos', value: busesOK },
          { key: 'Rutas', value: rutasOK },
        ])
      })
    return () => { activo = false }
  }, [])

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-primary">Dashboard Administrativo</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {stats.map(s => (
          <div key={s.key} className="card p-6">
            <p className="text-sm font-medium text-slate-500">{s.key}</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{s.value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-500 mt-4">Los datos se cargan desde /api/buses y /api/routes. Si el backend no está activo, verás "--".</p>
    </div>
  )
}