import { ShieldCheck, Armchair, Wifi } from 'lucide-react'

const BENEFICIOS = [
  { Icono: ShieldCheck, titulo: 'Seguridad 24/7', texto: 'Monitoreo GPS en toda nuestra flota para garantizar un viaje tranquilo.' },
  { Icono: Armchair, titulo: 'Máximo Confort', texto: 'Asientos reclinables hasta 160° con servicio a bordo en rutas largas.' },
  { Icono: Wifi, titulo: 'Conectividad', texto: 'Wi-Fi disponible y conectores USB en todos nuestros buses modernos.' },
]

export default function Benefits() {
  return (
    <div>
      <h2 className="mb-6 text-3xl font-extrabold text-navy dark:text-white sm:text-4xl">Nuestros Beneficios</h2>

      {/* flex-1: las 3 tarjetas reparten la altura de la columna y quedan a la par de las de rutas */}
      <div className="flex h-full flex-col gap-5">
        {BENEFICIOS.map(({ Icono, titulo, texto }) => (
          <div key={titulo} className="card flex flex-1 items-center gap-4 p-6">
            <span className="flex size-[50px] shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icono size={24} />
            </span>
            <div>
              <h3 className="text-2xl font-semibold text-navy dark:text-white">{titulo}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted dark:text-stone-400">{texto}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
