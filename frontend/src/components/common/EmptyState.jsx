import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title, description, action, className = '' }) {
  return (
    <div className={`empty-state flex flex-col items-center gap-3 ${className}`}>
      <Icon size={40} className="text-muted dark:text-stone-500" aria-hidden="true" />
      {title && <p className="font-semibold text-navy dark:text-white">{title}</p>}
      {description && <p className="text-sm text-muted dark:text-stone-400">{description}</p>}
      {action}
    </div>
  )
}