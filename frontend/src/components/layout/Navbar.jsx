import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const links = [
  { to: '/', label: 'Inicio' },
  { to: '/buscar', label: 'Buscar Viaje' },
  { to: '/login', label: 'Acceso' },
];

const Navbar = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
      isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <nav className="bg-primary text-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex-shrink-0 flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🚌</span>
            <span className="font-extrabold text-xl tracking-tight">BUSS ConectPro</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
            {location.pathname !== '/' && (
              <Link
                to="/"
                className="ml-2 text-sm font-semibold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors border border-white/15"
              >
                ← Volver
              </Link>
            )}
          </div>

          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Abrir menú"
            aria-expanded={open}
            onClick={() => setOpen(v => !v)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {open
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-primary border-t border-white/10 px-4 pb-4 pt-2 flex flex-col gap-1">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={linkClass} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
          {location.pathname !== '/' && (
            <Link to="/" className="px-3 py-2 rounded-lg text-sm font-semibold text-white/80 hover:bg-white/10" onClick={() => setOpen(false)}>
              ← Volver al inicio
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;