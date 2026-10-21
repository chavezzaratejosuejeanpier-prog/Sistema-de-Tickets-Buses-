import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { FILTROS, POPULAR_ROUTES } from '../data/popularRoutes.js'
import RouteCard from './RouteCard.jsx'

const filtrarRutas = (rutas, filtro) => {
  if (filtro === 'todas') return rutas
  if (filtro === 'top') return rutas.filter(ruta => ruta.top === true)
  return rutas.filter(ruta => ruta.region === filtro)
}

export default function PopularRoutes() {
  const [filtro, setFiltro] = useState('todas')
  const rutas = filtrarRutas(POPULAR_ROUTES, filtro)

  return (
    <section aria-labelledby="rutas-populares-titulo">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600 dark:text-orange-400">
            LOS FAVORITOS DEL PERÚ
          </p>
          <h2 id="rutas-populares-titulo" className="mt-2 text-3xl font-extrabold tracking-tight text-navy dark:text-white sm:text-4xl">
            Rutas populares
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-600 dark:text-stone-300 sm:text-base">
            Las rutas que más viajan los peruanos. Elige una y te llevamos al buscador con el formulario listo.
          </p>
        </div>

        <Link
          to="/buscar"
          className="inline-flex items-center gap-2 rounded-full border border-orange-500 px-4 py-2 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:border-orange-400 dark:text-orange-300 dark:hover:bg-orange-500 dark:hover:text-white dark:focus-visible:ring-offset-stone-950"
        >
          Buscar todas las rutas
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <div
        role="group"
        aria-label="Filtrar rutas populares"
        className="mt-6 flex gap-2 overflow-x-auto pb-1"
      >
        {FILTROS.map(({ id, label }) => {
          const activo = filtro === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={activo}
              onClick={() => setFiltro(id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-950 ${
                activo
                  ? 'border-orange-600 bg-orange-600 text-white'
                  : 'border-black/10 bg-white text-stone-600 hover:border-orange-300 hover:text-orange-700 dark:border-white/10 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-orange-400 dark:hover:text-orange-300'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rutas.map(ruta => (
          <RouteCard key={ruta.id} ruta={ruta} />
        ))}
      </div>
    </section>
  )
}
