import { useState } from 'react'
import Seat from './Seat.jsx'
import FloorTab from './FloorTab.jsx'

export default function BusMap({ totalPiso1=20, totalPiso2=40, ocupados=[], onSelect }) {
  const [piso, setPiso] = useState(1)
  const [seleccionados, setSeleccionados] = useState([])

  const toggle = (num) => {
    const next = seleccionados.includes(num) ? seleccionados.filter(n=>n!==num) : [...seleccionados, num]
    setSeleccionados(next); onSelect?.(next)
  }
  const total = piso===1 ? totalPiso1 : totalPiso2
  return (
    <div className="border rounded-lg p-4 bg-white shadow">
      <FloorTab piso={piso} setPiso={setPiso} />
      <div className="grid grid-cols-4 gap-2 mt-4 max-w-xs mx-auto">
        {Array.from({length: total}, (_,i)=> i+1).map(n=>(
          <Seat key={n} numero={n} estado={ocupados.includes(n)?'ocupado':'libre'} selected={seleccionados.includes(n)} onClick={()=>toggle(n)} />
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3 text-center">Piso {piso} - {seleccionados.length} asiento(s) seleccionado(s)</p>
    </div>
  )
}
