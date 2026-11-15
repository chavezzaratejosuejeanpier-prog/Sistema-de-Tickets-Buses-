import { motion, AnimatePresence } from 'framer-motion'

/**
 * Transición tipo cortina que cubre y revela el contenido al cambiar de vista.
 */
export default function CortinaTransition({ estaActiva = false, children }) {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <AnimatePresence mode="wait">
        {estaActiva && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="absolute inset-0 bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 z-20"
          />
        )}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative z-10"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}