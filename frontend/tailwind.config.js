/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#0f2a44", light: "#1a3a5c", dark: "#0a1e30" },
        accent: { DEFAULT: "#00b4d8", hover: "#0096c7" },
        corporate: "#0f2a44"
      }
    }
  },
  plugins: []
}
