import { useState } from 'react'

export default function ARBoleto({ codigo }) {
  const [activo, setActivo] = useState(false)

  return (
    <div className="p-4 rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center">
          <span className="text-[10px]">📱</span>
        </span>
        <h3 className="text-sm font-bold text-navy dark:text-white">Realidad Aumentada</h3>
      </div>
      <div className="aspect-video bg-stone-900 rounded-xl flex items-center justify-center relative overflow-hidden">
        {activo ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <div className="text-6xl mb-2 animate-pulse">📷</div>
            <p className="text-lg font-bold">Escaneando su boleto...</p>
            <p className="text-stone-300 text-sm mt-2">Código: {codigo}</p>
          </div>
        ) : (
          <div className="text-center">
            <span className="text-4xl mb-2">📱</span>
            <p className="text-stone-500 dark:text-stone-400 text-sm">
              Active la cámara para escanear
            </p>
            <button
              onClick={() => setActivo(true)}
              className="mt-3 btn-primary text-xs"
            >
              Iniciar AR
            </button>
          </div>
        )}
      </div>
      <p className="text-[10px] text-stone-500 dark:text-stone-500 mt-3 text-center">
        Función experimental. Requiere cámara y permisos del navegador.
      </p>
    </div>
  )
}