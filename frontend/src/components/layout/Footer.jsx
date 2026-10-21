const ENLACES = ['Términos del Servicio', 'Política de Privacidad', 'Política de Equipaje', 'Contactar Soporte']
const ANIO = new Date().getFullYear()

const Footer = () => (
  <footer className="w-full bg-footer py-10">
    <div className="max-w-shell mx-auto px-4 sm:px-[30px] flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
      <span className="flex flex-col items-center md:items-start">
        <span className="text-3xl font-black tracking-tight text-white">LUX</span>
        <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-primary-light">Líneas Únicas Xpress</span>
      </span>

      <nav className="flex flex-wrap justify-center gap-6" aria-label="Enlaces del pie de página">
        {ENLACES.map(texto => (
          <span
            key={texto}
            title="Disponible próximamente"
            className="cursor-not-allowed text-sm font-medium text-footerLink transition-colors hover:text-white"
          >
            {texto}
          </span>
        ))}
      </nav>

      <p className="text-sm text-slate-300">&copy; {ANIO} LUX - Líneas Únicas Xpress S.A. Todos los derechos reservados.</p>
    </div>
  </footer>
)

export default Footer
