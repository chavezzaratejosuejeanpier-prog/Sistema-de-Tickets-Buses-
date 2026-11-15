import { useState } from 'react'
import { Bus } from 'lucide-react'

export default function VelocidadPanel({ distanciaKm = 300, velocidadBase = 60 }) {
  const [velocidad, setVelocidad] = useState(velocidadBase)
  const tiempoHoras = distanciaKm / velocidad
  const minutos = Math.floor((tiempoHoras % 1) * 60)

  return (
    <div className="p-4 rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900">
      <h3 className="text-sm font-bold text-navy dark:text-white mb-3">Simulador de Velocidad</h3>
      <div className="mb-4">
        <label className="text-xs font-semibold text-stone-600 dark:text-stone-400 block mb-2">
          Velocidad del bus (km/h)
        </label>
        <input
          type="range"
          min="40"
          max="120"
          step="5"
          value={velocidad}
          onChange={(e) => setVelocidad(Number(e.target.value))}
          className="w-full h-2 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-xs text-stone-500 dark:text-stone-500 mt-1">
          <span>40 km/h</span>
          <span className="font-bold text-primary">{velocidad} km/h</span>
          <span>120 km/h</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800">
          <p className="text-[10px] text-stone-500 dark:text-stone-400 uppercase">Distancia</p>
          <p className="text-lg font-bold text-navy dark:text-white">{distanciaKm} km</p>
        </div>
        <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800">
          <p className="text-[10px] text-stone-500 dark:text-stone-400 uppercase">Tiempo estimado</p>
          <p className="text-lg font-bold text-navy dark:text-white">
            {Math.floor(tiempoHoras)}h {minutos}min
          </p>
        </div>
      </div>
      <div className="mt-4 h-8 bg-stone-200 dark:bg-stone-700 rounded-full flex items-center px-2 relative overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-orange-400 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, (velocidad / 120) * 100)}%` }}
        />
        <Bus size={14} className="absolute text-white z-10" style={{ left: `calc(${Math.min(100, (velocidad / 120) * 100)}% - 7px)` }} />
      </div>
      <p className="text-[10px] text-center text-stone-500 dark:text-stone-400 mt-2">
        Ajuste la velocidad para ver cómo varía el tiempo de llegada.
      </p>
    </div>
  )
}