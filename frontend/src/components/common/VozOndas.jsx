/* eslint-disable no-undef */
/**
 * Interfaz de ondas de voz visual (sin asistente, solo decorativa).
 * Reacciona al micrófono si el usuario lo permite, o simula movimiento.
 */
import { useState, useEffect, useRef } from 'react'

export default function VozOndas() {
  const [activo, setActivo] = useState(false)
  const [niveles, setNiveles] = useState([20, 40, 60, 40, 20])
  const animRef = useRef(null)

  useEffect(() => {
    if (!activo) return

    const simular = () => {
      setNiveles(() => Array.from({ length: 5 }, () => Math.floor(Math.random() * 80) + 20))
      animRef.current = window.requestAnimationFrame(simular)
    }
    animRef.current = window.requestAnimationFrame(simular)
    return () => window.cancelAnimationFrame(animRef.current)
  }, [activo])

  const activarMicrofono = async () => {
    try {
      const stream = await window.navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const fuente = ctx.createMediaStreamSource(stream)
      const analizador = ctx.createAnalyser()
      fuente.connect(analizador)
      analizador.fftSize = 256
      const buffer = new Uint8Array(analizador.frequencyBinCount)

      const leer = () => {
        analizador.getByteFrequencyData(buffer)
        setNiveles(Array.from(buffer.slice(0, 5)).map(v => Math.max(20, Math.min(100, v / 2.5))))
        animRef.current = requestAnimationFrame(leer)
      }
      leer()

      return () => {
        window.cancelAnimationFrame(animRef.current)
        stream.getTracks().forEach(t => t.stop())
        ctx.close()
      }
    } catch {
      setActivo(true)
    }
  }

  return (
    <div className="flex items-center gap-2 bg-white dark:bg-stone-800 rounded-xl p-3 border border-line dark:border-stone-700 shadow-soft">
      <button
        onClick={() => {
          setActivo(!activo)
          if (activo) activarMicrofono()
        }}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${activo ? 'bg-primary text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-400 hover:bg-primary hover:text-white'}`}
        aria-label={activo ? 'Detener micrófono' : 'Activar micrófono'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.5 14a-.5.5 0 0 1-.5.5h-2a-.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5zM19 18H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 3h4l2-3h4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z" />
        </svg>
      </button>
      <div className="flex h-8 items-end gap-1">
        {niveles.map((n, i) => (
          <div
            key={i}
            className={`w-1.5 bg-primary transition-all duration-100 rounded-t-sm ${activo ? 'animate-[pico_0.5s_ease-in-out_infinite]' : ''}`}
            style={{ height: `${n}%`, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  )
}