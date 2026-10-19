import { useId } from 'react'
import { CalendarDays } from 'lucide-react'

export default function DateField({ label, id, min, className = '', ...props }) {
  const internalId = useId()
  const inputId = id || internalId
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-navy-light dark:text-stone-300">
          {label}
        </label>
      )}
      <div className="relative">
        <CalendarDays size={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id={inputId}
          type="date"
          min={min}
          className="input h-12 py-0 pl-11 pr-3 focus:ring-2 [color-scheme:light] dark:[color-scheme:dark]"
          {...props}
        />
      </div>
    </div>
  )
}
