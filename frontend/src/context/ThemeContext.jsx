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
    root.classList.remove('dark', 'hc', 'night-mode')
    if (theme === 'dark' || theme === 'hc') root.classList.add('dark')
    if (theme === 'hc') root.classList.add('hc')

    // Modo nocturno automático: 20:00 - 06:00
    const hora = new Date().getHours()
    const esNoche = hora >= 20 || hora < 6
    if (esNoche && theme === 'dark') root.classList.add('night-mode')

    // Inyectar estrellas y luna solo en modo noche
    const existing = document.getElementById('lux-stars')
    if (esNoche && theme === 'dark' && !existing) {
      const estrellas = document.createElement('div')
      estrellas.id = 'lux-stars'
      estrellas.className = 'stars'
      for (let i = 0; i < 60; i++) {
        const star = document.createElement('div')
        star.className = 'star'
        star.style.left = `${Math.random() * 100}%`
        star.style.top = `${Math.random() * 100}%`
        star.style.width = `${Math.random() * 2 + 1}px`
        star.style.height = star.style.width
        star.style.animationDelay = `${Math.random() * 4}s`
        estrellas.appendChild(star)
      }
      const moon = document.createElement('div')
      moon.className = 'moon'
      moon.style.left = '85%'
      moon.style.top = '8%'
      estrellas.appendChild(moon)
      root.appendChild(estrellas)
    }
    if ((!esNoche || theme !== 'dark') && existing) {
      existing.remove()
    }

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