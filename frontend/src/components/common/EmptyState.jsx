import { Inbox } from 'lucide-react'

const SVG_ILUSTRACIONES = {
  bus: (
    <svg className="w-24 h-24 text-muted dark:text-stone-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 17h14m-9-3v4m4-4v4M5 17V9m4 8h6m-10-4h10M10 3a2 2 0 012 2v1H8V5a2 2 0 012-2z" />
    </svg>
  ),
  ticket: (
    <svg className="w-24 h-24 text-muted dark:text-stone-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  search: (
    <svg className="w-24 h-24 text-muted dark:text-stone-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  empty: (
    <svg className="w-24 h-24 text-muted dark:text-stone-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
    </svg>
  ),
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
  svg: svgKey,
}) {
  const tieneSvg = Boolean(svgKey && SVG_ILUSTRACIONES[svgKey])

  return (
    <div className={`empty-state flex flex-col items-center gap-3 ${className}`}>
      {tieneSvg ? SVG_ILUSTRACIONES[svgKey] : <Icon size={40} className="text-muted dark:text-stone-500" aria-hidden="true" />}
      {title && <p className="font-semibold text-navy dark:text-white">{title}</p>}
      {description && <p className="text-sm text-muted dark:text-stone-400">{description}</p>}
      {action}
    </div>
  )
}