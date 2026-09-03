import React, { useState } from 'react'
import BusMap from './components/bus/BusMap.jsx'

function App() {
  const [demoKey, setDemoKey] = useState(0)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary text-white px-6 py-4 flex justify-between items-center shadow sticky top-0 z-20 backdrop-blur">
        <span className="text-xl font-bold tracking-wide">BUSS<span className="text-accent"> ConectPro</span></span>
        <span className="bg-white text-primary px-4 py-1.5 rounded-full text-xs font-bold shadow-sm">v1.1 Interfaz</span>
      </header>

      <main className="flex-1">
        <section className="bg-primary px-6 py-16 relative overflow-hidden">
          {/* decorativo */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center relative">
            <div>
              <p className="inline-block bg-accent text-primary px-3 py-1 rounded-full text-xs font-extrabold tracking-widest mb-4 shadow-sm">SISTEMA DE VENTA DE PASAJES</p>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
                Viaja con <span className="text-accent">BUSS ConectPro</span>
              </h1>
              <p className="text-white/75 mt-4 text-lg leading-relaxed max-w-xl">
                Plataforma moderna para búsqueda de rutas, selección de asientos y pago seguro. Diseñada para agencias y pasajeros.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-accent text-primary px-7 py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-accent-hover hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
                >
                  Explorar Rutas
                </button>
                <button
                  onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-white/10 text-white border border-white/20 px-7 py-3 rounded-xl font-bold text-sm backdrop-blur hover:bg-white hover:text-primary transition-all duration-200"
                >
                  Ver Demo BusMap
                </button>
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                <span className="text-emerald-300 font-semibold">Entorno UI configurado correctamente</span>
              </div>
            </div>

            {/* Preview interactivo real */}
            <div id="demo" className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold tracking-widest text-gray-400">VISTA PREVIA INTERACTIVA</span>
                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">Demo en vivo</span>
              </div>
              <BusMap
                key={demoKey}
                totalPiso1={8}
                totalPiso2={12}
                ocupados={[3, 6]}
                onSelect={() => {}}
              />
              <div className="mt-4 flex gap-2">
                <button onClick={() => setDemoKey((k) => k + 1)} className="flex-1 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold text-sm text-gray-700 transition-colors">
                  Reiniciar demo
                </button>
                <div className="flex-1 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-sm shadow hover:bg-primary-light transition-colors cursor-pointer">
                  Continuar con la reserva
                </div>
              </div>
              <p className="text-[11px] text-gray-400 text-center mt-3">Prueba seleccionar asientos • Piso 1: VIP • Piso 2: Estándar</p>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-14 grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-accent font-bold shadow-sm">01</div>
            <h3 className="font-bold text-primary mt-4">Búsqueda de Rutas</h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">Filtra por origen, destino y fecha con resultados en tiempo real.</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white font-bold shadow-sm">02</div>
            <h3 className="font-bold text-primary mt-4">Selección Visual</h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">Mapa interactivo 2 pisos con estados libre, ocupado y selección.</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div className="w-10 h-10 bg-primary-dark rounded-xl flex items-center justify-center text-white font-bold shadow-sm">03</div>
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
