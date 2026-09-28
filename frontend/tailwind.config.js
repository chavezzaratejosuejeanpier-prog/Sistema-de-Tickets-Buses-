/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        // Marca BUSS ConnectPro
        primary: { DEFAULT: '#FF6B00', dark: '#E65F00' }, // naranja de acción (CTA)
        navy: { DEFAULT: '#0F172A', light: '#334155', dark: '#020617' }, // texto / títulos
        footer: '#0B1526',   // azul del pie de página
        surface: '#F8FAFC', // fondo general
        line: '#E2E8F0',    // bordes suaves
        muted: '#64748B',    // texto secundario
        footerLink: '#A5B4CB',
        // Paleta anterior (páginas pendientes de rediseño)
        accent: { DEFAULT: '#0066cc', hover: '#0077ed' },
        morado: { DEFAULT: '#7e22ce', light: '#a855f7' },
        corporate: '#0F172A',
        canvas: '#F8FAFC',
        stone: { 400: '#86868b', 500: '#6e6e73', 600: '#515154', 700: '#3a3a3c', 800: '#0F172A' }
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
      },
      maxWidth: {
        shell: '1500px',
      },
    }
  },
  plugins: []
}
