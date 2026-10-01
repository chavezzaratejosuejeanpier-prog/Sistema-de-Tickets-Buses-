import { useContext } from 'react'
import { ThemeContext } from './theme-context.js'

export const useTheme = () => useContext(ThemeContext)
