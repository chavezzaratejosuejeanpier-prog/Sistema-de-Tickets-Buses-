import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, UserRound } from 'lucide-react'
import ThemeToggle from '../common/ThemeToggle'
import { useAuth } from '../../context/useAuth.js'

const enlaceClass =
  'text-[18px] font-medium text-navy-light dark:text-neutral-200 hover:text-primary transition-colors'

const Navbar = () => {
  const [abierto, setAbierto] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const alCambiarTamano = () => window.innerWidth >= 768 && setAbierto(false)
    window.addEventListener('resize', alCambiarTamano)
    return () => window.removeEventListener('resize', alCambiarTamano)
  }, [])

  const enlaces = [
    { texto: 'Mis Pasajes', to: '/mis-pasajes' },
    user ? { texto: 'Panel', to: '/dashboard' } : { texto: 'Iniciar sesión', to: '/login' },
  ]

  const cerrarSesion = () => {
    logout()
    setAbierto(false)
    navigate('/')
  }

  const nombre = user?.nombre || user?.email?.split('@')[0]

  return (
    <nav className="sticky top-0 z-50 h-20 bg-white dark:bg-stone-900 border-b border-line dark:border-stone-800">
      <div className="max-w-shell mx-auto px-4 sm:px-[30px] h-full flex items-center justify-between">
        <Link
          to="/"
          className="text-[36px] font-bold text-navy dark:text-white leading-none shrink-0"
          aria-label="BUSS ConnectPro - Inicio"
        >
          BUSS ConnectPro
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {enlaces.map(({ texto, to }) => (
            <NavLink key={texto} to={to} className={enlaceClass}>
              {texto}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="hidden md:inline-flex rounded-lg bg-slate-100 dark:bg-stone-800 px-[18px] py-2.5 text-[15px] font-semibold text-navy dark:text-neutral-100 transition-colors hover:bg-slate-200 dark:hover:bg-stone-700"
            aria-label="Moneda: soles peruanos"
          >
            PEN (S/.)
          </button>

          <ThemeToggle />

          {user && (
            <button
              type="button"
              onClick={cerrarSesion}
              title={`Cerrar sesión de ${nombre}`}
              className="hidden md:inline-flex items-center gap-2 rounded-lg border border-line dark:border-stone-700 px-3 py-2 text-[15px] font-medium text-navy dark:text-neutral-100 hover:border-primary hover:text-primary transition-colors"
            >
              <UserRound size={16} aria-hidden="true" />
              <span className="max-w-[110px] truncate">{nombre}</span>
              <LogOut size={16} aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setAbierto(o => !o)}
            aria-expanded={abierto}
            aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-line dark:border-stone-700 text-navy dark:text-white"
          >
            {abierto ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {abierto && (
        <div className="md:hidden bg-white dark:bg-stone-900 border-b border-line dark:border-stone-800">
          <div className="max-w-shell mx-auto px-4 py-4 flex flex-col gap-4">
            {enlaces.map(({ texto, to }) => (
              <NavLink key={texto} to={to} onClick={() => setAbierto(false)} className={enlaceClass}>
                {texto}
              </NavLink>
            ))}

            {user && (
              <button type="button" onClick={cerrarSesion} className={`${enlaceClass} self-start inline-flex items-center gap-2`}>
                <LogOut size={18} aria-hidden="true" /> Cerrar sesión ({nombre})
              </button>
            )}

            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-slate-100 dark:bg-stone-800 px-[18px] py-2.5 text-[15px] font-semibold text-navy dark:text-neutral-100">
                PEN (S/.)
              </span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar