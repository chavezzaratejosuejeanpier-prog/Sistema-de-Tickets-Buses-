import { useId, useState, useMemo } from 'react'
import { MapPin, ChevronDown } from 'lucide-react'
import { CIUDADES } from './ciudades.js'

function getFiltered(query, exclude) {
  const q = query.trim().toLowerCase()
  return CIUDADES.filter(c => c.toLowerCase().includes(q) && c.toLowerCase() !== exclude.toLowerCase()).slice(0, 6)
}

export default function CityField({ label, value, onChange, placeholder, exclude = '' }) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const filtered = useMemo(() => getFiltered(value, exclude), [value, exclude])
  const showList = abierto && filtered.length > 0

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-2 block text-[15px] font-semibold text-navy-light">{label}</label>

      <div className="relative">
        <MapPin size={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />

        <input
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-lista`}
          className="input h-[52px] border-slate-300 py-0 pl-11 pr-11 focus:ring-2"
        />

        <button
          type="button"
          aria-label={`Ver ciudades para ${label}`}
          onMouseDown={e => { e.preventDefault(); setAbierto(o => !o) }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-navy"
        >
          <ChevronDown size={20} />
        </button>
      </div>

      {showList && (
        <ul id={`${id}-lista`} role="listbox" className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-xl">
          {filtered.map(c => (
            <li key={c} role="option" aria-selected={c === value}>
              <button
                type="button"
                onMouseDown={() => onChange(c)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[15px] text-navy hover:bg-primary hover:text-white"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
