import RouteCard from './RouteCard.jsx'

// ponytail: lista estatica (2 rutas). Si el backend expone /routes con precio y duracion,
// sustituir por useEffect + getRoutes() mapeando a las mismas claves de RouteCard.
const RUTAS = [
  { origen: 'Lima', destino: 'Cusco', precio: 'Desde S/. 80', duracion: '22h', asiento: 'Cama', imagen: 'ruta-lima-cusco.jpg' },
  { origen: 'Trujillo', destino: 'Chiclayo', precio: 'Desde S/. 30', duracion: '4h', asiento: 'Semi Cama', imagen: 'ruta-trujillo-chiclayo.jpg' },
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
    </div>
  )
}
