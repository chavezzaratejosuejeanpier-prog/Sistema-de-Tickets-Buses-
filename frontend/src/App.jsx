import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import BusMap from './components/bus/BusMap';
import Checkout from './pages/Checkout';

function App() {
  return (
    <Router>
      {/* El Navbar va arriba de todo */}
      <Navbar />
      
      {/* Contenedor principal para empujar el footer hacia abajo */}
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <main className="flex-grow py-8">
          <Routes>
            <Route path="/" element={<BusMap />} />
            <Route path="/checkout" element={<Checkout />} />
          </Routes>
        </main>
        
        {/* El Footer va al final */}
        <Footer />
      </div>
    </Router>
  );
}

export default App;