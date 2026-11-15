/**
 * Fondos geométricos generativos que se mueven lentamente.
 */
export default function FondosGeometricos({ activo = true }) {
  if (!activo) return null

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10"
        style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(15, 23, 42, 0.05) 2px, rgba(15, 23, 42, 0.05) 4px),
            repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(15, 23, 42, 0.05) 2px, rgba(15, 23, 42, 0.05) 4px)
          `,
          backgroundSize: '20px 20px',
          animation: 'mover-grid 20s linear infinite',
        }}
      />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-orange-500/20 blur-[100px] animate-[pulso_8s_ease-in-out_infinite]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-blue-500/20 blur-[100px] animate-[pulso_6s_ease-in-out_infinite_reverse]" />
    </div>
  )
}