import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import BusMap from './components/bus/BusMap';
import Checkout from './pages/Checkout';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 py-12">
        <Routes>
          <Route path="/" element={<BusMap />} />
          <Route path="/checkout" element={<Checkout />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;