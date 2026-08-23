import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function Navbar() {
  const { user, logout } = useAuth()
  return (
    <nav className="bg-primary text-white px-6 py-4 flex justify-between items-center shadow">
      <Link to="/" className="text-xl font-bold tracking-wide">BUSS<span className="text-accent"> ConectPro</span></Link>
      <div className="flex gap-4 items-center">
        <Link to="/buscar" className="hover:text-accent">Buscar Viajes</Link>
        <Link to="/dashboard" className="hover:text-accent">Dashboard</Link>
        {user ? <button onClick={logout} className="bg-accent px-4 py-1 rounded hover:bg-accent-hover">Salir</button>
              : <Link to="/login" className="bg-white text-primary px-4 py-1 rounded font-semibold">Login</Link>}
      </div>
    </nav>
  )
}
