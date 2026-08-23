export default function Dashboard() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-primary">Dashboard Administrativo</h1>
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-white p-6 rounded shadow"><p className="text-gray-500">Ventas Hoy</p><p className="text-2xl font-bold">--</p></div>
        <div className="bg-white p-6 rounded shadow"><p className="text-gray-500">Buses Activos</p><p className="text-2xl font-bold">--</p></div>
        <div className="bg-white p-6 rounded shadow"><p className="text-gray-500">Rutas</p><p className="text-2xl font-bold">--</p></div>
      </div>
      <p className="text-sm text-gray-500 mt-4">Conecta aquí listados de buses/rutas/ventas consumiendo /api/buses y /api/routes.</p>
    </div>
  )
}
