import React from 'react';

const Seat = ({ number, status, onClick }) => {
  
  const getStatusClasses = () => {
    switch (status) {
      case 'libre':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200 cursor-pointer';
      case 'seleccionado':
        return 'bg-orange-500 text-white border-orange-600 hover:bg-orange-600 cursor-pointer';
      case 'ocupado':
      case 'reservado':
        return 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed';
      default:
        return 'bg-white text-gray-700 border-gray-300';
    }
  };

  return (
    <button
      onClick={() => {
        if (status === 'libre' || status === 'seleccionado') {
          onClick(number);
        }
      }}
      disabled={status === 'ocupado' || status === 'reservado'}
      className={`relative w-12 h-12 m-1 rounded-t-lg rounded-b-sm border-2 font-bold text-sm transition-colors duration-200 flex items-center justify-center ${getStatusClasses()}`}
    >
      {number}
      {/* Detalle visual simulando el respaldar del asiento */}
      <div className="absolute top-0 w-full h-2 bg-black/10 rounded-t-md"></div>
    </button>
  );
};

export default Seat;
