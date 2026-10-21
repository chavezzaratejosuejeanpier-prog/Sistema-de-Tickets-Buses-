import { ArrowUpRight } from 'lucide-react'

const IMAGENES = import.meta.glob('../assets/routes/*.{jpg,jpeg,webp,png}', { eager: true, import: 'default' })

const DESTINOS = [
  { ciudad: 'Cusco', imagen: 'cusco-machu-picchu.jpg' },
  { ciudad: 'Arequipa', imagen: 'arequipa.jpg' },
  { ciudad: 'Trujillo', imagen: 'trujillo.jpg' },
  { ciudad: 'Chiclayo', imagen: 'chiclayo.jpg' },
  { ciudad: 'Piura', imagen: 'piura.jpg' },
  { ciudad: 'Huaraz', imagen: 'huaraz.jpg' },
  { ciudad: 'Ica', imagen: 'ica-huacachina.jpg' },
  { ciudad: 'Puno', imagen: 'puno-titicaca.jpg' },
]

export default function DestinationGrid({ onSelect }) {
  return (
    <section className="mt-10" aria-labelledby="destinos-titulo">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="destinos-titulo" className="text-2xl font-extrabold tracking-tight text-navy dark:text-white md:text-3xl">
            Los viajes que hacemos
          </h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Elige un destino y completamos el formulario para que solo presiones Buscar.
          </p>
        </div>
        <span className="hidden rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold text-stone-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 sm:inline-flex">
          Toca un destino
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {DESTINOS.map(({ ciudad, imagen }) => {
          const src = IMAGENES[`../assets/routes/${imagen}`]

          return (
            <button
              key={ciudad}
              type="button"
              onClick={() => onSelect(ciudad)}
              aria-label={`Buscar viajes a ${ciudad}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl text-left shadow-soft transition-transform duration-300 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-950"
            >
              {src ? (
                <img
                  src={src}
                  alt={`Vista de ${ciudad}`}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <span aria-hidden className="absolute inset-0 bg-slate-400 dark:bg-stone-800" />
              )}

              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4 text-white">
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Desde Lima</span>
                  <span className="mt-0.5 block text-xl font-extrabold leading-tight sm:text-2xl">{ciudad}</span>
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm transition-colors group-hover:bg-white group-hover:text-navy">
                  <ArrowUpRight size={16} aria-hidden="true" />
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
