export default function BoletoColeccionable({ codigo, ruta, fecha, asiento, numeroSerie }) {
  return (
    <div className="relative w-full max-w-md mx-auto p-4">
      <div className="relative h-64 rounded-2xl border-4 border-yellow-400 bg-gradient-to-b from-yellow-50 to-white shadow-2xl overflow-hidden">
        <div className="absolute inset-0 border-2 border-yellow-300 rounded-2xl pointer-events-none" />

        <div className="p-4 h-full flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-xs font-black uppercase tracking-widest text-yellow-700">LUX</h1>
              <p className="text-[10px] font-mono text-stone-600">COLECCIÓN 2026</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-stone-500 block">Serie: {numeroSerie}</span>
              <span className="text-xs font-bold text-yellow-700 block">COLECCIONABLE</span>
            </div>
          </div>

          <hr className="border-yellow-200 mb-3" />

          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono text-stone-500 uppercase">Ruta</span>
            <span className="text-sm font-bold text-stone-800">{ruta}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-[10px] font-mono text-stone-500 uppercase">Fecha</p>
              <span className="text-xs font-mono text-stone-700">{fecha}</span>
            </div>
            <div>
              <p className="text-[10px] font-mono text-stone-500 uppercase">Asiento</p>
              <span className="text-xs font-bold text-yellow-700">{asiento}</span>
            </div>
          </div>

          <div className="relative h-20 w-20 mx-auto mb-4 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-yellow-500/30 animate-ping" />
            <div className="relative z-10 rounded-full border-2 border-yellow-500 bg-white/90 p-1 flex items-center justify-center">
              <span className="text-[8px] font-black text-yellow-700">✦</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-yellow-100">
            <span className="text-[10px] font-mono text-stone-500">Código</span>
            <span className="text-xs font-mono font-bold text-stone-800 tracking-widest">{codigo}</span>
          </div>
        </div>
      </div>
    </div>
  )
}