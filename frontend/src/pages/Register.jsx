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
      Swal.fire('Contraseña muy corta', 'Debe tener al menos 6 caracteres.', 'error')
      return
    }
    if (form.password !== form.confirmar) {
      Swal.fire('Contraseñas distintas', 'Las contraseñas no coinciden.', 'error')
      return
    }

    setEnviando(true)
    try {
      await register({ nombre: form.nombre.trim(), email: form.email.trim(), password: form.password })
      await Swal.fire({
        title: '¡Cuenta creada!',
        text: 'Ahora inicia sesión con tu correo y contraseña.',
        icon: 'success',
        confirmButtonColor: '#EA580C',
      })
      navigate('/login', { replace: true })
    } catch (err) {
      Swal.fire({
        title: 'No pudimos crear la cuenta',
        text: err.response?.data?.detail || 'Verifica que el backend esté activo.',
        icon: 'error',
        confirmButtonColor: '#0F172A',
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-10">
      <h1 className="text-center text-3xl font-black tracking-tight text-navy dark:text-white mb-1">LUX</h1>
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-primary mb-3">Líneas Únicas Xpress</p>
      <p className="text-center text-sm text-muted dark:text-stone-400 mb-6">Crea tu cuenta</p>
      <div className="card p-6">
        <h2 className="text-xl font-bold text-navy dark:text-white mb-4">Crear cuenta</h2>
        <form onSubmit={handle} className="flex flex-col gap-4">
          <Input label="Nombre completo" autoComplete="name" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
          <Input label="Correo electrónico" type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <div className="relative">
            <Input label="Contraseña" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3 top-9 text-xs font-bold text-stone-500 hover:text-navy dark:text-stone-400 dark:hover:text-white"
            >
              {showPw ? 'Ocultar' : 'Ver'}
            </button>
          </div>
          <Input label="Confirmar contraseña" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.confirmar} onChange={e => setForm({ ...form, confirmar: e.target.value })} required />
          <Button type="submit" disabled={enviando}>
            {enviando ? (<><span className="spinner" aria-hidden="true" /> Creando...</>) : 'Registrarme'}
          </Button>
        </form>
      </div>
      <p className="text-sm text-muted dark:text-stone-400 text-center mt-4">
        ¿Ya tienes cuenta? <Link to="/login" className="text-primary hover:underline">Inicia sesión</Link>
      </p>
    </div>
  )
}
