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
        // Acento unificado con la marca (antes era azul #0066cc y competia con el CTA)
        accent: { DEFAULT: '#FF6B00', hover: '#E65F00' },
        corporate: '#0F172A',
        canvas: '#F8FAFC',
        // "stone" alineado a la escala slate (grises frios, coherentes con el navy).
        // Antes stone-800 = #0F172A (navy), lo que confundia: un "stone" que no era gris.
        stone: {
          50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
          400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
          800: '#1e293b', 900: '#0f172a',
        }
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
