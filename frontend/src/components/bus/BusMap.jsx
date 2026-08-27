import React, { useState } from 'react'
import Seat from './Seat.jsx'
import FloorTab from './FloorTab.jsx'

export default function BusMap({ totalPiso1 = 20, totalPiso2 = 40, ocupados = [], onSelect }) {
  const [piso, setPiso] = useState(1)
  const [seleccionados, setSeleccionados] = useState([])

  const total = piso === 1 ? totalPiso1 : totalPiso2
  const rows = Math.ceil(total / 4)

  const handlePisoChange = (p) => {
    setPiso(p)
    setSeleccionados([])
    onSelect?.([])
  }

  const toggle = (num) => {
    if (ocupados.includes(num)) return
    const next = seleccionados.includes(num) ? seleccionados.filter((n) => n !== num) : [...seleccionados, num]
    setSeleccionados(next)
    onSelect?.(next)
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow-lg border border-gray-100">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-extrabold text-blue-900">Selecciona tus Asientos</h2>
        <p className="text-gray-500 text-sm mt-1">Piso {piso} - {piso === 1 ? 'Servicio VIP' : 'Servicio Estándar'}</p>
      </div>

      <FloorTab piso={piso} setPiso={handlePisoChange} />

      <div className="flex justify-center gap-4 my-6 text-xs font-semibold text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-white border-2 border-primary rounded-sm"></div> Libre
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-accent rounded-sm"></div> Selección
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 bg-gray-300 border border-gray-400 rounded-sm"></div> Ocupado
        </div>
      </div>

      <div className="border-4 border-gray-300 rounded-[2.5rem] p-8 bg-gray-50 relative">
        <div className="absolute top-4 right-8 w-10 h-10 border-4 border-gray-300 rounded-full flex items-center justify-center opacity-50">
          <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
        </div>

        <div className="grid grid-cols-5 gap-y-4 mt-10">
          {Array.from({ length: rows }, (_, row) => {
            const base = row * 4
            const n1 = base + 1
            const n2 = base + 2
            const n3 = base + 3
            const n4 = base + 4
            return (
              <React.Fragment key={row}>
                <div className="flex justify-center">
                  {n1 <= total && (
                    <Seat
                      numero={n1}
                      estado={ocupados.includes(n1) ? 'ocupado' : 'libre'}
                      selected={seleccionados.includes(n1)}
                      onClick={() => toggle(n1)}
                    />
                  )}
                </div>
                <div className="flex justify-center">
                  {n2 <= total && (
                    <Seat
                      numero={n2}
                      estado={ocupados.includes(n2) ? 'ocupado' : 'libre'}
                      selected={seleccionados.includes(n2)}
                      onClick={() => toggle(n2)}
                    />
                  )}
                </div>
                <div />
                <div className="flex justify-center">
                  {n3 <= total && (
                    <Seat
                      numero={n3}
                      estado={ocupados.includes(n3) ? 'ocupado' : 'libre'}
                      selected={seleccionados.includes(n3)}
                      onClick={() => toggle(n3)}
                    />
                  )}
                </div>
                <div className="flex justify-center">
                  {n4 <= total && (
                    <Seat
                      numero={n4}
                      estado={ocupados.includes(n4) ? 'ocupado' : 'libre'}
                      selected={seleccionados.includes(n4)}
                      onClick={() => toggle(n4)}
                    />
                  )}
                </div>
              </React.Fragment>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center">
        Piso {piso} - {seleccionados.length} asiento(s) seleccionado(s)
      </p>
    </div>
  )
}
