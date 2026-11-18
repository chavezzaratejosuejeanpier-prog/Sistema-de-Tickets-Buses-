/**
 * Modo Playa: olas animadas en el fondo inferior.
 */
export default function WaveEffect({ activo = true }) {
  if (!activo) return null

  return (
    <div className="fixed bottom-0 left-0 w-full h-32 z-[-1] pointer-events-none overflow-hidden">
      <svg className="w-full h-full" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path
          d="M0,60 Q200,120 400,60 T800,60 T1200,60 V120 H0 Z"
          fill="#0ea5e9"
          className="animate-[olas_8s_ease-in-out_infinite]"
        />
        <path
          d="M0,80 Q150,140 300,80 T900,80 T1200,80 V120 H0 Z"
          fill="#0ea5e9"
          opacity="0.6"
          className="animate-[olas_6s_ease-in-out_infinite_reverse]"
        />
      </svg>
    </div>
  )
}