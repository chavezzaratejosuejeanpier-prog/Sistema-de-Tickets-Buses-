export default function ModoTurista() {
  const destinos = [
    { nombre: 'Cusco', clima: 'Soleado', temp: '22°C', tipo: 'montaña', icono: '🏔️' },
    { nombre: 'Lima', clima: 'Nublado', temp: '18°C', tipo: 'ciudad', icono: '🏙️' },
    { nombre: 'Piura', clima: 'Cálido', temp: '31°C', tipo: 'playa', icono: '🏖️' },
    { nombre: 'Iquitos', clima: 'Lluvioso', temp: '28°C', tipo: 'selva', icono: '🌴' },
  ]

  const ahora = new Date().getHours()
  const recomendacion = ahora < 12 ? 'Cusco' : ahora < 18 ? 'Lima' : 'Piura'

  return (
    <div className="p-4 rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center">
          ✈️
        </span>
        <h3 className="text-sm font-bold text-navy dark:text-white">Modo Turista</h3>
      </div>
      <p className="text-xs text-stone-600 dark:text-stone-400 mb-4">
        Recomendación según la hora del día: <span className="font-bold text-primary">{recomendacion}</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        {destinos.map((d) => (
          <div key={d.nombre} className="p-3 rounded-xl border border-line dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[20px]">{d.icono}</span>
              <span className={`text-[10px] font-bold uppercase ${
                d.tipo === 'playa' ? 'text-blue-600' : d.tipo === 'montaña' ? 'text-green-600' : 'text-stone-600'
              }`}>
                {d.tipo}
              </span>
            </div>
            <h4 className="font-bold text-stone-800 dark:text-white mb-1">{d.nombre}</h4>
            <div className="flex items-center gap-1 text-[10px] text-stone-500 dark:text-stone-400">
              <span>🌡️ {d.temp}</span>
              <span>•</span>
              <span>{d.clima}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}