/* eslint-disable no-undef */
import { useEffect, useState } from 'react'

/**
 * Detecta la luz ambiental del entorno si el navegador soporta
 * AmbientLightSensor y ajusta automáticamente el tema.
 */
export function useAmbientLightTheme() {
  const [sensorDetectado, setSensorDetectado] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('AmbientLightSensor' in window)) return

    let sensor
    try {
      sensor = new AmbientLightSensor({ frequency: 1 })
      sensor.onreading = () => {
        const root = document.documentElement
        const lux = sensor.illuminance
        // Menos de 30 lux = entorno oscuro, activar dark mode
        // Más de 300 lux = entorno claro, activar light mode
        if (lux < 30) {
          root.classList.add('ambient-dark')
          root.classList.remove('ambient-light')
        } else if (lux > 300) {
          root.classList.add('ambient-light')
          root.classList.remove('ambient-dark')
        } else {
          root.classList.remove('ambient-dark', 'ambient-light')
        }
      }
      sensor.onerror = () => setSensorDetectado(false)
      sensor.start()
      setSensorDetectado(true)
    } catch {
      setSensorDetectado(false)
    }

    return () => {
      try { sensor?.stop() } catch {}
    }
  }, [])

  return { sensorDetectado }
}