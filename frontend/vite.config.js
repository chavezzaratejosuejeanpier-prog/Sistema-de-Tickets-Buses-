import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { exigirEntornoValido } from './entorno-publico.mjs'

export default defineConfig(({ command, mode }) => {
  // Se leen todas las variables solo para validar y configurar los
  // servidores locales; al bundle únicamente llegan las VITE_*.
  const env = loadEnv(mode, process.cwd(), '')
  // Todo `vite build` (también con `--mode staging` u otro modo) produce un
  // bundle publicable: se valida como producción y no admite loopback.
  exigirEntornoValido(env, { produccion: command === 'build' })

  // Proxy de /api solo para `vite` y `vite preview` (desarrollo). En
  // producción FastAPI sirve dist/ y /api en el mismo origen.
  const proxy = { '/api': { target: env.DEV_API_PROXY || 'http://127.0.0.1:8000' } }
  const host = env.DEV_HOST || 'localhost'

  return {
    plugins: [react()],
    server: { host, port: Number(env.DEV_PORT) || 5173, proxy },
    preview: { host, port: Number(env.PREVIEW_PORT) || 4173, proxy },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // Sin mapas de código fuente públicos en el build de producción.
      sourcemap: false,
    },
  }
})
