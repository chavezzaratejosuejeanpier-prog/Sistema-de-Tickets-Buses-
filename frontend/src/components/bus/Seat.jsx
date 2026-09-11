export default function Seat({ numero, estado, selected, onClick }) {
  const base = "w-10 h-10 rounded flex items-center justify-center text-xs font-bold cursor-pointer border-2 transition-colors "
  const style = estado === 'ocupado' ? "bg-slate-300 border-slate-400 cursor-not-allowed text-slate-500"
    : selected ? "bg-accent border-accent text-white"
    : "bg-white border-primary hover:bg-primary hover:text-white"
  return <div className={base+style} onClick={(e)=>{ if(estado==='ocupado') return; onClick?.(e) }}>{numero}</div>
}
