/**
 * Mapa de asientos en vista isométrica (CSS 3D perspectiva).
 */
export default function AsientosIsometricos() {
  return (
    <div className="p-4 rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900">
      <h3 className="text-sm font-bold text-navy dark:text-white mb-4">Vista Isométrica del Bus</h3>
      <div className="perspective-1000">
        <div className="rotate-x-[60deg] rotate-y-[-30deg] transform-style-preserve-3d">
          {[1, 2, 3, 4].map((fila) => (
            <div key={fila} className="flex justify-center mb-3">
              {[1, 2].map((col) => (
                <div key={col} className="w-8 h-8 border border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 rounded-lg shadow-inner m-1 flex items-center justify-center text-[10px] font-bold text-stone-700 dark:text-stone-300 transform perspective-500 rotate-x-[45deg]">
                  {fila}{col}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-stone-500 dark:text-stone-500 mt-2 text-center">
        Vista isométrica en desarrollo • Próximamente interactiva
      </p>
    </div>
  )
}