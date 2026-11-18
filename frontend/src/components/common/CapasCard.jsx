/**
 * Tarjetas con profundidad por capas (sombras múltiples apiladas).
 */
export default function CapasCard({ titulo, contenido }) {
  return (
    <div className="relative group p-8 rounded-2xl bg-white dark:bg-stone-900 border border-line dark:border-stone-700 shadow-[0_2px_4px_rgba(0,0,0,0.1),0_4px_8px_rgba(0,0,0,0.06),0_8px_16px_rgba(0,0,0,0.04),0_12px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.12),0_8px_16px_rgba(0,0,0,0.08),0_16px_32px_rgba(0,0,0,0.05),0_20px_40px_rgba(0,0,0,0.04)] transition-shadow duration-300">
      <div className="absolute inset-0 rounded-2xl border border-white/20 dark:border-white/10 pointer-events-none" />
      <h3 className="font-bold text-navy dark:text-white mb-2">{titulo}</h3>
      <p className="text-stone-600 dark:text-stone-400">{contenido}</p>
    </div>
  )
}