// Prueba de regresión del Onboarding (React #130 y botón Siguiente bloqueado).
// Transforma el JSX real con esbuild (vía Vite, sin levantar servidor) y lo
// renderiza con react-dom/server.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithEsbuild } from 'vite'

const fuente = fileURLToPath(new URL('../src/components/common/Onboarding.jsx', import.meta.url))
// Directorio temporal dentro de frontend/node_modules para que Node resuelva
// react, framer-motion y lucide-react desde las dependencias del proyecto.
const cache = fileURLToPath(new URL('../node_modules/.cache/', import.meta.url))
let tmpDir
let Onboarding

before(async () => {
  const { code } = await transformWithEsbuild(await readFile(fuente, 'utf8'), fuente, {
    loader: 'jsx',
    jsx: 'automatic',
  })
  await mkdir(cache, { recursive: true })
  tmpDir = await mkdtemp(join(cache, 'onboarding-test-'))
  const archivo = join(tmpDir, 'Onboarding.mjs')
  await writeFile(archivo, code)
  Onboarding = (await import(pathToFileURL(archivo).href)).default
})

after(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
})

const render = () => renderToStaticMarkup(createElement(Onboarding, { onFinish: () => {} }))

test('renderiza el primer paso con su icono sin lanzar React #130', () => {
  const html = render()
  assert.match(html, /Bienvenido a LUX/)
  assert.match(html, /<svg\b[^>]*lucide-bus/)
})

test('el botón Siguiente del primer paso acepta clics', () => {
  const html = render()
  const boton = html.match(/<button\b[^>]*>(?:(?!<\/button>).)*Siguiente/s)
  assert.ok(boton, 'no se encontró el botón Siguiente')
  assert.doesNotMatch(boton[0], /pointer-events-none/)
})
