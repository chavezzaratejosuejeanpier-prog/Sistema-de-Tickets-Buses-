import React, { useState, useCallback, useMemo } from 'react'
import Seat from './Seat.jsx'
import FloorTab from './FloorTab.jsx'

export default function BusMap({ totalPiso1 = 20, totalPiso2 = 40, ocupados = [], onSelect }) {
  const [piso, setPiso] = useState(1)
  const [seleccionados, setSeleccionados] = useState([])

  const total = piso === 1 ? totalPiso1 : totalPiso2
  const labelServicio = piso === 1 ? 'Servicio VIP' : 'Servicio Estándar'
  const rows = useMemo(() => Math.ceil(total / 4), [total])

  const handlePisoChange = useCallback((p) => {
    setPiso(p)
    setSeleccionados([])
    onSelect?.([])
  }, [onSelect])

  const toggle = useCallback((num) => {
    if (ocupados.includes(num)) return
    setSeleccionados((prev) => {
      const next = prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
      onSelect?.(next)
      return next
    })
  }, [ocupados, onSelect])

  return (
    <section
      aria-label={`Mapa de asientos piso ${piso} ${labelServicio}`}
      className="max-w-md mx-auto p-5 sm:p-6 bg-white rounded-2xl shadow-xl border border-gray-100"
    >
      <header className="text-center mb-5">
        <h2 className="text-2xl font-extrabold text-primary tracking-tight">Selecciona tus Asientos</h2>
        <p className="text-gray-500 text-sm mt-1">
          Piso {piso} — {labelServicio} ({total} asientos)
        </p>
      </header>

      <FloorTab piso={piso} setPiso={handlePisoChange} />

      {/* Leyenda accesible */}
      <ul className="flex justify-center gap-4 my-5 text-xs font-semibold list-none" aria-label="Leyenda de estados">
        <li className="flex items-center gap-1.5 text-gray-600">
          <span className="w-3.5 h-3.5 bg-white border-2 border-primary rounded-sm shadow-sm" aria-hidden /> Libre
        </li>
        <li className="flex items-center gap-1.5 text-gray-600">
          <span className="w-3.5 h-3.5 bg-accent rounded-sm shadow-sm" aria-hidden /> Selección
        </li>
        <li className="flex items-center gap-1.5 text-gray-600">
          <span className="w-3.5 h-3.5 bg-gray-200 border border-gray-300 rounded-sm" aria-hidden /> Ocupado
        </li>
      </ul>

      {/* Carrocería del bus */}
      <div className="border-[3px] border-gray-300 rounded-[2rem] p-6 sm:p-8 bg-gradient-to-b from-gray-50 to-white relative shadow-inner overflow-hidden">
        {/* Volante decorativo */}
        <div
          className="absolute top-5 right-8 w-11 h-11 border-[3px] border-gray-300 rounded-full flex items-center justify-center bg-white shadow-sm"
          aria-hidden="true"
        >
          <div className="w-3.5 h-3.5 bg-gray-400 rounded-full" />
          <div className="absolute w-6 h-[2px] bg-gray-300 rotate-45" />
          <div className="absolute w-6 h-[2px] bg-gray-300 -rotate-45" />
        </div>
        <p className="absolute top-8 left-8 text-[10px] font-bold tracking-[0.18em] text-gray-400" aria-hidden>FRENTE</p>

        {total === 0 ? (
          <p className="mt-10 text-center text-sm text-gray-400 py-8">No hay asientos configurados para este piso.</p>
        ) : (
          <div className="grid grid-cols-5 gap-y-3 sm:gap-y-4 mt-10" role="grid" aria-label={`Distribución piso ${piso}`}>
            {Array.from({ length: rows }, (_, row) => {
              const base = row * 4
              const nums = [base + 1, base + 2, base + 3, base + 4]
              return (
                <React.Fragment key={row}>
                  {/* Lado izquierdo: 2 asientos */}
                  <div className="flex justify-center" role="gridcell">
                    {nums[0] <= total && (
                      <Seat
                        numero={nums[0]}
                        estado={ocupados.includes(nums[0]) ? 'ocupado' : 'libre'}
                        selected={seleccionados.includes(nums[0])}
                        onClick={() => toggle(nums[0])}
                      />
                    )}
                  </div>
                  <div className="flex justify-center" role="gridcell">
                    {nums[1] <= total && (
                      <Seat
                        numero={nums[1]}
                        estado={ocupados.includes(nums[1]) ? 'ocupado' : 'libre'}
                        selected={seleccionados.includes(nums[1])}
                        onClick={() => toggle(nums[1])}
                      />
                    )}
                  </div>
                  {/* Pasillo */}
                  <div aria-hidden className="flex items-center justify-center">
                    <div className="w-px h-8 bg-gray-200/60 hidden sm:block" />
                  </div>
                  {/* Lado derecho: 2 asientos */}
                  <div className="flex justify-center" role="gridcell">
                    {nums[2] <= total && (
                      <Seat
                        numero={nums[2]}
                        estado={ocupados.includes(nums[2]) ? 'ocupado' : 'libre'}
                        selected={seleccionados.includes(nums[2])}
                        onClick={() => toggle(nums[2])}
                      />
                    )}
                  </div>
                  <div className="flex justify-center" role="gridcell">
                    {nums[3] <= total && (
                      <Seat
                        numero={nums[3]}
                        estado={ocupados.includes(nums[3]) ? 'ocupado' : 'libre'}
                        selected={seleccionados.includes(nums[3])}
                        onClick={() => toggle(nums[3])}
                      />
                    )}
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        )}
      </div>

      {/* Resumen dinámico */}
      <div className="mt-5 flex items-center justify-between gap-3 text-xs bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
        <span className="text-gray-500 font-medium whitespace-nowrap">
          Piso {piso} • <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 bg-white border border-gray-200 rounded-full text-primary font-bold ml-1">{seleccionados.length}</span> <span className="ml-1">seleccionado(s)</span>
        </span>
        <span className="font-bold text-primary text-right truncate" aria-live="polite" aria-atomic="true">
          {seleccionados.length > 0 ? `Asientos: ${seleccionados.join(', ')}` : 'Sin selección'}
        </span>
      </div>
      <p className="text-[11px] text-gray-400 text-center mt-2">Toca un asiento libre para seleccionar • Los ocupados no están disponibles</p>
    </section>
  )
}
