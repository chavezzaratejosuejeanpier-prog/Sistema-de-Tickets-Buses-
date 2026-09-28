import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { register } from '../services/api.js'
import Input from '../components/common/Input.jsx'
import Button from '../components/common/Button.jsx'

export default function Register() {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', confirmar: '' })
  const [showPw, setShowPw] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const navigate = useNavigate()

  const handle = async (e) => {
    e.preventDefault()
    if (form.nombre.trim().length < 3) {
      Swal.fire('Nombre inválido', 'Ingresa tu nombre completo.', 'error')
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      Swal.fire('Email inválido', 'Ingresa un correo válido.', 'error')
      return
    }
    if (form.password.length < 6) {
      Swal.fire('Contraseña débil', 'Usa al menos 6 caracteres.', 'error')
      return
    }
    if (form.password !== form.confirmar) {
      Swal.fire('No coinciden', 'Las contraseñas no coinciden.', 'error')
      return
    }
    setEnviando(true)
    try {
      await register({ nombre: form.nombre.trim(), email: form.email.trim(), password: form.password })
      await Swal.fire({ title: 'Cuenta creada', text: 'Ahora inicia sesión con tus credenciales.', icon: 'success', confirmButtonColor: '#10b981' })
      navigate('/login')
    } catch (err) {
      Swal.fire('No se pudo registrar', err.response?.data?.detail || 'Verifica que el backend esté activo.', 'error')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6 mt-10 bg-white rounded shadow">
      <h1 className="text-xl font-bold text-navy mb-4">Crear cuenta BUSS ConnectPro</h1>
      <form onSubmit={handle} className="flex flex-col gap-4">
        <Input label="Nombre completo" autoComplete="name" value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} required />
        <Input label="Correo electrónico" type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required />
        <div className="relative">
          <Input label="Contraseña" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} required />
          <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-3 top-9 text-xs font-bold text-stone-500 hover:text-navy">
            {showPw ? 'Ocultar' : 'Ver'}
          </button>
        </div>
        <Input label="Confirmar contraseña" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.confirmar} onChange={e=>setForm({...form, confirmar:e.target.value})} required />
        <Button type="submit" disabled={enviando}>
          {enviando ? (<><span className="spinner" aria-hidden="true" /> Creando cuenta...</>) : 'Registrarme'}
        </Button>
        <p className="text-sm text-stone-600 text-center">
          ¿Ya tienes cuenta? <Link to="/login" className="text-accent hover:underline">Inicia sesión</Link>
        </p>
      </form>
    </div>
  )
}
