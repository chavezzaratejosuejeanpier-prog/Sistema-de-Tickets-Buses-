import { useRef, useState } from 'react'

/**
 * Botón con efecto imán: se mueve ligeramente siguiendo el cursor cuando está cerca.
 */
export default function ImánButton({ children, className = '' }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const handleMove = (e) => {
    const rect = ref.current.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    const distancia = Math.sqrt(x * x + y * y)
    if (distancia < 80) {
      setPos({ x: x * 0.4, y: y * 0.4 })
    } else {
      setPos({ x: 0, y: 0 })
    }
  }

  return (
    <button
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      className={`relative transition-transform duration-100 ease-out rounded-xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900 px-6 py-3 text-sm font-semibold text-navy dark:text-white shadow-soft hover:shadow-lift ${className}`}
    >
      {children}
    </button>
  )
}