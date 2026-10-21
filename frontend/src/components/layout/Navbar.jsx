import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, LogOut, UserRound, Bus, ChevronDown } from 'lucide-react'
import ThemeToggle from '../common/ThemeToggle'
import { useAuth } from '../../context/useAuth.js'

const Navbar = () => {
  const { pathname } = useLocation()
  const [desplazado, setDesplazado] = useState(false)
  const transparente = pathname === '/' && !desplazado
  const [abierto, setAbierto] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const alDesplazar = () => setDesplazado(window.scrollY > 40)
    alDesplazar()
    window.addEventListener('scroll', alDesplazar, { passive: true })
    return () => window.removeEventListener('scroll', alDesplazar)
  }, [])

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
    { texto: 'Servicios', to: '/#servicios', submenu: true },
    { texto: 'Nosotros', to: '/nosotros' },
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
  const botonBase =
    'inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'

  // Inicio transparente sobre el hero
  const linkHomeInactivo = `${botonBase} border-white/40 text-white hover:border-white hover:bg-white/10 hover:backdrop-blur-md hover:shadow-[0_0_18px_rgba(255,255,255,0.18)] focus-visible:border-white focus-visible:bg-white/10 focus-visible:ring-white/60`
  const linkHomeActivo = `${botonBase} border-white bg-white/15 text-white backdrop-blur-md shadow-[0_0_18px_rgba(255,255,255,0.18)]`

  // Rutas, Servicios, Nosotros y navbar sólida
  const linkSeccionInactivo = `${botonBase} border-line text-navy hover:border-orange-500 hover:bg-orange-500/15 hover:text-orange-600 hover:backdrop-blur-md hover:shadow-[0_0_18px_rgba(249,115,22,0.22)] focus-visible:border-orange-500 focus-visible:bg-orange-500/15 focus-visible:text-orange-600 focus-visible:ring-orange-500/60 dark:border-stone-700 dark:text-white dark:hover:border-orange-400 dark:hover:bg-orange-500/15 dark:hover:text-orange-300 dark:focus-visible:border-orange-400 dark:focus-visible:bg-orange-500/15 dark:focus-visible:text-orange-300`
  const linkSeccionActivo = `${botonBase} border-orange-500 bg-orange-500/15 text-orange-600 backdrop-blur-md shadow-[0_0_18px_rgba(249,115,22,0.22)] dark:border-orange-400 dark:bg-orange-500/15 dark:text-orange-300`

  const claseEnlace = (to) => {
    const esActivo = to === pathname && !to.includes('#')
    if (transparente) return esActivo ? linkHomeActivo : linkHomeInactivo
    return esActivo ? linkSeccionActivo : linkSeccionInactivo
  }

  return (
    <header
      className={
        transparente
          ? 'fixed inset-x-0 top-0 z-50 bg-transparent'
          : 'fixed inset-x-0 top-0 z-50 border-b border-line bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95'
      }
    >
      <div className="mx-auto flex h-20 max-w-shell items-center gap-6 px-4 sm:px-[30px]">
        <Link
          to="/"
          aria-label="LUX - Líneas Únicas Xpress - Inicio"
          className={`flex shrink-0 items-center gap-2.5 leading-none ${
            transparente ? 'text-white' : 'text-navy dark:text-white'
          }`}
        >
          <Bus size={32} strokeWidth={2.2} aria-hidden="true" />
          <span className="flex flex-col">
            <span className="text-2xl font-black tracking-tight sm:text-3xl">LUX</span>
            <span className={`mt-1 text-xs font-semibold uppercase tracking-wider ${transparente ? 'text-orange-400' : 'text-orange-500'}`}>
              Líneas Únicas Xpress
            </span>
          </span>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-3 lg:flex" aria-label="Navegación principal">
          {enlaces.map(({ texto, to, submenu }) => (
            <Link key={texto} to={to} className={claseEnlace(to)}>
              {texto}
              {submenu && <ChevronDown className="h-4 w-4" aria-hidden="true" />}
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
                  ? 'border-orange-500 bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white'
                  : 'border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white'
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
                  ? 'border-white/50 text-white hover:bg-white hover:text-primary'
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
            className={`inline-flex size-10 items-center justify-center rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:hidden ${
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
        <div className={`border-b lg:hidden ${transparente ? 'bg-primary-dark text-white' : 'border-line bg-white dark:border-stone-800 dark:bg-stone-900'}`}>
          <div className="mx-auto flex max-w-shell flex-col items-start gap-3 px-4 py-4 sm:px-[30px]">
            {enlaces.map(({ texto, to, submenu }) => (
              <Link key={texto} to={to} onClick={() => setAbierto(false)} className={claseEnlace(to)}>
                {texto}
                {submenu && <ChevronDown className="h-4 w-4" aria-hidden="true" />}
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
              <button type="button" onClick={cerrarSesion} className={`${baseLink} ${transparente ? 'text-white' : 'text-navy dark:text-neutral-200'} self-start inline-flex items-center gap-2`}>
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
