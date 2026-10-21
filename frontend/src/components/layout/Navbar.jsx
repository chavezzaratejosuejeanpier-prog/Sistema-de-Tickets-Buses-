import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, UserRound, Bus } from 'lucide-react'
import ThemeToggle from '../common/ThemeToggle'
import { useAuth } from '../../context/useAuth.js'

const Navbar = () => {
  const { pathname } = useLocation()
  const transparente = pathname === '/'
  const [abierto, setAbierto] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const alCambiarTamano = () => window.innerWidth >= 768 && setAbierto(false)
    const alPresionarTecla = (e) => { if (e.key === 'Escape') setAbierto(false) }
    window.addEventListener('resize', alCambiarTamano)
    window.addEventListener('keydown', alPresionarTecla)
    return () => {
      window.removeEventListener('resize', alCambiarTamano)
      window.removeEventListener('keydown', alPresionarTecla)
    }
  }, [])

  const enlaces = [
    { texto: 'Inicio', to: '/' },
    { texto: 'Rutas', to: '/buscar' },
    { texto: 'Servicios', to: '/#servicios' },
    { texto: 'Nosotros', to: '/#nosotros' },
  ]
  if (user) enlaces.push({ texto: 'Mis Pasajes', to: '/mis-pasajes' })
  if (user?.rol === 'ADMIN') enlaces.push({ texto: 'Panel', to: '/dashboard' })

  const cerrarSesion = () => {
    logout()
    setAbierto(false)
    navigate('/')
  }

  const nombre = user?.nombre || user?.email?.split('@')[0]

  const baseLink = 'text-base font-medium transition-colors duration-200'
  const activo = transparente ? 'text-white' : 'text-primary dark:text-primary'
  const inactivo = transparente
    ? 'text-white/85 hover:text-white'
    : 'text-navy-light hover:text-primary dark:text-neutral-200'

  const claseEnlace = (to) => (to === pathname && !to.includes('#') ? `${baseLink} ${activo}` : `${baseLink} ${inactivo}`)

  return (
    <header
      className={
        transparente
          ? 'absolute inset-x-0 top-0 z-50 bg-transparent'
          : 'sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95'
      }
    >
      <div className="mx-auto flex h-20 max-w-shell items-center gap-6 px-4 sm:px-[30px]">
        <Link
          to="/"
          aria-label="BUSS ConnectPro - Inicio"
          className={`flex shrink-0 items-center gap-2 text-2xl font-bold leading-none sm:text-3xl ${
            transparente ? 'text-white' : 'text-navy dark:text-white'
          }`}
        >
          <Bus size={30} strokeWidth={2.2} aria-hidden="true" />
          <span>BUSS ConnectPro</span>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex" aria-label="Navegación principal">
          {enlaces.map(({ texto, to }) => (
            <Link key={texto} to={to} className={claseEnlace(to)}>
              {texto}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />

          {!user && (
            <Link
              to="/login"
              className={`hidden rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors sm:inline-flex ${
                transparente
                  ? 'border-white/50 text-white hover:bg-white hover:text-[#6B21A8]'
                  : 'border-line text-navy hover:border-primary hover:text-primary dark:border-stone-700 dark:text-white'
              }`}
            >
              Iniciar sesión
            </Link>
          )}

          {user && (
            <button
              type="button"
              onClick={cerrarSesion}
              title={`Cerrar sesión de ${nombre}`}
              className={`hidden items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors md:inline-flex ${
                transparente
                  ? 'border-white/50 text-white hover:bg-white hover:text-[#6B21A8]'
                  : 'border-line text-navy hover:border-primary hover:text-primary dark:border-stone-700 dark:text-neutral-100'
              }`}
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
            className={`inline-flex size-10 items-center justify-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 lg:hidden ${
              transparente
                ? 'border-white/40 text-white'
                : 'border-line text-navy dark:border-stone-700 dark:text-white'
            }`}
          >
            {abierto ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {abierto && (
        <div className={`border-b lg:hidden ${transparente ? 'bg-[#4C1D95] text-white' : 'border-line bg-white dark:border-stone-800 dark:bg-stone-900'}`}>
          <div className="mx-auto flex max-w-shell flex-col gap-4 px-4 py-4 sm:px-[30px]">
            {enlaces.map(({ texto, to }) => (
              <Link key={texto} to={to} onClick={() => setAbierto(false)} className={claseEnlace(to)}>
                {texto}
              </Link>
            ))}

            {!user && (
              <Link
                to="/login"
                onClick={() => setAbierto(false)}
                className={`${baseLink} ${transparente ? 'text-white' : 'text-primary'}`}
              >
                Iniciar sesión
              </Link>
            )}

            {user && (
              <button type="button" onClick={cerrarSesion} className={`${baseLink} ${inactivo} self-start inline-flex items-center gap-2`}>
                <LogOut size={18} aria-hidden="true" /> Cerrar sesión ({nombre})
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export default Navbar
