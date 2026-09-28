import { useId } from 'react'
import { ArrowLeftRight, Calendar, User } from 'lucide-react'
import CityField from './common/CityField.jsx'

// ponytail: sin imagen de fondo todavia. Cuando exista src/assets/hero-montanas.jpg,
// sustituir el bg-[linear-gradient(...)] de FONDO por style={{ backgroundImage: `url(${hero})` }} + bg-cover bg-center.
// ponytail: fechaRetorno y pasajeros son UI only — searchRoutes(origen, destino, fecha) no los acepta.
// Si el backend los soporta, añadirlos a la query y pasarlos en el navigate de Home.
const FONDO = 'bg-[linear-gradient(to_bottom_right,#CBD5E1,#94A3B8)]'

const DateField = ({ label, value, onChange, min }) => {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[15px] font-semibold text-navy-light">{label}</label>
      <div className="relative">
        <Calendar size={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id={id}
          type="date"
          value={value}
          min={min}
          onChange={e => onChange(e.target.value)}
          className="input h-[52px] border-slate-300 py-0 pl-11 pr-3 focus:ring-2 [color-scheme:light]"
        />
      </div>
    </div>
  )
}

export default function SearchHero({
  origen, destino, fechaIda, fechaRetorno, pasajeros,
  onOrigen, onDestino, onFechaIda, onFechaRetorno, onPasajeros, onSwap, onSubmit, error,
}) {
  const idPasajeros = useId()
  const hoy = new Date().toISOString().split('T')[0]
  const valido = origen.trim().length >= 2 && destino.trim().length >= 2 && origen.trim().toLowerCase() !== destino.trim().toLowerCase()

  return (
    <section className="relative h-[500px] overflow-hidden rounded-2xl border border-line shadow-soft">
      {/* ponytail: degradado de respaldo, no imagen. Ver nota FONDO arriba. */}
      <div className={`absolute inset-0 ${FONDO}`} />
      <div className="absolute inset-0 bg-white/60" />

      <div className="relative flex h-full flex-col items-center justify-center px-4 py-10 sm:px-[30px]">
        <h1 className="text-center text-4xl font-extrabold text-navy md:text-[64px] md:leading-tight">
          Viaja con Seguridad
        </h1>
        <p className="mt-3 text-center text-xl font-medium text-navy-light md:text-[24px]">
          Encuentra los mejores pasajes a nivel nacional
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-10 w-full max-w-[1120px] rounded-xl bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.10)] md:p-[30px]"
        >
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:flex lg:gap-5">
            <div className="lg:flex-1">
              <CityField label="Origen" value={origen} onChange={onOrigen} placeholder="Ej. Lima" exclude={destino} />
            </div>

            <button
              type="button"
              onClick={onSwap}
              aria-label="Intercambiar origen y destino"
              title="Intercambiar"
              className="col-span-2 mx-auto flex size-12 shrink-0 rotate-90 items-center justify-center self-end rounded-full border border-line bg-white text-navy shadow-soft hover:border-primary hover:text-primary lg:rotate-0"
            >
              <ArrowLeftRight size={20} />
            </button>

            <div className="lg:flex-1">
              <CityField label="Destino" value={destino} onChange={onDestino} placeholder="Ej. Cusco" exclude={origen} />
            </div>

            <div className="lg:w-[190px] lg:shrink-0">
              <DateField label="Fecha Ida" value={fechaIda} onChange={onFechaIda} min={hoy} />
            </div>

            <div className="lg:w-[190px] lg:shrink-0">
              <DateField label="Fecha Retorno" value={fechaRetorno} onChange={onFechaRetorno} min={fechaIda || hoy} />
            </div>

            <div className="lg:w-[130px] lg:shrink-0">
              <label htmlFor={idPasajeros} className="mb-2 block text-[15px] font-semibold text-navy-light">Pasajeros</label>
              <div className="relative">
                <User size={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id={idPasajeros}
                  type="number"
                  min={1}
                  max={12}
                  value={pasajeros}
                  onChange={e => onPasajeros(e.target.value)}
                  className="input h-[52px] border-slate-300 py-0 pl-11 pr-3 focus:ring-2"
                />
              </div>
            </div>
          </div>

          {error && <p className="mt-4 text-center text-sm font-semibold text-primary">{error}</p>}

          <button
            type="submit"
            disabled={!valido}
            className="mt-5 h-[60px] w-full rounded-lg bg-primary text-[20px] font-bold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            Buscar Pasajes Disponibles
          </button>
        </form>
      </div>
    </section>
  )
}
