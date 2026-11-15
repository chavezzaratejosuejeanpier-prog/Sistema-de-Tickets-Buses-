export default function MiembrosCard({ plan = 'plata', activo = false, onSeleccionar }) {
  const planes = {
    plata: {
      nombre: 'Plata',
      color: 'text-stone-500',
      borde: 'border-stone-200 dark:border-stone-700',
      bg: 'bg-stone-50/50 dark:bg-stone-900/30',
      beneficios: ['Reserva estándar', 'Soporte por email', 'Check-in normal'],
    },
    oro: {
      nombre: 'Oro',
      color: 'text-amber-500',
      borde: 'border-amber-200 dark:border-amber-700',
      bg: 'bg-amber-50/50 dark:bg-amber-900/20',
      beneficios: ['Asiento preferencial', 'Soporte prioritario', 'Check-in rápido'],
    },
    platino: {
      nombre: 'Platino',
      color: 'text-emerald-500',
      borde: 'border-emerald-200 dark:border-emerald-700',
      bg: 'bg-emerald-50/50 dark:bg-emerald-900/20',
      beneficios: ['Asiento VIP', 'Soporte 24/7', 'Check-in exprés', 'Salas VIP'],
    },
  }

  const p = planes[plan]

  return (
    <div
      className={`rounded-2xl border ${p.borde} ${p.bg} p-6 transition-all duration-300 hover:shadow-lift ${activo ? 'ring-4 ring-offset-2 ring-primary' : ''}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-8 h-8 rounded-full ${p.color}`} />
        <h3 className="text-xl font-bold text-navy dark:text-white">{p.nombre}</h3>
      </div>
      <p className="text-stone-600 dark:text-stone-400 text-sm mb-6">
        Plan diseñado para viajeros frecuentes.
      </p>
      <ul className="space-y-2 mb-6">
        {p.beneficios.map((b, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            {b}
          </li>
        ))}
      </ul>
      <button
        onClick={() => onSeleccionar?.(plan)}
        className="w-full py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
      >
        {activo ? 'Activo' : 'Seleccionar plan'}
      </button>
    </div>
  )
}