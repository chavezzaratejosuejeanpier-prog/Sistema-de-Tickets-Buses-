import React, { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

const ENLACES = [
  { texto: 'Mis Pasajes', to: null },
  { texto: 'Acceso Admin', to: '/dashboard' },
]

const enlaceClass = 'text-[18px] font-medium text-navy-light hover:text-primary transition-colors'

const Navbar = () => {
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    const alCambiarTamano = () => window.innerWidth >= 768 && setAbierto(false)
    window.addEventListener('resize', alCambiarTamano)
    return () => window.removeEventListener('resize', alCambiarTamano)
  }, [])

  return (
    <nav className="sticky top-0 z-50 h-20 bg-white border-b border-line">
      <div className="max-w-shell mx-auto px-4 sm:px-[30px] h-full flex items-center justify-between">
        <Link to="/" className="text-[36px] font-bold text-navy leading-none shrink-0" aria-label="BUSS ConnectPro - Inicio">
          BUSS ConnectPro
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {ENLACES.map(({ texto, to }) =>
            to ? (
              <NavLink key={texto} to={to} className={enlaceClass}>
                {texto}
              </NavLink>
            ) : (
              <a key={texto} href="#" className={enlaceClass} onClick={(e) => e.preventDefault()}>
                {texto}
              </a>
            )
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="hidden md:inline-flex rounded-lg bg-slate-100 px-[18px] py-2.5 text-[15px] font-semibold text-navy transition-colors hover:bg-slate-200"
            aria-label="Moneda: soles peruanos"
          >
            PEN (S/.)
          </button>

          <button
            type="button"
            onClick={() => setAbierto(o => !o)}
            aria-expanded={abierto}
            aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-line text-navy"
          >
            {abierto ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {abierto && (
        <div className="md:hidden bg-white border-b border-line">
          <div className="max-w-shell mx-auto px-4 py-4 flex flex-col gap-4">
            {ENLACES.map(({ texto, to }) =>
              to ? (
                <NavLink key={texto} to={to} onClick={() => setAbierto(false)} className={enlaceClass}>
                  {texto}
                </NavLink>
              ) : (
                <a key={texto} href="#" onClick={(e) => e.preventDefault()} className={enlaceClass}>
                  {texto}
                </a>
              )
            )}
            <span className="self-start rounded-lg bg-slate-100 px-[18px] py-2.5 text-[15px] font-semibold text-navy">
              PEN (S/.)
            </span>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
