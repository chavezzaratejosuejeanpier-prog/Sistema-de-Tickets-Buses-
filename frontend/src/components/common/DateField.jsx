import { useId } from 'react'
import { CalendarDays } from 'lucide-react'

export default function DateField({ label, id, min, className = '', variant = 'default', ...props }) {
  const internalId = useId()
  const inputId = id || internalId
  const pill = variant === 'pill'
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className={pill
            ? 'block text-[11px] font-semibold uppercase tracking-wide text-muted dark:text-stone-400'
            : 'mb-2 block text-sm font-semibold text-navy-light dark:text-stone-300'}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <CalendarDays
          size={pill ? 16 : 20}
          className={pill
            ? 'pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-muted'
            : 'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted'}
        />
        <input
          id={inputId}
          type="date"
          min={min}
          className={pill
            ? 'w-full min-w-0 border-0 bg-transparent p-0 pl-6 text-sm font-semibold text-navy focus:outline-none focus:ring-0 dark:text-white [color-scheme:light] dark:[color-scheme:dark]'
            : 'input h-12 py-0 pl-11 pr-3 focus:ring-2 [color-scheme:light] dark:[color-scheme:dark]'}
          {...props}
        />
      </div>
    </div>
  )
}
