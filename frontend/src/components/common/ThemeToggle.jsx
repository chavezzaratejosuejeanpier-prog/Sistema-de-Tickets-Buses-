import { useTheme } from '../../context/useTheme.js'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const etiqueta = theme === 'light' ? 'Modo oscuro' : theme === 'dark' ? 'Modo alto contraste' : 'Modo claro'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Activar ${etiqueta.toLowerCase()}`}
      title={etiqueta}
      className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark ${
        theme === 'light'
          ? 'bg-white border-black/10 text-navy hover:bg-stone-100 shadow-soft'
          : 'bg-white/10 border-white/20 text-white hover:bg-white hover:text-navy'
      } ${className}`}
    >
      {theme === 'light' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
      {theme === 'dark' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
      {theme === 'hc' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18" />
        </svg>
      )}
    </button>
  )
}