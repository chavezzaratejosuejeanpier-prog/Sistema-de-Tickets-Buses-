import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Modo Foco: oscurece toda la página excepto el elemento activo.
 */
export default function ModoFoco({ habilitado = false }) {
  const [activo, setActivo] = useState(habilitado)

  return (
    <div className={`fixed inset-0 z-[50] pointer-events-none transition-all duration-300 ${activo ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent'}`}>
      <button
        onClick={() => setActivo((a) => !a)}
        className="fixed top-4 right-4 z-[60] w-8 h-8 rounded-full flex items-center justify-center border border-line dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-primary hover:text-white transition-colors"
        aria-label={activo ? 'Desactivar modo foco' : 'Activar modo foco'}
      >
        {activo ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      {activo && (
        <div className="fixed top-4 left-4 z-[59]">
          <span className="text-xs font-bold text-white bg-primary px-2 py-1 rounded">MODO FOCO</span>
        </div>
      )}
    </div>
  )
}