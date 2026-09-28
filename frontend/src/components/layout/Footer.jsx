import React from 'react'

const ENLACES = ['Términos del Servicio', 'Política de Privacidad', 'Política de Equipaje', 'Contactar Soporte']

const Footer = () => (
  <footer className="w-full bg-footer py-10">
    <div className="max-w-shell mx-auto px-4 sm:px-[30px] flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
      <span className="text-[28px] font-bold text-white">BUSS ConnectPro</span>

      <nav className="flex flex-wrap justify-center gap-6" aria-label="Enlaces del pie de página">
        {ENLACES.map(texto => (
          <a
            key={texto}
            href="#"
            onClick={(e) => e.preventDefault()}
            className="text-[15px] font-medium text-footerLink hover:text-white transition-colors"
          >
            {texto}
          </a>
        ))}
      </nav>

      <p className="text-sm text-slate-300">&copy; 2024 BUSS ConnectPro S.A. Todos los derechos reservados.</p>
    </div>
  </footer>
)

export default Footer
