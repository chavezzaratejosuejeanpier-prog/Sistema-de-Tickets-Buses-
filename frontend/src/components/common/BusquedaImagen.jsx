/* eslint-disable no-undef */
import { useState } from 'react'

export default function BusquedaImagen({ onBuscar }) {
  const [imagen, setImagen] = useState(null)

  return (
    <div className="p-4 rounded-2xl border-2 border-dashed border-line dark:border-stone-700 bg-white dark:bg-stone-900 text-center">
      <label className="block cursor-pointer">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              setImagen(URL.createObjectURL(file))
            }
          }}
        />
        <div className="w-24 h-24 mx-auto mb-3 rounded-full border-2 border-dashed border-stone-300 dark:border-stone-600 flex flex-col items-center justify-center hover:border-primary transition-colors">
          <span className="text-[20px]">📷</span>
          <span className="text-[10px] text-stone-500 dark:text-stone-500 mt-1">
            Subir foto
          </span>
        </div>
      </label>
      {imagen && (
        <div className="mt-4">
          <img
            src={imagen}
            alt="Preview"
            className="w-32 h-32 mx-auto rounded-lg object-cover border border-line dark:border-stone-700"
          />
          <button
            onClick={() => onBuscar?.(imagen)}
            className="mt-2 btn-primary text-xs"
          >
            Buscar rutas similares
          </button>
        </div>
      )}
      <p className="text-[10px] text-stone-500 dark:text-stone-500 mt-3">
        La búsqueda por imagen está en versión beta.
      </p>
    </div>
  )
}