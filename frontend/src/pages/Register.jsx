import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { register } from '../services/api.js'
import Input from '../components/common/Input.jsx'
import Button from '../components/common/Button.jsx'

export default function Register() {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', confirmar: '' })
  const [enviando, setEnviando] = useState(false)
  const navigate = useNavigate()

  const handle = async (e) => {
    e.preventDefault()

    if (form.nombre.trim().length < 3) {
      Swal.fire('Nombre invÃ¡lido', 'Ingresa tu nombre completo.', 'error')
      return
    }
    if (form.password.length < 6) {
      Swal.fire('ContraseÃ±a muy corta', 'Debe tener al menos 6 caracteres.', 'error')
      return
    }
    if (form.password !== form.confirmar) {
      Swal.fire('ContraseÃ±as distintas', 'Las contraseÃ±as no coinciden.', 'error')
      return
    }

    setEnviando(true)
    try {
      await register({ nombre: form.nombre.trim(), email: form.email.trim(), password: form.password })
      await Swal.fire({
        title: 'Â¡Cuenta creada!',
        text: 'Ahora inicia sesiÃ³n con tu correo y contraseÃ±a.',
        icon: 'success',
        confirmButtonColor: '#FF6B00',
      })
      navigate('/login', { replace: true })
    } catch (err) {
      Swal.fire({
        title: 'No pudimos crear la cuenta',
        text: err.response?.data?.detail || 'Verifica que el backend estÃ© activo.',
        icon: 'error',
        confirmButtonColor: '#0F172A',
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="text-center text-2xl font-bold text-navy dark:text-white mb-4">BUSS ConnectPro</h1>
      <p className="text-center text-sm text-muted dark:text-stone-400 mb-6">Crea tu cuenta</p>
      <div className="card p-6">
        <h2 className="text-xl font-bold text-navy dark:text-white mb-4">Crear cuenta</h2>
        <form onSubmit={handle} className="flex flex-col gap-4">
          <Input label="Nombre completo" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
          <Input label="Correo electrÃ³nico" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <Input label="ContraseÃ±a" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          <Input label="Confirmar contraseÃ±a" type="password" value={form.confirmar} onChange={e => setForm({ ...form, confirmar: e.target.value })} required />
          <Button type="submit" disabled={enviando}>
            {enviando ? (<><span className="spinner" aria-hidden="true" /> Creando...</>) : 'Registrarme'}
          </Button>
        </form>
      </div>
      <p className="text-sm text-muted dark:text-stone-400 text-center mt-4">
        Â¿Ya tienes cuenta? <Link to="/login" className="text-accent hover:underline">Inicia sesiÃ³n</Link>
      </p>
    </div>
  )
}
