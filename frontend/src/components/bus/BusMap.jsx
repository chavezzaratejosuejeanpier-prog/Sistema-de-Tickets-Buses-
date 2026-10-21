import React, { useState } from 'react'
import Seat from './Seat.jsx'
import FloorTab from './FloorTab.jsx'

export default function BusMap({ totalPiso1 = 20, totalPiso2 = 40, ocupados = [], onSelect }) {
  const [piso, setPiso] = useState(1)
  const [seleccionados, setSeleccionados] = useState([])

  const total = piso === 1 ? totalPiso1 : totalPiso2
  const labelServicio = piso === 1 ? 'Servicio VIP' : 'Servicio Estándar'
  const rows = Math.ceil(total / 4)

  const handlePisoChange = (p) => {
    setPiso(p)
    setSeleccionados([])
    onSelect?.([])
  }

  const toggle = (num) => {
    if (ocupados.includes(num)) return
    setSeleccionados((prev) => {
      const next = prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
      onSelect?.(next)
      return next
    })
  }

  return (
    <section
      aria-label={`Mapa de asientos piso ${piso} ${labelServicio}`}
      className="card max-w-md mx-auto p-5 sm:p-6"
    >
      <header className="text-center mb-5">
        <h2 className="text-2xl font-extrabold text-navy dark:text-white tracking-tight">Selecciona tus Asientos</h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
          Piso {piso} — {labelServicio} ({total} asientos)
        </p>
      </header>

      <FloorTab piso={piso} setPiso={handlePisoChange} />

      <ul className="flex justify-center gap-4 my-5 text-xs font-semibold list-none" aria-label="Leyenda de estados">
        <li className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
          <span className="w-3.5 h-3.5 bg-white dark:bg-stone-900 border-2 border-success/60 rounded shadow-soft" aria-hidden /> Libre
        </li>
        <li className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
          <span className="w-3.5 h-3.5 bg-primary rounded shadow-soft" aria-hidden /> Selección
        </li>
        <li className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
          <span className="w-3.5 h-3.5 bg-gray-100 dark:bg-stone-700 border border-black/5 dark:border-white/10 rounded" aria-hidden /> Ocupado
        </li>
      </ul>

      <div className="border-[3px] border-black/5 rounded-xl p-6 sm:p-8 bg-gradient-to-b from-gray-50 to-white relative shadow-soft overflow-hidden dark:border-white/10 dark:from-stone-800 dark:to-stone-900">
        <div
          className="absolute top-5 right-8 w-11 h-11 border-[3px] border-black/5 dark:border-white/10 rounded-full flex items-center justify-center bg-white dark:bg-stone-900 shadow-soft"
          aria-hidden="true"
        >
          <div className="w-3.5 h-3.5 bg-stone-400 rounded-full" />
          <div className="absolute w-6 h-[2px] bg-black/10 dark:bg-white/10 rotate-45" />
          <div className="absolute w-6 h-[2px] bg-black/10 dark:bg-white/10 -rotate-45" />
        </div>
        <p className="absolute top-8 left-8 text-xs font-bold tracking-[0.18em] text-stone-400 dark:text-stone-500" aria-hidden>FRENTE</p>

        {total === 0 ? (
          <p className="mt-10 text-center text-sm text-stone-400 dark:text-stone-500 py-8">No hay asientos configurados para este piso.</p>
        ) : (
          <div className="grid grid-cols-5 gap-y-3 sm:gap-y-4 mt-10" role="grid" aria-label={`Distribución piso ${piso}`}>
            {Array.from({ length: rows }, (_, row) => {
              const base = row * 4
              const nums = [base + 1, base + 2, base + 3, base + 4]
              return (
                <React.Fragment key={row}>
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
                  <div aria-hidden className="flex items-center justify-center">
                    <div className="w-px h-8 bg-gray-100/60 dark:bg-white/10 hidden sm:block" />
                  </div>
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

      <div className="mt-5 flex items-center justify-between gap-3 text-xs bg-gray-50 dark:bg-stone-800 border border-black/5 dark:border-stone-700 rounded-xl px-4 py-3">
        <span className="text-stone-500 dark:text-stone-400 font-medium whitespace-nowrap">
          Piso {piso} • <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 bg-white dark:bg-stone-900 border border-black/10 dark:border-stone-600 rounded-full text-navy dark:text-white font-bold ml-1">{seleccionados.length}</span> <span className="ml-1">seleccionado(s)</span>
        </span>
        <span className="font-bold text-navy dark:text-white text-right truncate" aria-live="polite" aria-atomic="true">
          {seleccionados.length > 0 ? `Asientos: ${seleccionados.join(', ')}` : 'Sin selección'}
        </span>
      </div>
      <p className="text-xs text-stone-400 dark:text-stone-500 text-center mt-2">Toca un asiento libre para seleccionar • Los ocupados no están disponibles</p>
    </section>
  )
}
