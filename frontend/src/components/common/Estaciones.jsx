/**
 * Temas de estación del año aplicados sobre el documento.
 * Clases: estacion-primavera, estacion-verano, estacion-otonno, estacion-invierno
 */
import { useState } from 'react'
import { Leaf, Sun, MapPin, Snowflake } from 'lucide-react'

const ESTACIONES = [
  { id: 'primavera', nombre: 'Primavera', color: 'text-emerald-500', Icono: Leaf },
  { id: 'verano', nombre: 'Verano', color: 'text-orange-500', Icono: Sun },
  { id: 'otonno', nombre: 'Otoño', color: 'text-amber-600', Icono: MapPin },
  { id: 'invierno', nombre: 'Invierno', color: 'text-blue-500', Icono: Snowflake },
]

export default function Estaciones({ activa = '' }) {
  const [seleccionada, setSeleccionada] = useState(activa)

  const aplicar = (id) => {
    const root = document.documentElement
    root.classList.remove('estacion-primavera', 'estacion-verano', 'estacion-otonno', 'estacion-invierno')
    if (id) root.classList.add(`estacion-${id}`)
    setSeleccionada(id)
  }

  return (
    <div className="flex gap-2">
      {ESTACIONES.map((e) => (
        <button
          key={e.id}
          onClick={() => aplicar(e.id)}
          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${seleccionada === e.id ? `border-${e.color.split('-')[1]}-500 bg-${e.color.split('-')[1]}-500 text-white` : 'border-line dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}
          title={e.nombre}
          aria-label={`Temporada: ${e.nombre}`}
        >
          <e.Icono size={14} />
        </button>
      ))}
    </div>
  )
}