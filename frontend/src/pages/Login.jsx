import { useState } from 'react'
import { login } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Input from '../components/common/Input.jsx'
import Button from '../components/common/Button.jsx'

export default function Login() {
  const [email, setEmail] = useState('admin@buss.com')
  const [password, setPassword] = useState('123456')
  const { login: ctxLogin } = useAuth()

  const handle = async (e) => {
    e.preventDefault()
    try {
      const { data } = await login({ email, password })
      ctxLogin({ email }, data.access_token)
      alert('Login OK - token guardado')
    } catch { alert('Credenciales inválidas o backend no activo') }
  }
  return (
    <div className="max-w-sm mx-auto p-6 mt-10 bg-white rounded shadow">
      <h1 className="text-xl font-bold text-primary mb-4">Acceso BUSS ConectPro</h1>
      <form onSubmit={handle} className="flex flex-col gap-4">
        <Input label="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <Input label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <Button type="submit">Ingresar</Button>
      </form>
    </div>
  )
}
