import React, { memo } from 'react'

const ESTADOS = {
  ocupado: 'bg-gray-100 text-stone-400 border-black/5 cursor-not-allowed',
  reservado: 'bg-gray-100 text-stone-400 border-black/5 cursor-not-allowed',
  seleccionado: 'bg-accent text-white border-accent shadow-sm hover:bg-accent-hover cursor-pointer',
  libre: 'bg-white text-navy border-black/10 hover:bg-navy hover:text-white hover:border-navy cursor-pointer',
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
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
        disabled:focus-visible:ring-0 ${ESTADOS[estadoVisual] || ESTADOS.libre}`}
    >
      <span className="relative z-10">{numero}</span>
      <span className="absolute top-0 inset-x-0 h-1.5 bg-black/10 rounded-t-xl pointer-events-none" aria-hidden />
      <span className="absolute bottom-1 w-6 h-1 bg-black/10 rounded-full pointer-events-none" aria-hidden />
      {selected && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full shadow flex items-center justify-center pointer-events-none" aria-hidden>
          <span className="w-1.5 h-1.5 bg-accent rounded-full" />
        </span>
      )}
    </button>
  )
})

export default Seat
