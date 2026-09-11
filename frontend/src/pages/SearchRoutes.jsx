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
      <form onSubmit={buscar} className="card p-6 flex flex-col md:flex-row gap-4 md:items-end">
        <div className="flex-1"><Input label="Origen" value={origen} onChange={e=>setOrigen(e.target.value)} placeholder="Lima" /></div>
        <div className="flex-1"><Input label="Destino" value={destino} onChange={e=>setDestino(e.target.value)} placeholder="Arequipa" /></div>
        <Button type="submit">Buscar</Button>
      </form>

      <div className="mt-6 grid gap-4">
        {resultados.length===0 && <p className="text-slate-500">Ingresa origen/destino y presiona Buscar. Asegúrate que el backend esté corriendo.</p>}
        {resultados.map(r=>(
          <div key={r.id} className="card p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="font-bold text-primary">{r.origen} → {r.destino}</p>
              <p className="text-sm text-slate-600">{new Date(r.fecha_salida).toLocaleDateString()} - {r.hora_salida} | Bus {r.bus_placa} ({r.bus_tipo})</p>
              <p className="text-sm">Asientos libres: <span className="font-bold text-green-600">{r.asientos_disponibles}</span></p>
            </div>
            <div className="text-right w-full sm:w-auto">
              <p className="text-xl font-bold text-accent">S/ {r.precio_base}</p>
              <Button onClick={()=>navigate(`/asientos/${r.id}`)}>Ver Asientos</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
