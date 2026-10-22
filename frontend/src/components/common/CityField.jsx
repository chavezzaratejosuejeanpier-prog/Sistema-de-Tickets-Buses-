import { useId, useState, useMemo, useEffect } from 'react'
import { MapPin, ChevronDown } from 'lucide-react'
import { cargarCiudades, filtrarCiudades } from './ciudades.js'

export default function CityField({ label, value, onChange, placeholder, exclude = '', variant = 'default' }) {
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const [ciudades, setCiudades] = useState([])
  const filtered = useMemo(() => filtrarCiudades(ciudades, value, exclude), [ciudades, value, exclude])
  const showList = abierto && filtered.length > 0
  const pill = variant === 'pill'

  useEffect(() => {
    let vivo = true
    cargarCiudades().then(c => { if (vivo) setCiudades(c) })
    return () => { vivo = false }
  }, [])

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className={pill
          ? 'block text-[11px] font-semibold uppercase tracking-wide text-muted dark:text-stone-400'
          : 'mb-2 block text-sm font-semibold text-navy-light dark:text-stone-300'}
      >
        {label}
      </label>

      <div className="relative">
        <MapPin
          size={pill ? 16 : 20}
          className={pill
            ? 'pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-muted'
            : 'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted'}
        />

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
          aria-autocomplete="list"
          className={pill
            ? 'w-full border-0 bg-transparent p-0 pl-6 pr-5 text-sm font-semibold text-navy placeholder-slate-400 focus:outline-none focus:ring-0 dark:text-white dark:placeholder-stone-500'
            : 'input h-12 border-slate-300 py-0 pl-11 pr-11 focus:ring-2'}
        />

        <button
          type="button"
          aria-label={`Ver ciudades para ${label}`}
          onMouseDown={e => { e.preventDefault(); setAbierto(o => !o) }}
          className={pill
            ? 'absolute right-0 top-1/2 -translate-y-1/2 text-muted hover:text-navy'
            : 'absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-navy'}
        >
          <ChevronDown size={pill ? 16 : 20} />
        </button>
      </div>

      {showList && (
        <ul id={`${id}-lista`} role="listbox" className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-line dark:border-stone-700 bg-white dark:bg-stone-800 py-1 shadow-lift">
          {filtered.map(c => (
            <li key={c} role="option" aria-selected={c === value}>
              <button
                type="button"
                onMouseDown={() => onChange(c)}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-navy dark:text-stone-100 hover:bg-primary hover:text-white"
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
