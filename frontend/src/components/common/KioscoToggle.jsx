export default function KioscoToggle({ activo = false, onCambiar }) {
  return (
    <button
      onClick={() => onCambiar?.(!activo)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${activo ? 'bg-primary text-white border-primary' : 'border-line dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300'}`}
    >
      <span className="text-[12px]">📱</span>
      <span className="text-xs font-bold uppercase">{activo ? 'Modo Kiosco Activo' : 'Activar Modo Kiosco'}</span>
    </button>
  )
}