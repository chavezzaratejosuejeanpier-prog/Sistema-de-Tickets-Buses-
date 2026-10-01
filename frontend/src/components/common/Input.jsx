export default function Input({ label, id, ...props }) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={inputId} className="text-sm font-medium text-stone-700 dark:text-stone-300">{label}</label>}
      <input id={inputId} className="input dark:bg-stone-800 dark:text-white" {...props} />
    </div>
  )
}
