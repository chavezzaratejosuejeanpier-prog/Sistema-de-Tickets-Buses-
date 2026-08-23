export default function Seat({ numero, estado, selected, onClick }) {
  const base = "w-10 h-10 rounded flex items-center justify-center text-xs font-bold cursor-pointer border-2 "
  const style = estado === 'ocupado' ? "bg-gray-300 border-gray-400 cursor-not-allowed text-gray-500"
    : selected ? "bg-accent border-accent text-white"
    : "bg-white border-primary hover:bg-primary hover:text-white"
  return <div className={base+style} onClick={estado!=='ocupado'?onClick:undefined}>{numero}</div>
}
