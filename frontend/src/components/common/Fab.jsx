import { useState } from 'react'
import { Bus, Search, Ticket, HelpCircle, ChevronDown } from 'lucide-react'

/**
 * Botón flotante de acción rápida (FAB) con menú desplegable.
 * Siempre visible en la parte inferior derecha.
 */
export default function Fab() {
  const [abierto, setAbierto] = useState(false)

  const acciones = [
    { icono: Search, texto: 'Buscar viajes', to: '/buscar', color: 'text-primary' },
    { icono: Ticket, texto: 'Mis Pasajes', to: '/mis-pasajes', color: 'text-green-500' },
    { icono: Bus, texto: 'Rutas', to: '/', color: 'text-orange-500' },
    { icono: HelpCircle, texto: 'Asistente', to: '#', color: 'text-stone-600' },
  ]

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
      {/* Menú desplegable */}
      {abierto && (
        <div className="flex flex-col items-end gap-1">
          {acciones.map((a, i) => (
            <a
              key={i}
              href={a.to}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900 shadow-lg text-sm font-medium text-stone-700 dark:text-stone-200 transition-all duration-200 animate-in fade-in slide-in-from-right-2"
            >
              <a.icono size={16} className={a.color} aria-hidden="true" />
              {a.texto}
            </a>
          ))}
        </div>
      )}

      {/* Botón principal */}
      <button
        onClick={() => setAbierto(!abierto)}
        aria-label={abierto ? 'Cerrar menú rápido' : 'Abrir menú rápido'}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 transform hover:scale-105 bg-primary text-white"
      >
        {abierto ? <ChevronDown size={24} /> : <Bus size={24} />}
      </button>
    </div>
  )
}