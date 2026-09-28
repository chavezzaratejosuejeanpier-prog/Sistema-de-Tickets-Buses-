import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Swal from 'sweetalert2'
import { login } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Input from '../components/common/Input.jsx'
import Button from '../components/common/Button.jsx'

export default function Login() {
  const [email, setEmail] = useState('admin@buss.com')
  const [password, setPassword] = useState('123456')
  const [showPw, setShowPw] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const { login: ctxLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = location.state?.from || '/buscar'

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
      ctxLogin({ email: email.trim() }, data.access_token)
      await Swal.fire({ title: 'Sesión iniciada', text: 'Bienvenido a BUSS ConnectPro.', icon: 'success', confirmButtonColor: '#10b981' })
      navigate(destino, { replace: true })
    } catch (err) {
      Swal.fire('No se pudo ingresar', err.response?.data?.detail || 'Credenciales inválidas o backend no activo.', 'error')
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div className="max-w-sm mx-auto p-6 mt-10 card">
      <h1 className="text-xl font-bold text-navy mb-4">Acceso BUSS ConnectPro</h1>
      <form onSubmit={handle} className="flex flex-col gap-4">
        <Input label="Correo electrónico" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <div className="relative">
          <Input label="Contraseña" type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required />
          <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-3 top-9 text-xs font-bold text-stone-500 hover:text-navy">
            {showPw ? 'Ocultar' : 'Ver'}
          </button>
        </div>
        <Button type="submit" disabled={enviando}>
          {enviando ? (<><span className="spinner" aria-hidden="true" /> Ingresando...</>) : 'Ingresar'}
        </Button>
      </form>
      <p className="text-sm text-stone-600 text-center mt-4">
        ¿No tienes cuenta? <Link to="/registro" className="text-accent hover:underline">Regístrate</Link>
      </p>
    </div>
  )
}
