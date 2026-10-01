import { Link } from 'react-router-dom'
import RouteCard from './RouteCard.jsx'

// Lista estática (4 rutas) — cuando el backend exponga GET /routes con precio/duración,
// sustituir por useEffect + getRoutes() mapeando a las claves de RouteCard.
const RUTAS = [
  { origen: 'Lima', destino: 'Cusco', precio: 'Desde S/. 80', duracion: '22h', asiento: 'Cama', imagen: 'ruta-lima-cusco.jpg' },
  { origen: 'Trujillo', destino: 'Chiclayo', precio: 'Desde S/. 30', duracion: '4h', asiento: 'Semi Cama', imagen: 'ruta-trujillo-chiclayo.jpg' },
  { origen: 'Lima', destino: 'Arequipa', precio: 'Desde S/. 65', duracion: '16h', asiento: 'Cama', imagen: 'ruta-lima-arequipa.jpg' },
  { origen: 'Cusco', destino: 'Puno', precio: 'Desde S/. 25', duracion: '7h', asiento: 'Semi Cama', imagen: 'ruta-cusco-puno.jpg' },
]

export default function PopularRoutes({ onSelect }) {
  return (
    <div>
      <h2 className="mb-6 text-[30px] font-extrabold text-navy sm:text-[40px]">Rutas Populares</h2>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {RUTAS.map(r => (
          <RouteCard key={`${r.origen}-${r.destino}`} {...r} onSelect={() => onSelect(r)} />
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
