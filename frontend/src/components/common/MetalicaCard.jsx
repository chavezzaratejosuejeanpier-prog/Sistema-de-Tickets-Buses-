/**
 * Tarjeta con efecto lámina metálica: brillo que se mueve con el cursor.
 */
import { useState } from 'react'

export default function MetalicaCard({ children }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })

  return (
    <div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setPos({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 })
      }}
      className="relative overflow-hidden rounded-xl border border-white/20 bg-gradient-to-br from-stone-200 via-white to-stone-100 dark:from-stone-800 dark:via-stone-900 dark:to-stone-950 p-6 shadow-soft"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.6), transparent 40%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}