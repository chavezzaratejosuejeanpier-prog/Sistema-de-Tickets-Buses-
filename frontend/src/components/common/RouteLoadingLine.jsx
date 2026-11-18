import { useEffect, useState } from 'react'

export default function RouteLoadingLine({ activo = true }) {
  const [dibujo, setDibujo] = useState(0)

  useEffect(() => {
    if (!activo) return
    setDibujo(0)
    const t = setInterval(() => {
      setDibujo(d => (d >= 100 ? 0 : d + 4))
    }, 20)
    return () => clearInterval(t)
  }, [activo])

  if (!activo) return null

  return (
    <svg className="w-full h-32 md:h-48 mb-4" viewBox="0 0 800 200" aria-hidden="true">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#EA580C" />
          <stop offset="50%" stopColor="#00f2ff" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <path
        d="M 50 100 Q 400 20 750 100"
        fill="none"
        stroke="url(#grad)"
        strokeWidth="4"
        strokeDasharray="800"
        strokeDashoffset={800 - (800 * dibujo) / 100}
        className="transition-all duration-100 ease-linear"
      />
      <circle cx={50 + (700 * dibujo) / 100} cy={100} r="6" fill="#00f2ff" />
    </svg>
  )
}