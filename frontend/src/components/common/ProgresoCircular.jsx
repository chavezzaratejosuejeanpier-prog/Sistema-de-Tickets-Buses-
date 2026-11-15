import { useEffect, useState } from 'react'

/**
 * Barra de progreso de viaje circular (anillo SVG) para el header.
 */
export default function ProgresoCircular({ porcentaje = 45 }) {
  const [offset, setOffset] = useState(283 - (283 * porcentaje) / 100)

  useEffect(() => {
    setOffset(283 - (283 * porcentaje) / 100)
  }, [porcentaje])

  return (
    <svg
      className="w-10 h-10 transform -rotate-90"
      viewBox="0 0 32 32"
      aria-label="Progreso del viaje"
    >
      <circle
        cx="16"
        cy="16"
        r="14.5"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="transparent"
        className="text-stone-300 dark:text-stone-700"
      />
      <circle
        cx="16"
        cy="16"
        r="14.5"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="transparent"
        className="text-primary"
        style={{
          strokeDasharray: 283,
          strokeDashoffset: offset,
          transition: 'stroke-dashoffset 0.5s ease',
        }}
      />
      <text
        x="16"
        y="19"
        fontSize="10"
        fontWeight="bold"
        textAnchor="middle"
        fill="currentColor"
      >
        {porcentaje}%
      </text>
    </svg>
  )
}