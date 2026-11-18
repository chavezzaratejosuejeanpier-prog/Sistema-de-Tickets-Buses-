/**
 * Modo Invierno: copos de nieve animados cayendo sobre la página.
 */
export default function SnowEffect({ activo = true }) {
  if (!activo) return null

  const copos = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 5,
    duration: Math.random() * 3 + 2,
    size: Math.random() * 4 + 2,
  }))

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
      {copos.map((c) => (
        <div
          key={c.id}
          className="absolute rounded-full bg-white opacity-60 animate-[caer_6s_linear_infinite]"
          style={{
            left: `${c.left}%`,
            top: `${c.top}%`,
            width: `${c.size}px`,
            height: `${c.size}px`,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
          }}
        />
      ))}
    </div>
  )
}