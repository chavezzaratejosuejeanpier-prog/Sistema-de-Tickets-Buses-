export default function BoletoTermico({
  codigoReserva,
  origen,
  destino,
  fecha,
  hora,
  asiento,
  precio,
  busPlaca,
  pdfUrl,
  onImprimir,
}) {
  return (
    <div className="max-w-md mx-auto p-4">
      {/* Boleto tipo ticket térmico */}
      <div
        className="relative w-full max-w-xs border-4 border-black rounded-none bg-white shadow-2xl overflow-hidden"
        style={{ borderImage: 'repeating-linear-gradient(0deg, #000, #000 5px, transparent 5px, transparent 10px) 1' }}
      >
        {/* Línea perforada superior */}
        <div className="h-1 bg-black flex items-center justify-center" />
        
        <div className="p-4 text-black">
          {/* Encabezado */}
          <div className="flex justify-between items-start mb-3">
            <div>
              <h1 className="text-xs font-mono font-bold tracking-widest uppercase">LUX</h1>
              <p className="text-[10px] font-mono text-stone-600">Líneas Únicas Xpress</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-stone-600 block">BOLETO DIGITAL</span>
              <span className="text-[10px] font-mono text-stone-600 block">#{codigoReserva}</span>
            </div>
          </div>

          <hr className="border-black/30 my-2" />

          {/* Ruta */}
          <div className="mb-3">
            <p className="text-[10px] font-mono text-stone-600 uppercase mb-1">Ruta</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{origen}</span>
              <span className="text-xs font-mono text-stone-400">→</span>
              <span className="text-sm font-bold">{destino}</span>
            </div>
          </div>

          {/* Fecha y hora */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-[10px] font-mono text-stone-600 uppercase mb-1">Fecha</p>
              <span className="text-sm font-mono">{fecha}</span>
            </div>
            <div>
              <p className="text-[10px] font-mono text-stone-600 uppercase mb-1">Hora</p>
              <span className="text-sm font-mono">{hora}</span>
            </div>
          </div>

          {/* Asiento y bus */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-[10px] font-mono text-stone-600 uppercase mb-1">Asiento</p>
              <span className="text-sm font-bold font-mono">{asiento}</span>
            </div>
            <div>
              <p className="text-[10px] font-mono text-stone-600 uppercase mb-1">Bus</p>
              <span className="text-sm font-mono">{busPlaca}</span>
            </div>
          </div>

          {/* Precio */}
          <div className="mb-3 border-t border-black/30 pt-2">
            <p className="text-[10px] font-mono text-stone-600 uppercase mb-1">Total</p>
            <span className="text-lg font-bold">S/ {Number(precio).toFixed(2)}</span>
          </div>

          <hr className="border-black/30 my-2" />

          {/* Código de barras simulado */}
          <div className="flex items-center justify-center mb-2">
            <div className="w-full h-6 bg-black flex">
              {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map((_, i) => (
                <div key={i} className={`w-1 h-full ${i % 2 === 0 ? 'bg-white' : ''}`} />
              ))}
            </div>
          </div>
          <span className="text-[10px] font-mono text-center block">{codigoReserva}</span>

          {/* Pie de página */}
          <p className="text-[9px] font-mono text-stone-500 text-center mt-3">
            Guarde este código para consultar su viaje.
          </p>
          <p className="text-[9px] font-mono text-stone-500 text-center">
            LUX - Líneas Únicas Xpress
          </p>
        </div>

        {/* Línea perforada inferior */}
        <div className="h-1 bg-black flex items-center justify-center" />
      </div>

      {/* Acciones */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onImprimir}
          className="flex-1 btn-outline"
        >
          <span className="flex items-center gap-1">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 17v2a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h8l4 4z" />
              <path d="M9 9h.01M12 12h.01M15 15h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Imprimir
          </span>
        </button>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 btn-primary text-center"
          >
            Descargar PDF
          </a>
        )}
      </div>
    </div>
  )
}