/**
 * Botón con efecto vidrio húmedo: gotas y reflejos de agua animados.
 */
export default function GlassWetButton({ children, className = '' }) {
  return (
    <button
      className={`relative overflow-hidden rounded-xl border border-white/30 bg-white/10 backdrop-blur-md px-6 py-3 text-sm font-medium text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full transition-all duration-700 hover:translate-x-full" />
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='drops'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='3' stitchTiles='stitch'/%3E%3CfeDisplacementMap in='SourceGraphic' scale='5'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23drops)'/%3E%3C/svg%3E')" }} />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  )
}