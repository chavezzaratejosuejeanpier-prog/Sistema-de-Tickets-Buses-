import { X } from 'lucide-react'

/**
 * Panel de configuración rápida deslizable desde el borde.
 */
export default function PanelConfig({ abierto = false, onCerrar }) {
  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCerrar} />
      <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-stone-900 border-l border-line dark:border-stone-700 shadow-2xl transform transition-transform duration-300 translate-x-0 flex flex-col">
        <div className="p-4 border-b border-line dark:border-stone-700 flex items-center justify-between">
          <h3 className="font-bold text-navy dark:text-white">Configuración Rápida</h3>
          <button onClick={onCerrar} className="text-stone-600 dark:text-stone-400 hover:text-red-500 dark:hover:text-red-400">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase">Tamaño de fuente</label>
            <div className="flex gap-2">
              {['sm', 'base', 'lg'].map((t) => (
                <button
                  key={t}
                  className="w-8 h-8 rounded border border-line dark:border-stone-700 text-xs font-bold transition-colors hover:bg-primary hover:text-white"
                >
                  Aa
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase">Contraste</label>
            <button className="w-full flex items-center justify-between p-2 rounded border border-line dark:border-stone-700 bg-white dark:bg-stone-800">
              <span>Modo Alto Contraste</span>
              <span className="text-[10px]">Activado</span>
            </button>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase">Movimiento</label>
            <button className="w-full flex items-center justify-between p-2 rounded border border-line dark:border-stone-700 bg-white dark:bg-stone-800">
              <span>Reducir movimiento</span>
              <span className="text-[10px]">Desactivado</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}