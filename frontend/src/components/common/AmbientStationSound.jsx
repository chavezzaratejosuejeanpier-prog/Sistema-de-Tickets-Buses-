import { useEffect, useState } from 'react'

/**
 * Sonido ambiental suave de estación de buses.
 * Se reproduce en bucle a volumen muy bajo al montar la app.
 */
const AudioContext = window.AudioContext || window.webkitAudioContext

export default function AmbientStationSound({ activo = true }) {
  const [iniciado, setIniciado] = useState(false)

  useEffect(() => {
    if (!activo || !AudioContext) return

    const ctx = new AudioContext()

    // Osciladores muy sutiles para crear un "zumbido" de estación
    const oscilador1 = ctx.createOscillator()
    const oscilador2 = ctx.createOscillator()
    const gain = ctx.createGain()

    oscilador1.type = 'sine'
    oscilador1.frequency.setValueAtTime(110, ctx.currentTime) // A2
    oscilador2.type = 'sine'
    oscilador2.frequency.setValueAtTime(220, ctx.currentTime) // A3

    gain.gain.setValueAtTime(0.015, ctx.currentTime) // volumen muy bajo

    oscilador1.connect(gain)
    oscilador2.connect(gain)
    gain.connect(ctx.destination)

    oscilador1.start()
    oscilador2.start()

    return () => {
      oscilador1.stop()
      oscilador2.stop()
      ctx.close()
    }
  }, [activo])

  const activarAudio = () => {
    if (!iniciado) setIniciado(true)
  }

  return (
    <div
      aria-hidden="true"
      onClick={activarAudio}
      onTouchStart={activarAudio}
      style={{ position: 'fixed', bottom: 0, left: 0, width: 0, height: 0, overflow: 'hidden' }}
    />
  )
}