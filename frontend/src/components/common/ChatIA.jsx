import { useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'

const RESPUESTAS = {
  hola: 'Hola, señor. Soy el asistente de LUX. ¿En qué le puedo ayudar?',
  buscar: 'Para buscar viajes, indique origen, destino y fecha en el formulario principal.',
  precio: 'Los precios varían según la ruta y la fecha. Use el buscador para ver tarifas en tiempo real.',
  ayuda: 'Puedo ayudarle a encontrar rutas, consultar horarios o explicar cómo reservar asientos.',
  default: 'No estoy seguro de entender eso, señor. Puede decirme "buscar", "precio" o "ayuda".',
}

export default function ChatIA() {
  const [mensajes, setMensajes] = useState([
    { tipo: 'asistente', texto: 'Hola, señor. Soy el asistente de LUX. ¿En qué puedo ayudarle hoy?' },
  ])
  const [input, setInput] = useState('')

  const responder = (texto) => {
    const t = texto.toLowerCase()
    let respuesta = RESPUESTAS.default
    if (t.includes('hola')) respuesta = RESPUESTAS.hola
    else if (t.includes('buscar') || t.includes('viaje')) respuesta = RESPUESTAS.buscar
    else if (t.includes('precio') || t.includes('costo')) respuesta = RESPUESTAS.precio
    else if (t.includes('ayuda')) respuesta = RESPUESTAS.ayuda

    setMensajes((prev) => [...prev, { tipo: 'usuario', texto }])
    setTimeout(() => {
      setMensajes((prev) => [...prev, { tipo: 'asistente', texto: respuesta }])
    }, 800)
  }

  return (
    <div className="rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900 shadow-lg overflow-hidden flex flex-col h-[500px]">
      <div className="p-3 border-b border-line dark:border-stone-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-primary" />
          <span className="text-sm font-bold text-navy dark:text-white">Asistente LUX</span>
        </div>
        <span className="text-[10px] text-stone-500">Beta</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mensajes.map((m, i) => (
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
      </div>
      <div className="p-3 border-t border-line dark:border-stone-700 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Enter' && input.trim() && (responder(input), setInput(''))
          }
          placeholder="Escribe al asistente..."
          className="flex-1 px-3 py-2 rounded-lg border border-line dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        />
        <button
          onClick={() => input.trim() && (responder(input), setInput(''))}
          className="p-2 rounded-lg bg-primary text-white hover:bg-primary-dark transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}