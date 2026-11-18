import { toast } from 'sonner'

export default function NotificacionesElegantes() {

  return (
    <div>
      <button
        onClick={() =>
          toast.success('Compra confirmada', {
            description: 'Su boleto está listo para descargar',
            richColors: true,
          })
        }
        className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm hover:bg-green-600 transition-colors"
      >
        Notificación Éxito
      </button>
      <button
        onClick={() =>
          toast.error('Error de conexión', {
            description: 'Verifique que el backend esté activo',
            richColors: true,
          })
        }
        className="ml-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600 transition-colors"
      >
        Notificación Error
      </button>
      <button
        onClick={() =>
          toast.info('Nueva ruta disponible', {
            description: 'Lima → Arequipa ahora tiene horarios nocturnos',
            richColors: true,
          })
        }
        className="ml-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors"
      >
        Notificación Info
      </button>
    </div>
  )
}