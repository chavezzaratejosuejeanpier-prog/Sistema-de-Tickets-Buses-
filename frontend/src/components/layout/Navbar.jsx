import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="bg-blue-900 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logotipo y Nombre */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <span className="text-2xl"></span>
            <Link to="/" className="font-extrabold text-xl tracking-tight hover:text-blue-200 transition-colors">
              BUSS ConectPro
            </Link>
          </div>

          {/* Botón de retroceso dinámico (solo se muestra si no está en el inicio) */}
          <div className="flex items-center">
            {location.pathname !== '/' && (
              <Link 
                to="/" 
                className="text-sm font-semibold bg-blue-800 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors border border-blue-700"
              >
                ← Volver al inicio
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;