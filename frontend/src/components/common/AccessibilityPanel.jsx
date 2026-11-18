import { useEffect, useState } from 'react'
import { Eye, Plus, Minus, CircleDashed } from 'lucide-react'

const SIZES = ['sm', 'base', 'lg', 'xl', '2xl']

export default function AccessibilityPanel({ open, onClose }) {
  const [tamano, setTamano] = useState(() => {
    try {
      const saved = localStorage.getItem('lux_font_size')
      return SIZES.includes(saved) ? saved : 'base'
    } catch { return 'base' }
  })

  useEffect(() => {
    document.documentElement.style.setProperty('--lux-font-scale', tamano === 'base' ? '1' : tamano === 'sm' ? '0.875' : tamano === 'lg' ? '1.125' : tamano === 'xl' ? '1.25' : '1.5')
  }, [tamano])

  const subir = () => {
    const i = SIZES.indexOf(tamano)
    if (i < SIZES.length - 1) setTamano(SIZES[i + 1])
  }
  const bajar = () => {
    const i = SIZES.indexOf(tamano)
    if (i > 0) setTamano(SIZES[i - 1])
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[101] w-full max-w-md rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900 shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-line dark:border-stone-700 flex items-center justify-between">
          <h3 className="font-bold text-navy dark:text-white">Accesibilidad</h3>
          <button onClick={onClose} className="text-muted hover:text-navy dark:hover:text-white">
            <CircleDashed size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-navy dark:text-stone-200 mb-2">Tamaño del texto</p>
            <div className="flex items-center justify-between gap-4">
              <button onClick={bajar} disabled={tamano === 'sm'} className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${tamano === 'sm' ? 'border-line text-muted bg-stone-50 dark:bg-stone-800 dark:border-stone-700' : 'border-primary text-primary bg-white dark:bg-stone-800 dark:border-stone-600'}`}>
                <Minus size={16} /> Menos
              </button>
              {tamano === 'base' ? (
                <span className="font-mono font-bold text-primary">Aa</span>
              ) : (
                <span className="font-mono font-bold text-stone-600 dark:text-stone-400">Aa</span>
              )}
              <button onClick={subir} disabled={tamano === '2xl'} className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${tamano === '2xl' ? 'border-line text-muted bg-stone-50 dark:bg-stone-800 dark:border-stone-700' : 'border-primary text-primary bg-white dark:bg-stone-800 dark:border-stone-600'}`}>
                Más <Plus size={16} />
              </button>
            </div>
            <p className={`text-xs text-muted mt-1 ${tamano === 'base' ? '' : 'dark:block'}`}>Actual: {tamano}</p>
          </div>
          <div className="pt-2 flex items-center justify-between text-xs text-muted">
            <span>Guardado en tu dispositivo</span>
            <Eye size={14} className="opacity-50" />
          </div>
        </div>
      </div>
    </div>
  )
}