import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { login } from '../services/api.js'
import { useAuth } from '../context/useAuth.js'
import Input from '../components/common/Input.jsx'
import Button from '../components/common/Button.jsx'

export default function Login() {
  const [email, setEmail] = useState('admin@buss.com')
  const [password, setPassword] = useState('123456')
  const [enviando, setEnviando] = useState(false)
  const { login: ctxLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = location.state?.from || '/dashboard'

  const handle = async (e) => {
    e.preventDefault()
    setEnviando(true)
    try {
      const { data } = await login({ email, password })
      ctxLogin({ email }, data.access_token)
      Swal.fire({
        title: '¡Sesión iniciada!',
        text: 'Bienvenido a BUSS ConnectPro.',
        icon: 'success',
        confirmButtonColor: '#FF6B00',
      }).then(() => navigate(destino, { replace: true }))
    } catch {
      Swal.fire({
        title: 'No pudimos iniciar sesión',
        text: 'Credenciales inválidas o backend no activo.',
        icon: 'error',
        confirmButtonColor: '#0F172A',
      })
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div className="max-w-sm mx-auto mt-10 card p-6">
      <h1 className="text-xl font-bold text-navy dark:text-white mb-4">Acceso BUSS ConnectPro</h1>
      <form onSubmit={handle} className="flex flex-col gap-4">
        <Input label="Correo electrónico" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <Input label="Contraseña" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <Button type="submit" disabled={enviando}>
          {enviando ? (<><span className="spinner" aria-hidden="true" /> Ingresando...</>) : 'Ingresar'}
        </Button>
      </form>
      <p className="text-sm text-muted dark:text-stone-400 text-center mt-4">
        ¿No tienes cuenta? <Link to="/registro" className="text-accent hover:underline">Regístrate</Link>
      </p>
    </div>
  )
}
