import { useState } from 'react'
import { checkout } from '../services/api.js'
import Input from '../components/common/Input.jsx'
import Button from '../components/common/Button.jsx'

export default function Checkout() {
  const reserva = JSON.parse(localStorage.getItem('reserva') || '{}')
  const [form, setForm] = useState({ pasajero_nombre:'', pasajero_dni:'', email:'' })
  const [result, setResult] = useState(null)

  const pagar = async (e) => {
    e.preventDefault()
    try {
      const { data } = await checkout({ route_id: Number(reserva.routeId), asientos: reserva.asientos, ...form })
      setResult(data)
    } catch (err) { alert(err.response?.data?.detail || 'Error en checkout') }
  }

  if(result) return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded shadow mt-6 text-center">
      <h2 className="text-2xl font-bold text-green-600">¡Compra Exitosa!</h2>
      <p className="mt-2">Código: <span className="font-mono font-bold">{result.codigo_reserva}</span></p>
      <p>Asientos: {result.asientos.join(', ')} | Total: S/ {result.total}</p>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-primary mb-4">Checkout - Datos del Pasajero</h1>
      <p className="text-sm text-gray-600 mb-4">Ruta #{reserva.routeId} - Asientos: {reserva.asientos?.join(', ')}</p>
      <form onSubmit={pagar} className="bg-white p-6 rounded shadow flex flex-col gap-4">
        <Input label="Nombre completo" value={form.pasajero_nombre} onChange={e=>setForm({...form, pasajero_nombre:e.target.value})} required />
        <Input label="DNI" value={form.pasajero_dni} onChange={e=>setForm({...form, pasajero_dni:e.target.value})} required />
        <Input label="Email" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required />
        <Button type="submit">Pagar y Generar Boleto</Button>
      </form>
    </div>
  )
}
