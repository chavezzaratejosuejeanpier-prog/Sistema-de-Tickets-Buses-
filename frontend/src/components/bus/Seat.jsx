export default function Seat({ numero, estado, selected, onClick }) {
  const ocupado = estado === 'ocupado'
  const base = "w-10 h-10 rounded flex items-center justify-center text-xs font-bold cursor-pointer border-2 transition-colors "
  const style = ocupado ? "bg-slate-300 border-slate-400 cursor-not-allowed text-slate-500"
    : selected ? "bg-accent border-accent text-white"
    : "bg-white border-primary hover:bg-primary hover:text-white"
  return (
    <button
      type="button"
      className={base + style}
      disabled={ocupado}
      aria-pressed={selected}
      aria-label={`Asiento ${numero}${ocupado ? ' ocupado' : ''}${selected ? ' seleccionado' : ''}`}
      onClick={() => { if (!ocupado) onClick?.(numero) }}
    >
      {numero}
    </button>
  )
}