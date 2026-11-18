/**
 * Modo Lectura Nocturna: fondo crema oscuro y texto sepia suave.
 */
export default function LecturaNocturna({ activo = false }) {
  return (
    <div className={`p-6 rounded-2xl border border-line dark:border-stone-700 transition-colors duration-300 ${activo ? 'bg-[#2a1a0e] text-amber-100 border-amber-900/30' : 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100'}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-[10px]">🌙</span>
        <h3 className="text-sm font-bold">Modo Lectura Nocturna</h3>
      </div>
      <p className="text-sm leading-relaxed">
        Disfruta de tu boleto o reserva con una lectura cómoda en entornos oscuros, sin fatigar la vista.
      </p>
      <div className="mt-4 p-4 bg-white/10 dark:bg-white/5 rounded-lg border border-white/10 dark:border-white/10">
        <p className="text-sm font-medium">Código de reserva: BC-8842</p>
        <p className="text-sm mt-1">Ruta: Lima → Cusco</p>
        <p className="text-sm mt-1">Fecha: 14/11/2026 • 08:00</p>
      </div>
    </div>
  )
}