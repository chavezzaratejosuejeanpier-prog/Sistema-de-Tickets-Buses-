export default function ViajeTiempoReal({ progreso = 30, origen = 'Lima', destino = 'Cusco' }) {
  return (
    <div className="p-4 rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase">
          {origen}
        </span>
        <span className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase">
          {destino}
        </span>
      </div>
      <svg className="w-full h-24" viewBox="0 0 400 120" aria-label="Progreso del viaje">
        <defs>
          <linearGradient id="rutaGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#00f2ff" />
          </linearGradient>
        </defs>
        <path
          d="M 20 80 Q 200 20 380 80"
          fill="none"
          stroke="url(#rutaGrad)"
          strokeWidth="4"
          strokeDasharray="500"
          strokeDashoffset={500 - (500 * progreso) / 100}
          className="transition-all duration-1000"
        />
        <circle
          cx={20 + (360 * progreso) / 100}
          cy={80}
          r="6"
          fill="#F97316"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="flex justify-between text-xs text-stone-500 dark:text-stone-500 mt-2">
        <span>{Math.floor(progreso)}% completado</span>
        <span>ETA: 2h 15m</span>
      </div>
      <div className="w-full h-2 bg-stone-200 dark:bg-stone-700 rounded-full mt-3 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-1000"
          style={{ width: `${progreso}%` }}
        />
      </div>
    </div>
  )
}