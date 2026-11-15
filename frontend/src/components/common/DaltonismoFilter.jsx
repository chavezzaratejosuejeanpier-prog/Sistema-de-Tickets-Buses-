import { useState } from 'react'
import { Eye } from 'lucide-react'

/**
 * Filtros de daltonismo aplicados sobre todo el documento.
 * Opciones: ninguno, protanopia, deuteranopia, tritanopia.
 */
export default function DaltonismoFilter() {
  const [filtro, setFiltro] = useState('ninguno')

  const aplicarFiltro = (tipo) => {
    const root = document.documentElement
    root.classList.remove('filtro-protanopia', 'filtro-deuteranopia', 'filtro-tritanopia')
    if (tipo === 'protanopia') root.classList.add('filtro-protanopia')
    if (tipo === 'deuteranopia') root.classList.add('filtro-deuteranopia')
    if (tipo === 'tritanopia') root.classList.add('filtro-tritanopia')
    setFiltro(tipo)
  }

  return (
    <div className="fixed bottom-20 left-4 z-[90] flex flex-col items-center gap-1">
      <button
        onClick={() => aplicarFiltro('ninguno')}
        title="Sin filtro"
        className={`w-8 h-8 rounded-full border transition-colors ${filtro === 'ninguno' ? 'border-primary bg-primary text-white' : 'border-line dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}
        aria-label="Filtro de daltonismo: ninguno"
      >
        <Eye size={14} />
      </button>
      <button
        onClick={() => aplicarFiltro('protanopia')}
        title="Protanopia (rojo-verde)"
        className={`w-8 h-8 rounded-full border transition-colors ${filtro === 'protanopia' ? 'border-red-500 bg-red-500 text-white' : 'border-line dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}
        aria-label="Filtro de daltonismo: protanopia"
      >
        <span className="text-[10px]">🔴</span>
      </button>
      <button
        onClick={() => aplicarFiltro('deuteranopia')}
        title="Deuteranopia (verde-rojo)"
        className={`w-8 h-8 rounded-full border transition-colors ${filtro === 'deuteranopia' ? 'border-green-500 bg-green-500 text-white' : 'border-line dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}
        aria-label="Filtro de daltonismo: deuteranopia"
      >
        <span className="text-[10px]">🟢</span>
      </button>
      <button
        onClick={() => aplicarFiltro('tritanopia')}
        title="Tritanopia (azul-amarillo)"
        className={`w-8 h-8 rounded-full border transition-colors ${filtro === 'tritanopia' ? 'border-blue-500 bg-blue-500 text-white' : 'border-line dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}
        aria-label="Filtro de daltonismo: tritanopia"
      >
        <span className="text-[10px]">🔵</span>
      </button>
    </div>
  )
}