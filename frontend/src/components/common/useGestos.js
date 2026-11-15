import { useCallback } from 'react'

/**
 * Hook para navegación por gestos táctiles (swipe left/right).
 * Uso: const { gestosRef } = useGestos({ onSwipeLeft, onSwipeRight })
 */
export function useGestos({ onSwipeLeft, onSwipeRight }) {
  const ref = useCallback((node) => {
    if (!node) return
    let startX = 0
    let startY = 0

    const handleStart = (e) => {
      const touch = e.touches?.[0] || e
      startX = touch.clientX
      startY = touch.clientY
    }

    const handleEnd = (e) => {
      const touch = e.changedTouches?.[0] || e
      const endX = touch.clientX
      const endY = touch.clientY
      const diffX = endX - startX
      const diffY = endY - startY

      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX > 0 && onSwipeRight) onSwipeRight()
        if (diffX < 0 && onSwipeLeft) onSwipeLeft()
      }
    }

    node.addEventListener('touchstart', handleStart, { passive: true })
    node.addEventListener('touchend', handleEnd, { passive: true })

    return () => {
      node.removeEventListener('touchstart', handleStart)
      node.removeEventListener('touchend', handleEnd)
    }
  }, [onSwipeLeft, onSwipeRight])

  return { gestosRef: ref }
}