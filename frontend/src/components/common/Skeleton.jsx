export default function Skeleton({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-stone-200 dark:bg-stone-800 ${className}`}
    />
  )
}