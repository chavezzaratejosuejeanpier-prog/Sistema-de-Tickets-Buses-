import { motion } from 'framer-motion'
import { Trophy, CheckCircle } from 'lucide-react'

export default function LogroAnimado({ titulo, descripcion, desbloqueado = false, Icono = Trophy }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={desbloqueado ? { opacity: 1, scale: 1 } : { opacity: 0.5, scale: 0.9 }}
      transition={{ duration: 0.4 }}
      className={`p-4 rounded-xl border flex items-center gap-3 transition-colors duration-300 ${desbloqueado ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700'}`}
    >
      <div
        className={`p-2 rounded-full ${desbloqueado ? 'bg-amber-500 text-white' : 'bg-stone-300 dark:bg-stone-700 text-stone-600'}`}
      >
        <Icono size={20} />
      </div>
      <div>
        <h4 className={`font-bold text-sm ${desbloqueado ? 'text-amber-800 dark:text-amber-300' : 'text-stone-700 dark:text-stone-300'}`}>
          {titulo}
        </h4>
        <p className={`text-xs ${desbloqueado ? 'text-amber-600 dark:text-amber-400' : 'text-stone-500 dark:text-stone-500'}`}>
          {descripcion}
        </p>
      </div>
      {desbloqueado && <CheckCircle size={16} className="text-green-500 ml-auto" />}
    </motion.div>
  )
}