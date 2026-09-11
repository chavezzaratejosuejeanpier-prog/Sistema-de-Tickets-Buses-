export default function FloorTab({ piso, setPiso }) {
  return (
    <div className="flex gap-2 justify-center">
      {[1,2].map(p=>(
        <button key={p} onClick={()=>setPiso(p)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${piso===p?'bg-primary text-white shadow-sm':'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>Piso {p}</button>
      ))}
    </div>
  )
}
