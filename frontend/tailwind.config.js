export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        primary: { DEFAULT: '#7C3AED', dark: '#6D28D9', light: '#A78BFA' },
        accent: { DEFAULT: '#F97316', hover: '#EA580C' },
        success: { DEFAULT: '#22C55E', dark: '#16A34A' },
        navy: { DEFAULT: '#0F172A', light: '#334155', dark: '#020617' },
        footer: '#0B1526',
        surface: '#F8FAFC',
        line: '#E2E8F0',
        muted: '#64748B',
        footerLink: '#A5B4CB',
        corporate: '#0F172A',
        canvas: '#F8FAFC',
        stone: {
          50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
          400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
          800: '#1e293b', 900: '#0f172a', 950: '#020617',
        }
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
        lift: '0 4px 12px rgba(15,23,42,0.10), 0 2px 4px rgba(15,23,42,0.06)',
      },
      maxWidth: {
        shell: '1500px',
      },
    }
  },
  plugins: []
}
