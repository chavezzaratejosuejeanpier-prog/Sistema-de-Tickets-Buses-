import { Clock, Armchair } from 'lucide-react'

// ponytail: sin jpgs todavia. Al soltarlos en src/assets/routes/ aparecen solos (import.meta.glob),
// sin tocar este archivo; si falta alguno se muestra el bloque de color de respaldo.
const IMAGENES = import.meta.glob('../assets/routes/*.jpg', { eager: true, import: 'default' })

export default function RouteCard({ origen, destino, precio, duracion, asiento, imagen, onSelect }) {
  const src = IMAGENES[`../assets/routes/${imagen}`]

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-[340px] w-full flex-col overflow-hidden rounded-xl border border-line bg-white text-left shadow-soft transition-shadow duration-200 hover:shadow-md"
    >
      {src ? (
        <img src={src} alt={`Viaje ${origen} - ${destino}`} loading="lazy" className="h-40 w-full object-cover" />
      ) : (
        <div aria-hidden className="h-40 w-full bg-[#CBD5E1]" />
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[24px] font-semibold text-navy">{origen} - {destino}</h3>
          <span className="shrink-0 rounded-md bg-slate-100 px-2.5 py-1 text-[16px] font-semibold text-navy-light">
            {precio}
          </span>
        </div>

        <div className="mt-2.5 flex gap-4 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5"><Clock size={16} />{duracion}</span>
          <span className="inline-flex items-center gap-1.5"><Armchair size={16} />{asiento}</span>
        </div>
      </div>
    </button>
  )
}
