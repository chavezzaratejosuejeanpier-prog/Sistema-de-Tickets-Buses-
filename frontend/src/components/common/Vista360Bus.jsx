export default function Vista360Bus() {
  return (
    <div className="p-4 rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900">
      <h3 className="text-sm font-bold text-navy dark:text-white mb-3">Vista 360° del Bus</h3>
      <div className="aspect-video bg-stone-800 rounded-xl flex items-center justify-center relative overflow-hidden">
        <div className="flex flex-col items-center justify-center text-stone-400 dark:text-stone-500">
          <span className="text-4xl mb-2">🚌</span>
          <p className="text-sm">Vista 360° en desarrollo</p>
          <p className="text-[10px] mt-1">Próximamente: recorra el interior del bus</p>
        </div>
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            className="p-2 rounded-lg border border-line dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-primary hover:text-white transition-colors"
            title="Rotar izquierda"
          >
            <span className="text-[12px]">↺</span>
          </button>
          <button
            className="p-2 rounded-lg border border-line dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-primary hover:text-white transition-colors"
            title="Rotar derecha"
          >
            <span className="text-[12px]">↻</span>
          </button>
        </div>
      </div>
    </div>
  )
}