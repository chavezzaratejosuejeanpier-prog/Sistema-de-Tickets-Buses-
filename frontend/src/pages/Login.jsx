import { useState } from 'react'
import Swal from 'sweetalert2'
import { login } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Input from '../components/common/Input.jsx'
import Button from '../components/common/Button.jsx'

export default function Login() {
  const [email, setEmail] = useState('admin@buss.com')
  const [password, setPassword] = useState('123456')
  const [enviando, setEnviando] = useState(false)
  const { login: ctxLogin } = useAuth()

  const handle = async (e) => {
    e.preventDefault()
    setEnviando(true)
    try {
      const { data } = await login({ email, password })
      ctxLogin({ email }, data.access_token)
      Swal.fire({ title: '¡Bienvenido!', text: 'Sesión iniciada correctamente.', icon: 'success', confirmButtonColor: '#10b981' })
    } catch {
      Swal.fire({ title: 'Error', text: 'Credenciales inválidas o backend no activo.', icon: 'error', confirmButtonColor: '#0f2a44' })
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div className="max-w-sm mx-auto p-6 mt-10 card">
      <h1 className="text-xl font-bold text-primary mb-4">Acceso BUSS ConectPro</h1>
      <form onSubmit={handle} className="flex flex-col gap-4">
        <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <Input label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <Button type="submit" disabled={enviando}>
          {enviando ? (<><span className="spinner" aria-hidden="true" /> Ingresando...</>) : 'Ingresar'}
        </Button>
      </form>
    </div>
  )
}