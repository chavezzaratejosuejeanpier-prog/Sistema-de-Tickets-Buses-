/* eslint-disable no-undef */
/**
 * Retroalimentación háptica ligera para dispositivos que la soporten.
 * Uso: const { haptico } = useHaptic(); haptico('light')
 */
export function useHaptic() {
  const haptico = (tipo = 'light') => {
    if (typeof navigator === 'undefined' || !navigator?.vibrate) return

    const patrones = {
      light: [10],
      medium: [20, 10, 20],
      heavy: [30, 15, 30, 15, 30],
      click: [5],
      success: [10, 20, 10],
      error: [50, 20, 50],
    }

    navigator.vibrate(patrones[tipo] || patrones.light)
  }

  return { haptico }
}