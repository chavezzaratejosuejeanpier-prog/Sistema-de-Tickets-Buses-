import { motion, AnimatePresence } from 'framer-motion'

export default function PortalTransition({ children, estaActivo = false }) {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <AnimatePresence mode="popLayout">
        {estaActivo && (
          <motion.div
            initial={{ clipPath: 'circle(0% at 50% 50%)' }}
            animate={{ clipPath: 'circle(150% at 50% 50%)' }}
            exit={{ clipPath: 'circle(0% at 50% 50%)' }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="absolute inset-0 bg-stone-950/90 backdrop-blur-sm z-10"
          />
        )}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className="relative z-20"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}