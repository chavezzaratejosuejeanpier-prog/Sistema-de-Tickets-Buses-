export default function MapaCalorPrecios({ fechaSeleccionada, onSeleccionarFecha }) {
  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const precios = [45, 52, 38, 60, 75, 88, 40]
  const maxPrecio = Math.max(...precios)

  return (
    <div className="p-4 rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900">
      <h3 className="text-sm font-bold text-navy dark:text-white mb-3">Precios por día</h3>
      <div className="flex items-end gap-2 h-32">
        {dias.map((dia, i) => {
          const altura = Math.max(20, (precios[i] / maxPrecio) * 100)
          const intensidad = Math.floor((precios[i] / maxPrecio) * 5) + 1
          const seleccionado = fechaSeleccionada === i
          return (
            <div
              key={dia}
              onClick={() => onSeleccionarFecha?.(i)}
              className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${seleccionado ? 'ring-2 ring-primary' : ''}`}
            >
              <div
                className={`w-10 rounded-t-lg transition-all duration-300 bg-emerald-${intensidad * 100}/40 dark:bg-emerald-${intensidad * 100}/20 border border-emerald-${intensidad * 200}/30 dark:border-emerald-${intensidad * 200}/20`}
                style={{ height: `${altura}%` }}
              />
              <span className="text-[10px] font-bold text-stone-600 dark:text-stone-400">{dia}</span>
              <span className="text-[10px] text-stone-500 dark:text-stone-500">S/ {precios[i]}</span>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-stone-500 dark:text-stone-500 mt-2 text-center">
        Verde claro = precio bajo • Verde oscuro = precio alto
      </p>
    </div>
  )
}