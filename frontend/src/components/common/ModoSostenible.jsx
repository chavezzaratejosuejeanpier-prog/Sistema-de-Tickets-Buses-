export default function ModoSostenible({ distanciaKm = 300 }) {
  const co2Bus = distanciaKm * 0.05
  const co2Avion = distanciaKm * 0.25
  const ahorrado = co2Avion - co2Bus
  const arboles = Math.floor(ahorrado / 20)

  return (
    <div className="p-4 rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
          <span className="text-[10px]">🌿</span>
        </span>
        <h3 className="text-sm font-bold text-navy dark:text-white">Viaje Sostenible</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800">
          <p className="text-[10px] text-stone-500 dark:text-stone-400 uppercase">Bus</p>
          <p className="text-lg font-bold text-navy dark:text-white">{co2Bus.toFixed(1)} kg CO₂</p>
        </div>
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20">
          <p className="text-[10px] text-red-500 dark:text-red-400 uppercase">Avión</p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">{co2Avion.toFixed(1)} kg CO₂</p>
        </div>
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400 mb-1">
          <span>CO₂ ahorrado</span>
          <span className="font-bold text-green-600 dark:text-green-400">{ahorrado.toFixed(1)} kg</span>
        </div>
        <div className="w-full h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-1000"
            style={{ width: `${Math.min(100, (ahorrado / co2Avion) * 100)}%` }}
          />
        </div>
      </div>
      <p className="text-sm text-center text-stone-700 dark:text-stone-300">
        Equivale a <span className="font-bold text-green-600 dark:text-green-400">{arboles}</span> árbol{arboles !== 1 ? 'es' : ''} plantado{arboles !== 1 ? 's' : ''}.
      </p>
    </div>
  )
}