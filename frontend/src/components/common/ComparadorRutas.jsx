import { motion } from 'framer-motion'
import { ArrowLeftRight, Bus, Clock, MapPin } from 'lucide-react'

/**
 * Comparador de rutas lado a lado con animación "VS".
 * Se usa para comparar dos opciones de ruta antes de elegir.
 */
export default function ComparadorRutas({ rutaA, rutaB, onSeleccionar }) {
  return (
    <div className="rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900 shadow-lg overflow-hidden">
      <div className="grid grid-cols-2">
        <RutaComparada
          key="a"
          ruta={rutaA}
          lado="izquierda"
          onSeleccionar={onSeleccionar}
        />
        <div className="flex flex-col items-center justify-center gap-2 bg-stone-50 dark:bg-stone-800/50 border-r border-line dark:border-stone-700">
          <ArrowLeftRight size={20} className="text-muted dark:text-stone-500" aria-hidden="true" />
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-600">VS</span>
        </div>
        <RutaComparada
          key="b"
          ruta={rutaB}
          lado="derecha"
          onSeleccionar={onSeleccionar}
        />
      </div>
    </div>
  )
}

function RutaComparada({ ruta, lado, onSeleccionar }) {
  const ocupado = ruta.asientos_disponibles === 0
  const colorAcento = `hsl(${ruta.hashColor || 30}, 75%, 60%)`

  return (
    <motion.div
      initial={{ opacity: 0, x: lado === 'izquierda' ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-4 border-r border-line dark:border-stone-700 last:border-0 flex flex-col"
      style={lado === 'derecha' ? { borderRight: 'none' } : {}}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          Opción {lado === 'izquierda' ? 'A' : 'B'}
        </span>
        <button
          onClick={() => onSeleccionar(ruta)}
          className={`px-2 py-1 rounded-md text-xs font-bold border transition-colors ${
            ocupado
              ? 'border-red-500 text-red-500 dark:border-red-400 dark:text-red-300 bg-red-50 dark:bg-red-950/20'
              : `border-${colorAcento.replace('hsl(', '').replace(')', '').split(',')[0]}-500 text-${colorAcento.replace('hsl(', '').replace(')', '').split(',')[0]}-500 bg-${colorAcento.replace('hsl(', '').replace(')', '').split(',')[0]}-50/20`
          }`}
        >
          {ocupado ? 'Lleno' : 'Elegir'}
        </button>
      </div>

      <div className="mb-3">
        <MapPin size={16} className="text-muted dark:text-stone-500" aria-hidden />
        <p className="font-extrabold text-navy dark:text-white text-sm leading-tight">
          {ruta.origen} <span className="text-primary">→</span> {ruta.destino}
        </p>
      </div>

      <div className="space-y-1 mb-3">
        <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
          <Clock size={14} aria-hidden="true" />
          <span>{ruta.fecha_salida ? new Date(ruta.fecha_salida).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '—'} · {ruta.hora_salida}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-text-stone-400">
          <Bus size={14} aria-hidden="true" />
          <span>{ruta.duracion_horas} h • {ruta.bus_tipo}</span>
        </div>
      </div>

      <div className="mt-auto pt-3">
        <p className="text-2xl font-extrabold text-navy dark:text-white">S/ {Number(ruta.precio_base).toFixed(2)}</p>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${
            ocupado
              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
              : ruta.asientos_disponibles > 10
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                : 'bg-gray-50 dark:bg-stone-800 border-black/5 dark:border-stone-700 text-stone-600 dark:text-stone-300'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${
            ocupado ? 'bg-red-500' : ruta.asientos_disponibles > 10 ? 'bg-emerald-500' : 'bg-amber-500'
          }`} />
          {ocupado ? 'Sin asientos' : `${ruta.asientos_disponibles} asientos`}
        </span>
      </div>
    </motion.div>
  )
}