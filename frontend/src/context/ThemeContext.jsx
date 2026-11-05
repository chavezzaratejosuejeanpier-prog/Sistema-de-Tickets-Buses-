import { useEffect, useState } from 'react'
import { ThemeContext } from './theme-context.js'

const CICLO = ['light', 'dark', 'hc']

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (CICLO.includes(saved)) return saved
    return 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'hc')
    if (theme === 'dark' || theme === 'hc') root.classList.add('dark')
    if (theme === 'hc') root.classList.add('hc')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => CICLO[(CICLO.indexOf(t) + 1) % CICLO.length])
  const isDark = theme !== 'light'

  return (
    <ThemeContext.Provider value={{ theme, toggle, isDark, isHc: theme === 'hc' }}>
      {children}
    </ThemeContext.Provider>
  )
}