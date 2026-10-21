import { ArrowLeftRight, Search, ShieldCheck, Armchair, Wifi } from 'lucide-react'
import CityField from './common/CityField.jsx'
import DateField from './common/DateField.jsx'
import fondo from '../assets/plaza-armas-cusco.jpeg'

const BENEFICIOS = [
  { Icono: ShieldCheck, texto: 'Seguridad' },
  { Icono: Armchair, texto: 'Confort' },
  { Icono: Wifi, texto: 'Wi-Fi' },
]

export default function SearchHero({
  origen, destino, fechaIda, fechaRetorno,
  onOrigen, onDestino, onFechaIda, onFechaRetorno, onSwap, onSubmit, error,
}) {
  const hoy = new Date().toLocaleDateString('en-CA')
  const valido = origen.trim().length >= 2 && destino.trim().length >= 2 && origen.trim().toLowerCase() !== destino.trim().toLowerCase()

  return (
    <section className="relative min-h-[760px] w-full md:min-h-[80vh]">
      <img
        src={fondo}
        alt="Plaza de Armas del Cusco - LUX Líneas Únicas Xpress"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-l from-purple-900/95 to-transparent" />

      <div className="relative mx-auto flex min-h-[760px] w-full max-w-shell items-center justify-end px-4 pb-64 pt-28 sm:px-[30px] md:min-h-[80vh] md:pb-56">
        <div className="max-w-xl text-right text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/80">LUX · Líneas Únicas Xpress</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
            Hasta 30% de descuento
          </h1>
          <p className="ml-auto mt-4 max-w-md text-base text-white/90 sm:text-lg">
            Viaja nivel premium con LUX. Encuentra los mejores pasajes a nivel nacional.
          </p>

          <div className="mt-8 flex flex-wrap justify-end gap-3">
            {BENEFICIOS.map(({ Icono, texto }) => (
              <span key={texto} className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <Icono size={18} />
                {texto}
              </span>
            ))}
          </div>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="absolute inset-x-4 bottom-4 z-20 mx-auto w-auto max-w-6xl md:inset-x-6 md:bottom-24"
      >
        {error && (
          <p className="mb-2 ml-auto w-fit rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-red-600 shadow-lg">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 rounded-3xl bg-white p-4 shadow-xl md:flex md:items-center md:gap-0 md:rounded-full md:py-3 md:pl-6 md:pr-3 dark:border dark:border-stone-700 dark:bg-stone-800/95 dark:backdrop-blur">
          <div className="min-w-0 rounded-lg transition-colors focus-within:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/40 md:flex-1 md:border-r md:border-line md:pr-4">
            <CityField
              variant="pill"
              label="Origen"
              value={origen}
              onChange={onOrigen}
              placeholder="Ingrese una ciudad"
              exclude={destino}
            />
          </div>

          <button
            type="button"
            onClick={onSwap}
            aria-label="Intercambiar origen y destino"
            title="Intercambiar"
            className="hidden size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-slate-100 hover:text-primary md:mx-2 md:flex dark:hover:bg-stone-700 dark:hover:text-primary"
          >
            <ArrowLeftRight size={18} />
          </button>

          <div className="min-w-0 rounded-lg transition-colors focus-within:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/40 md:flex-1 md:border-r md:border-line md:px-4">
            <CityField
              variant="pill"
              label="Destino"
              value={destino}
              onChange={onDestino}
              placeholder="Ingrese el destino"
              exclude={origen}
            />
          </div>

          <div className="min-w-0 rounded-lg transition-colors focus-within:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/40 md:w-44 md:border-r md:border-line md:px-4">
            <DateField
              variant="pill"
              label="Fecha salida"
              value={fechaIda}
              min={hoy}
              onChange={e => onFechaIda(e.target.value)}
            />
          </div>

          <div className="min-w-0 rounded-lg transition-colors focus-within:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/40 md:w-44 md:px-4">
            <DateField
              variant="pill"
              label="Fecha retorno"
              value={fechaRetorno}
              min={fechaIda || hoy}
              onChange={e => onFechaRetorno(e.target.value)}
            />
          </div>

          <div className="col-span-2 flex justify-end md:col-span-1 md:ml-2">
            <button
              type="submit"
              disabled={!valido}
              aria-label="Buscar pasajes disponibles - LUX Líneas Únicas Xpress"
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/25 transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40 md:size-14"
            >
              <Search size={22} />
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
