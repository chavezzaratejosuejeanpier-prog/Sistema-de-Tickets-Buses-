import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

/**
 * Cronómetro de oferta límite con colores cambiantes según el tiempo restante.
 */
export default function OfertaLimitada({ segundosRestantes = 3600 }) {
  const [restantes, setRestantes] = useState(segundosRestantes)

  useEffect(() => {
    if (restantes <= 0) return
    const t = setInterval(() => setRestantes((r) => (r > 0 ? r - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [restantes])

  const h = Math.floor(restantes / 3600)
  const m = Math.floor((restantes % 3600) / 60)
  const s = restantes % 60
  const urgente = restantes < 300

  return (
    <div
      className={`rounded-xl border p-4 flex items-center gap-3 text-sm font-bold transition-colors ${urgente ? 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 animate-pulse' : 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'}`}
    >
      <Clock size={16} className={urgente ? 'animate-ping' : ''} />
      <span>Oferta limitada:</span>
      <span className="font-mono">{h.toString().padStart(2, '0')}:{m.toString().padStart(2, '0')}:{s.toString().padStart(2, '0')}</span>
      {urgente && <span className="text-[10px] ml-2 uppercase">¡Últimos minutos!</span>}
    </div>
  )
}