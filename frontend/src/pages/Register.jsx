import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../services/api.js'
import Input from '../components/common/Input.jsx'
import Button from '../components/common/Button.jsx'

export default function Register() {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', confirmar: '' })
  const navigate = useNavigate()

  const handle = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirmar) {
      alert('Las contraseñas no coinciden')
      return
    }
    try {
      await register({ nombre: form.nombre, email: form.email, password: form.password })
      alert('Cuenta creada correctamente - ahora inicia sesión')
      navigate('/login')
    } catch (err) {
      alert(err.response?.data?.detail || 'No se pudo registrar, verifica que el backend esté activo')
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6 mt-10 bg-white rounded shadow">
      <h1 className="text-xl font-bold text-primary mb-4">Crear cuenta BUSS ConectPro</h1>
      <form onSubmit={handle} className="flex flex-col gap-4">
        <Input label="Nombre completo" value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} required />
        <Input label="Email" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required />
        <Input label="Password" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} required />
        <Input label="Confirmar password" type="password" value={form.confirmar} onChange={e=>setForm({...form, confirmar:e.target.value})} required />
        <Button type="submit">Registrarme</Button>
        <p className="text-sm text-gray-600 text-center">
          ¿Ya tienes cuenta? <Link to="/login" className="text-accent hover:underline">Inicia sesión</Link>
        </p>
      </form>
    </div>
  )
}