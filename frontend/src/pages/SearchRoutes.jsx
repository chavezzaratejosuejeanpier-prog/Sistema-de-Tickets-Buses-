import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchRoutes } from '../services/api.js'
import Input from '../components/common/Input.jsx'
import Button from '../components/common/Button.jsx'

export default function SearchRoutes() {
  const [origen, setOrigen] = useState('Lima')
  const [destino, setDestino] = useState('Cusco')
  const [resultados, setResultados] = useState([])
  const navigate = useNavigate()

  const buscar = async (e) => {
    e.preventDefault()
    try {
      const { data } = await searchRoutes(origen, destino)
      setResultados(data)
    } catch { setResultados([]) }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-primary mb-6">Buscar Viajes</h1>
      <form onSubmit={buscar} className="bg-white p-6 rounded shadow flex gap-4 items-end">
        <Input label="Origen" value={origen} onChange={e=>setOrigen(e.target.value)} placeholder="Lima" />
        <Input label="Destino" value={destino} onChange={e=>setDestino(e.target.value)} placeholder="Arequipa" />
        <Button type="submit">Buscar</Button>
      </form>

      <div className="mt-6 grid gap-4">
        {resultados.length===0 && <p className="text-gray-500">Ingresa origen/destino y presiona Buscar. Asegúrate que el backend esté corriendo.</p>}
        {resultados.map(r=>(
          <div key={r.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
            <div>
              <p className="font-bold text-primary">{r.origen} → {r.destino}</p>
              <p className="text-sm text-gray-600">{new Date(r.fecha_salida).toLocaleDateString()} - {r.hora_salida} | Bus {r.bus_placa} ({r.bus_tipo})</p>
              <p className="text-sm">Asientos libres: <span className="font-bold text-green-600">{r.asientos_disponibles}</span></p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-accent">S/ {r.precio_base}</p>
              <Button onClick={()=>navigate(`/asientos/${r.id}`)}>Ver Asientos</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
