import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300 py-8 border-t-4 border-blue-900 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
        
        <div className="text-center md:text-left">
          <h3 className="text-lg font-bold text-white mb-1">BUSS ConectPro</h3>
          <p className="text-sm text-gray-400">Sistema moderno de gestión y reserva de pasajes.</p>
        </div>

        <div className="flex gap-6 text-sm font-medium">
          <a href="#" className="hover:text-white transition-colors">Términos de Servicio</a>
          <a href="#" className="hover:text-white transition-colors">Política de Privacidad</a>
          <a href="#" className="hover:text-white transition-colors">Soporte</a>
        </div>
        
      </div>
      
      <div className="text-center text-xs text-gray-500 mt-8 pt-4 border-t border-gray-800">
        &copy; {currentYear} BUSS ConectPro. Todos los derechos reservados.
      </div>
    </footer>
  );
};

export default Footer;