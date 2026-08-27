import React from 'react'

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary text-white px-6 py-4 flex justify-between items-center shadow">
        <span className="text-xl font-bold tracking-wide">BUSS<span className="text-accent"> ConectPro</span></span>
        <span className="bg-white text-primary px-4 py-1.5 rounded-full text-xs font-bold">v1.0 Interfaz</span>
      </header>

      <main className="flex-1">
        <section className="bg-primary px-6 py-16">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="inline-block bg-accent text-primary px-3 py-1 rounded-full text-xs font-extrabold tracking-widest mb-4">SISTEMA DE VENTA DE PASAJES</p>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
                Viaja con <span className="text-accent">BUSS ConectPro</span>
              </h1>
              <p className="text-white/70 mt-4 text-lg leading-relaxed">
                Plataforma moderna para búsqueda de rutas, selección de asientos y pago seguro. Diseñada para agencias y pasajeros.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="bg-accent text-primary px-6 py-3 rounded-lg font-bold text-sm">Explorar Rutas</span>
                <span className="bg-white/10 text-white border border-white/20 px-6 py-3 rounded-lg font-bold text-sm">Ver Demo BusMap</span>
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                <span className="text-emerald-300 font-semibold">Entorno UI configurado correctamente</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-bold tracking-widest text-gray-400">VISTA PREVIA</span>
                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">Activo</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[1,2,3,4,5,6,7,8].map((n) => (
                  <div key={n} className={n === 3 || n === 6 ? 'w-10 h-10 rounded-lg bg-gray-200 border-2 border-gray-300' : n === 2 || n === 5 ? 'w-10 h-10 rounded-lg bg-accent border-2 border-accent' : 'w-10 h-10 rounded-lg bg-white border-2 border-primary'}></div>
                ))}
              </div>
              <div className="mt-6 flex gap-2 text-xs font-semibold text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-white border-2 border-primary rounded-sm"></span> Libre</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-accent rounded-sm"></span> Selección</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-200 rounded-sm"></span> Ocupado</span>
              </div>
              <div className="mt-6 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">Continuar con la reserva</div>
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow border border-gray-100">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-accent font-bold">01</div>
            <h3 className="font-bold text-primary mt-4">Búsqueda de Rutas</h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">Filtra por origen, destino y fecha con resultados en tiempo real.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow border border-gray-100">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center text-white font-bold">02</div>
            <h3 className="font-bold text-primary mt-4">Selección Visual</h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">Mapa interactivo 2 pisos con estados libre, ocupado y selección.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow border border-gray-100">
            <div className="w-10 h-10 bg-primary-dark rounded-lg flex items-center justify-center text-white font-bold">03</div>
            <h3 className="font-bold text-primary mt-4">Pago Seguro</h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">Checkout integrado y confirmación instantánea de pasajes.</p>
          </div>
        </section>
      </main>

      <footer className="bg-primary-dark text-white text-center py-4 text-sm">© 2026 BUSS ConectPro - Sistema de Venta de Pasajes</footer>
    </div>
  )
}

export default App
