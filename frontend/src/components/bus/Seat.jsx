import React, { memo } from 'react'

const Seat = memo(function Seat({ number, numero, status, estado, selected, onClick, className = '' }) {
  // Compatibilidad: BusMap pasa {numero, estado, selected}, otros pueden usar {number, status}
  const num = number ?? numero
  const isSelected = selected ?? status === 'seleccionado' ?? estado === 'seleccionado'
  const normalizedStatus = estado ?? status ?? (isSelected ? 'seleccionado' : 'libre')
  const disabled = normalizedStatus === 'ocupado' || normalizedStatus === 'reservado'

  const stateLabel = disabled ? 'ocupado' : isSelected ? 'seleccionado' : 'libre'

  const getStatusClasses = () => {
    if (disabled) {
      return 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-80'
    }
    if (isSelected) {
      return 'bg-accent text-white border-accent shadow-md hover:bg-accent-hover hover:border-accent-hover cursor-pointer'
    }
    // libre
    return 'bg-white text-primary border-primary/25 hover:bg-primary hover:text-white hover:border-primary hover:shadow-md active:scale-[0.97] cursor-pointer'
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onClick?.(num)
      }}
      disabled={disabled}
      aria-pressed={isSelected}
      aria-label={`Asiento ${num} - ${stateLabel}`}
      title={`Asiento ${num} - ${stateLabel}`}
      className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-t-xl rounded-b-md border-2 font-bold text-sm
        transition-colors duration-200 flex items-center justify-center select-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
        disabled:focus-visible:ring-0 ${getStatusClasses()} ${className}`}
    >
      <span className="relative z-10">{num}</span>
      {/* detalle superior sutil */}
      <span className="absolute top-0 inset-x-0 h-1.5 bg-black/10 rounded-t-xl pointer-events-none" aria-hidden />
      {/* apoyabrazos visual */}
      <span className="absolute bottom-1 w-6 h-1 bg-black/10 rounded-full pointer-events-none" aria-hidden />
      {/* check sutil cuando seleccionado */}
      {isSelected && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full shadow flex items-center justify-center pointer-events-none" aria-hidden>
          <span className="w-1.5 h-1.5 bg-accent rounded-full" />
        </span>
      )}
    </button>
  )
})

export default Seat
