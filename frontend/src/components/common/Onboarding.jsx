import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bus, MapPin, Ticket, Check } from 'lucide-react'

const PANTALLAS = [
  {
    titulo: 'Bienvenido a LUX',
    texto: 'Compra pasajes de bus en línea con la mejor experiencia de viaje.',
    icono: Bus,
    color: 'text-orange-500',
  },
  {
    titulo: 'Elige tu asiento',
    texto: 'Selecciona tu lugar favorito en el mapa del bus antes de pagar.',
    icono: MapPin,
    color: 'text-primary',
  },
  {
    titulo: 'Viaja seguro',
    texto: 'Tu código de reserva te da acceso a tu boleto digital en minutos.',
    icono: Ticket,
    color: 'text-green-500',
  },
]

export default function Onboarding({ onFinish }) {
  const [indice, setIndice] = useState(0)

  useEffect(() => {
    const prev = localStorage.getItem('lux_onboarding')
    if (prev === '1') {
      onFinish()
    }
  }, [onFinish])

  const siguiente = () => {
    if (indice < PANTALLAS.length - 1) {
      setIndice(i => i + 1)
    } else {
      localStorage.setItem('lux_onboarding', '1')
      onFinish()
    }
  }

  const { Icono, color, titulo, texto } = PANTALLAS[indice]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-white dark:bg-stone-950 flex flex-col items-center justify-center p-8"
    >
      <div className="flex items-center gap-2 mb-8">
        {PANTALLAS.map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors ${i === indice ? 'bg-primary' : 'bg-stone-300 dark:bg-stone-700'}`}
          />
        ))}
      </div>

      <div className="relative h-32 w-32 flex items-center justify-center mb-6">
        <Icono size={48} className={`absolute ${color} animate-pulse`} />
        <Icono size={32} className={`relative z-10 ${color}`} />
      </div>

      <h2 className="text-3xl font-extrabold text-navy dark:text-white mb-2 tracking-tight">{titulo}</h2>
      <p className="text-stone-600 dark:text-stone-400 text-lg max-w-md text-center mb-8">{texto}</p>

      <div className="flex gap-3">
        <button
          onClick={siguiente}
          className={`flex-1 btn-primary ${indice === PANTALLAS.length - 1 ? '' : 'opacity-60 pointer-events-none'}`}
        >
          {indice === PANTALLAS.length - 1 ? 'Empezar a viajar' : <span>Siguiente <Check size={16} className="ml-2" /></span>}
        </button>
        {indice > 0 && (
          <button
            onClick={() => setIndice(i => i - 1)}
            className="btn-ghost"
          >
            Atrás
          </button>
        )}
      </div>
    </motion.div>
  )
}