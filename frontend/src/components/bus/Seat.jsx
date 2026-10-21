import React, { memo } from 'react'

const ESTADOS = {
  ocupado: 'bg-gray-100 text-stone-400 border-black/5 cursor-not-allowed dark:bg-stone-800 dark:text-stone-600 dark:border-white/5',
  reservado: 'bg-amber-50 text-amber-600 border-amber-300 cursor-not-allowed dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  seleccionado: 'bg-primary text-white border-primary shadow-soft hover:bg-primary-dark cursor-pointer',
  libre: 'bg-white text-emerald-700 border-success/50 hover:bg-navy hover:text-white hover:border-navy cursor-pointer dark:bg-stone-900 dark:text-emerald-300 dark:border-success/50 dark:hover:bg-primary dark:hover:text-white dark:hover:border-primary',
}

const Seat = memo(function Seat({ numero, estado = 'libre', selected = false, onClick }) {
  const estadoVisual = selected ? 'seleccionado' : estado

  return (
    <button
      type="button"
      disabled={estadoVisual === 'ocupado' || estadoVisual === 'reservado'}
      aria-pressed={selected}
      aria-label={`Asiento ${numero} - ${estadoVisual}`}
      title={`Asiento ${numero} - ${estadoVisual}`}
      onClick={() => onClick?.(numero)}
      className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-t-xl rounded-b-md border-2 font-bold text-sm
        transition-colors duration-200 flex items-center justify-center select-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        disabled:focus-visible:ring-0 ${ESTADOS[estadoVisual] || ESTADOS.libre}`}
    >
      <span className="relative z-10">{numero}</span>
      <span className="absolute top-0 inset-x-0 h-1.5 bg-black/10 rounded-t-xl pointer-events-none" aria-hidden />
      <span className="absolute bottom-1 w-6 h-1 bg-black/10 rounded-full pointer-events-none" aria-hidden />
      {selected && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full shadow flex items-center justify-center pointer-events-none" aria-hidden>
          <span className="w-1.5 h-1.5 bg-primary rounded-full" />
        </span>
      )}
    </button>
  )
})

export default Seat
