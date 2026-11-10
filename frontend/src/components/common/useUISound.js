const AudioContext = window.AudioContext || window.webkitAudioContext
const ctx = AudioContext ? new AudioContext() : null

function tono(frecuencia, duracion, tipo = 'sine', volumen = 0.08) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = tipo
  osc.frequency.setValueAtTime(frecuencia, ctx.currentTime)
  gain.gain.setValueAtTime(volumen, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracion)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duracion)
}

export function playUISound(tipo) {
  if (!ctx) return
  switch (tipo) {
    case 'click': tono(600, 0.06, 'sine', 0.05); break
    case 'hover': tono(900, 0.03, 'sine', 0.03); break
    case 'success': tono(800, 0.1, 'sine', 0.08); tono(1000, 0.1, 'sine', 0.08); break
    case 'error': tono(200, 0.2, 'sawtooth', 0.1); break
    case 'seat': tono(1200, 0.05, 'sine', 0.04); break
    default: break
  }
}