import React from 'react';

const Seat = ({ number, numero, status, estado, selected, onClick }) => {
  // Compatibilidad: BusMap pasa {numero, estado, selected}, demo/otros pasan {number, status}
  const num = number ?? numero;
  const isSelected = selected ?? status === 'seleccionado';
  const normalizedStatus = estado ?? status ?? (isSelected ? 'seleccionado' : 'libre');

  const getStatusClasses = () => {
    if (normalizedStatus === 'ocupado' || normalizedStatus === 'reservado') {
      return 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed';
    }
    if (isSelected || normalizedStatus === 'seleccionado') {
      return 'bg-accent text-white border-accent shadow-md scale-[1.02] cursor-pointer';
    }
    if (normalizedStatus === 'libre') {
      return 'bg-white text-primary border-primary/30 hover:bg-primary hover:text-white hover:border-primary hover:shadow-md cursor-pointer';
    }
    return 'bg-white text-gray-700 border-gray-300';
  };

  const disabled = normalizedStatus === 'ocupado' || normalizedStatus === 'reservado';

  return (
    <button
      onClick={() => {
        if (!disabled) onClick?.(num);
      }}
      disabled={disabled}
      aria-label={`Asiento ${num} - ${disabled ? 'ocupado' : isSelected ? 'seleccionado' : 'libre'}`}
      className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-t-xl rounded-b-md border-2 font-bold text-sm transition-all duration-200 flex items-center justify-center select-none ${getStatusClasses()}`}
    >
      {num}
      <div className="absolute top-0 w-full h-1.5 bg-black/10 rounded-t-xl" />
      <div className="absolute bottom-1 w-6 h-1 bg-black/10 rounded-full" />
    </button>
  );
};

export default Seat;
