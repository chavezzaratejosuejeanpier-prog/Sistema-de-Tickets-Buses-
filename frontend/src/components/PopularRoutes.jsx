import { Link } from 'react-router-dom'
import RouteCard from './RouteCard.jsx'

const RUTAS = [
  { origen: 'Lima', destino: 'Cusco', precio: 'Desde S/. 80', duracion: '22h', asiento: 'Cama', imagen: 'cusco.webp' },
  { origen: 'Trujillo', destino: 'Chiclayo', precio: 'Desde S/. 30', duracion: '4h', asiento: 'Semi Cama', imagen: 'chiclayo.jpeg' },
  { origen: 'Lima', destino: 'Arequipa', precio: 'Desde S/. 65', duracion: '16h', asiento: 'Cama', imagen: 'arequipa.webp' },
  { origen: 'Cusco', destino: 'Puno', precio: 'Desde S/. 25', duracion: '7h', asiento: 'Semi Cama', imagen: 'puno.webp' },
]

const BENTO = [
  'col-span-2 h-72 md:col-span-1 md:row-span-2 md:h-auto',
  'col-span-2 h-44 md:col-span-2 md:h-auto',
  'col-span-1 h-44 md:h-auto',
  'col-span-1 h-44 md:h-auto',
]

export default function PopularRoutes({ onSelect }) {
  return (
    <div>
      <h2 className="mb-6 text-3xl font-extrabold text-navy dark:text-white sm:text-4xl">Rutas Populares</h2>

      <div className="grid grid-cols-2 gap-4 md:auto-rows-[220px] md:grid-cols-3">
        {RUTAS.map((r, i) => (
          <RouteCard
            key={`${r.origen}-${r.destino}`}
            {...r}
            className={BENTO[i]}
            onSelect={() => onSelect(r)}
          />
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link to="/buscar" className="btn-outline inline-flex">
          Ver todas las rutas
        </Link>
      </div>
    </div>
  )
}
