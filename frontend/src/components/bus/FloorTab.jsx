export default function FloorTab({ piso, setPiso }) {
  return (
    <div className="flex gap-2 justify-center">
      {[1,2].map(p=>(
        <button key={p} onClick={()=>setPiso(p)} className={`px-4 py-1 rounded ${piso===p?'bg-primary text-white':'bg-gray-200'}`}>Piso {p}</button>
      ))}
    </div>
  )
}
