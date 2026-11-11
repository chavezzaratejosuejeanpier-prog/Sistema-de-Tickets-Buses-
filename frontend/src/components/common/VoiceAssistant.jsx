import { useState, useEffect } from 'react'
import { Mic, MicOff, Speaker, Send } from 'lucide-react'
import { useVoice } from './useVoice.js'

/**
 * Asistente de voz conversacional simple (no J.A.R.V.I.S.).
 * Tono amable, educado, breve. Llama "señor" al usuario.
 * Estados: escuchando, hablando, pensando, inactivo.
 */
export default function VoiceAssistant({ className = '' }) {
  const {
    estado,
    resultado,
    startListening,
    stopListening,
    stopSpeaking,
    responder,
    soportado,
    setResultado,
  } = useVoice()
  const [textoEscrito, setTextoEscrito] = useState('')
  const [historial, setHistorial] = useState([])

  // Cerebro simple: respuestas predefinidas por palabras clave
  useEffect(() => {
    if (!resultado) return

    const texto = resultado.toLowerCase()
    let reply = ''

    if (
      texto.includes('hola') ||
      texto.includes('buenos días') ||
      texto.includes('buenas tardes') ||
      texto.includes('buenas noches')
    ) {
      reply = 'Hola, señor. En qué le puedo ayudar hoy.'
    } else if (texto.includes('buscar') || texto.includes('viaje') || texto.includes('ruta')) {
      reply = 'Le llevo al buscador de viajes. Dígame origen y destino, señor.'
    } else if (texto.includes('hora')) {
      const ahora = new Date().toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
      })
      reply = `Son las ${ahora}, señor.`
    } else if (texto.includes('ayuda')) {
      reply = 'Puedo buscarle viajes, decirle la hora o leerle su boleto. Dígame qué necesita, señor.'
    } else if (texto.includes('boleto') || texto.includes('pasaje')) {
      reply = 'Consulte Mis Pasajes con su código de reserva para leerle el boleto, señor.'
    } else if (texto.includes('gracias')) {
      reply = 'A su servicio, señor. Buen viaje.'
    } else {
      reply = 'No entendí bien, señor. Puede repetirlo o decirme ayuda.'
    }

    setHistorial((prev) => [...prev, { tipo: 'usuario', texto: resultado }])
    responder(reply)
    setHistorial((prev) => [...prev, { tipo: 'asistente', texto: reply }])
    setResultado('')
  }, [resultado, responder, setResultado])

  const enviarTexto = () => {
    const t = textoEscrito.trim()
    if (!t) return
    setHistorial((prev) => [...prev, { tipo: 'usuario', texto: t }])
    responder(t)
    setTextoEscrito('')
  }

  if (!soportado) {
    return (
      <button
        type="button"
        disabled
        title="Asistente de voz no soportado en este navegador"
        className={`fixed bottom-4 right-4 z-[95] w-12 h-12 rounded-full border border-line dark:border-stone-700 bg-stone-200 dark:bg-stone-800 text-stone-500 dark:text-stone-400 shadow-soft opacity-50 cursor-not-allowed transition-colors ${className}`}
      >
        <MicOff size={20} />
      </button>
    )
  }

  const estaActivo = estado === 'listening' || estado === 'speaking' || estado === 'processing'

  return (
    <div className={`fixed bottom-4 right-4 z-[95] flex flex-col items-end gap-2 ${className}`}>
      {/* Panel de chat */}
      <div
        className={`w-80 max-w-xs rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
          historial.length === 0 && estado === 'idle'
            ? 'opacity-0 pointer-events-none -translate-y-4'
            : 'opacity-100 pointer-events-auto translate-y-0'
        }`}
      >
        <div className="p-3 border-b border-line dark:border-stone-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                estado === 'speaking'
                  ? 'bg-green-500 animate-pulse'
                  : estado === 'listening'
                    ? 'bg-orange-500 animate-pulse'
                    : 'bg-stone-400'
              }`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
              LUX Asistente
            </span>
          </div>
          <button
            onClick={() => setHistorial([])}
            className="text-xs text-muted hover:text-red-600 dark:hover:text-red-400"
          >
            Borrar
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {historial.map((m, i) => (
            <div key={i} className={`flex ${m.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] p-2 rounded-xl text-sm ${
                  m.tipo === 'usuario'
                    ? 'bg-primary text-white rounded-tr-none'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-tl-none'
                }`}
              >
                {m.texto}
              </div>
            </div>
          ))}
          {estado === 'listening' && (
            <div className="flex justify-start">
              <div className="bg-stone-100 dark:bg-stone-800 p-2 rounded-xl text-stone-800 dark:text-stone-200 text-sm rounded-tl-none">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-medium">Escuchando...</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="p-3 border-t border-line dark:border-stone-700 flex gap-2">
          <input
            value={textoEscrito}
            onChange={(e) => setTextoEscrito(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enviarTexto()}
            placeholder="Escribe al asistente..."
            className="flex-1 px-3 py-2 rounded-lg border border-line dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
          <button onClick={enviarTexto} className="p-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors">
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Botón flotante principal */}
      <button
        type="button"
        onClick={() => {
          if (estado === 'listening') stopListening()
          else if (estado === 'speaking') stopSpeaking()
          else startListening()
        }}
        title={
          estado === 'listening'
            ? 'Dejar de escuchar'
            : estado === 'speaking'
              ? 'Detener voz'
              : 'Hablar con el asistente'
        }
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 transform ${estaActivo ? 'scale-105' : ''} ${
          estado === 'listening'
            ? 'bg-orange-500 text-white animate-pulse'
            : estado === 'speaking'
              ? 'bg-green-500 text-white animate-pulse'
              : 'bg-white dark:bg-stone-800 border border-line dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 shadow-soft'
        }`}
      >
        {estado === 'listening' ? (
          <MicOff size={24} className="animate-ping" />
        ) : estado === 'speaking' ? (
          <Speaker size={24} className="animate-ping" />
        ) : (
          <Mic size={24} />
        )}
      </button>

      <span
        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-line dark:border-stone-700 shadow-sm ${
          estaActivo ? 'block' : 'hidden'
        }`}
      >
        {estado === 'listening' ? 'Escuchando' : estado === 'speaking' ? 'Hablando' : 'Pensando'}
      </span>
    </div>
  )
}