/**
 * Tipografía animada por letra (máquina de escribir).
 */
import { useState } from 'react'

export default function MaquinaEscribir({ texto, velocidad = 50 }) {
  const [mostrado, setMostrado] = useState('')
  const [index, setIndex] = useState(0)

  const escribir = () => {
    if (index < texto.length) {
      setMostrado(texto.slice(0, index + 1))
      setIndex(index + 1)
      setTimeout(escribir, velocidad)
    }
  }

  const reiniciar = () => {
    setMostrado('')
    setIndex(0)
    escribir()
  }

  const reiniciarRef = { current: reiniciar }

  return (
    <span className="font-mono text-navy dark:text-white border-r-2 border-primary animate-ping" onAnimationEnd={reiniciarRef.current}>
      {mostrado}
    </span>
  )
}