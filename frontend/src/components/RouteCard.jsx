import { Clock, Armchair } from 'lucide-react'

const IMAGENES = import.meta.glob('../assets/routes/*.{jpg,jpeg,webp,png}', { eager: true, import: 'default' })

export default function RouteCard({ origen, destino, precio, duracion, asiento, imagen, onSelect, className = '' }) {
  const src = IMAGENES[`../assets/routes/${imagen}`]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-xl text-left shadow-soft transition-transform duration-300 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-950 ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={`Viaje ${origen} - ${destino}`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-slate-400 dark:bg-stone-800" />
      )}

      <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent" />

      <div className="absolute bottom-0 left-0 p-4 text-white">
        <h3 className="text-xl font-bold sm:text-2xl">{origen} - {destino}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-white/90">
          <span className="font-semibold">{precio}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={15} />{duracion}</span>
          <span className="inline-flex items-center gap-1.5"><Armchair size={15} />{asiento}</span>
        </div>
      </div>
    </button>
  )
}
