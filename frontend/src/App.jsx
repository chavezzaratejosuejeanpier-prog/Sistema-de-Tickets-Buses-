import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import BusMap from './components/bus/BusMap';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import SearchRoutes from './pages/SearchRoutes';
import SeatSelection from './pages/SeatSelection';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <Navbar />

      <div className="min-h-screen bg-slate-100 flex flex-col">
        <main className="flex-grow py-8">
          <Routes>
            <Route path="/" element={<BusMap />} />
            <Route path="/buscar" element={<SearchRoutes />} />
            <Route path="/asientos/:routeId" element={<SeatSelection />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}

export default App;