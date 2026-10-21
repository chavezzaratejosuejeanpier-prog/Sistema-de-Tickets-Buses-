import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { login } from '../services/api.js'
import { useAuth } from '../context/useAuth.js'
import Input from '../components/common/Input.jsx'
import Button from '../components/common/Button.jsx'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const { login: ctxLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = location.state?.from || '/dashboard'

  const handle = async (e) => {
    e.preventDefault()
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      Swal.fire('Email inválido', 'Ingresa un correo válido.', 'error')
      return
    }
    if (password.length < 4) {
      Swal.fire('Contraseña inválida', 'Ingresa tu contraseña.', 'error')
      return
    }
    setEnviando(true)
    try {
      const { data } = await login({ email: email.trim(), password })
      ctxLogin({ email: email.trim(), rol: data.rol, nombre: data.nombre }, data.access_token)
      await Swal.fire({
        title: '¡Sesión iniciada!',
        text: 'Bienvenido a LUX - Líneas Únicas Xpress.',
        icon: 'success',
        confirmButtonColor: '#EA580C',
      })
      navigate(destino, { replace: true })
    } catch (err) {
      const credencialesMalas = err.response?.status === 401
      Swal.fire({
        title: credencialesMalas ? 'Credenciales inválidas' : 'Sin conexión',
        text: credencialesMalas
          ? 'Revisa tu correo y contraseña.'
          : 'No pudimos conectar con el servidor. Verifica que el backend esté activo.',
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
      <p className="text-center text-sm text-muted dark:text-stone-400 mb-6">Accede a tu cuenta</p>
      <div className="card p-6">
        <h2 className="text-xl font-bold text-navy dark:text-white mb-4">Acceso</h2>
        <form onSubmit={handle} className="flex flex-col gap-4">
          <Input label="Correo electrónico" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <div className="relative">
            <Input label="Contraseña" type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-3 top-9 text-xs font-bold text-stone-500 hover:text-navy dark:text-stone-400 dark:hover:text-white"
            >
              {showPw ? 'Ocultar' : 'Ver'}
            </button>
          </div>
          <Button type="submit" disabled={enviando}>
            {enviando ? (<><span className="spinner" aria-hidden="true" /> Ingresando...</>) : 'Ingresar'}
          </Button>
        </form>
      </div>
      <p className="text-sm text-muted dark:text-stone-400 text-center mt-4">
        ¿No tienes cuenta? <Link to="/registro" className="text-primary hover:underline">Regístrate</Link>
      </p>
    </div>
  )
}
