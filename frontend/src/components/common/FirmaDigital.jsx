import { useRef, useState, useCallback } from 'react'

/**
 * Firma digital con Canvas. El usuario dibuja su firma con mouse o dedo.
 * Devuelve la imagen en base64 y un booleano de firmado.
 */
export default function FirmaDigital({ onFirmaCambio }) {
  const canvasRef = useRef(null)
  const [dibujando, setDibujando] = useState(false)
  const [firmado, setFirmado] = useState(false)

  const empezar = useCallback((e) => {
    setDibujando(true)
    setFirmado(true)
    const ctx = canvasRef.current.getContext('2d')
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
    if (onFirmaCambio) onFirmaCambio(true)
  }, [onFirmaCambio])

  const dibujar = useCallback((e) => {
    if (!dibujando) return
    const ctx = canvasRef.current.getContext('2d')
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.lineTo(x, y)
    ctx.stroke()
  }, [dibujando])

  const terminar = useCallback(() => {
    setDibujando(false)
  }, [])

  const limpiar = useCallback(() => {
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    setFirmado(false)
    if (onFirmaCambio) onFirmaCambio(false)
  }, [onFirmaCambio])

  useEffectMount(canvasRef)

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
        Firma del pasajero
      </p>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={300}
          height={120}
          className="border border-line dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 cursor-crosshair touch-action-none"
          onMouseDown={empezar}
          onMouseMove={dibujar}
          onMouseUp={terminar}
          onMouseLeave={terminar}
          onTouchStart={(e) => { e.preventDefault(); empezar(e) }}
          onTouchMove={(e) => { e.preventDefault(); dibujar(e) }}
          onTouchEnd={terminar}
        />
        {!firmado && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-50">
            <span className="text-[10px] text-stone-500 dark:text-stone-600 font-medium">Dibuja tu firma aquí</span>
          </div>
        )}
      </div>
      {firmado && (
        <button
          onClick={limpiar}
          className="text-[10px] text-red-600 dark:text-red-400 hover:underline"
        >
          Limpiar firma
        </button>
      )}
    </div>
  )
}

function useEffectMount(ref) {
  // Se ejecuta al montar para configurar el contexto del canvas
  const ctx = ref.current?.getContext('2d')
  if (ctx) {
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#000000'
  }
}