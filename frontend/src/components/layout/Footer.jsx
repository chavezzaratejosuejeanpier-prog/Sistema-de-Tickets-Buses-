import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary text-slate-300 py-8 mt-auto border-t-4 border-accent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">

        <div className="text-center md:text-left">
          <h3 className="text-lg font-bold text-white mb-1">BUSS ConectPro</h3>
          <p className="text-sm text-slate-400">Sistema moderno de gestión y reserva de pasajes.</p>
        </div>

        <nav className="flex gap-6 text-sm font-medium" aria-label="Enlaces del pie de página">
          <Link to="/" className="hover:text-accent transition-colors">Inicio</Link>
          <Link to="/buscar" className="hover:text-accent transition-colors">Buscar Viaje</Link>
          <Link to="/login" className="hover:text-accent transition-colors">Acceso</Link>
        </nav>

      </div>

      <div className="text-center text-xs text-slate-500 mt-8 pt-4 border-t border-white/10">
        &copy; {currentYear} BUSS ConectPro. Todos los derechos reservados.
      </div>
    </footer>
  );
};

export default Footer;
