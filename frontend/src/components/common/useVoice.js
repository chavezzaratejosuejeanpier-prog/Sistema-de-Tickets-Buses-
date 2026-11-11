import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * Hook para asistente de voz usando Web Speech API nativa del navegador.
 * No requiere servidor ni API key.
 * Estados: 'idle' | 'listening' | 'speaking' | 'processing'
 */
export function useVoice({ lang = 'es-PE' } = {}) {
  const [estado, setEstado] = useState('idle')
  const [resultado, setResultado] = useState('')
  const recognitionRef = useRef(null)
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    ) {
      setEstado('idle')
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onstart = () => setEstado('listening')
    recognition.onresult = (event) => {
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) final += transcript
      }
      if (final) {
        setResultado(final)
        setEstado('processing')
      }
    }
    recognition.onerror = () => setEstado('idle')
    recognition.onend = () => {
      if (estado !== 'speaking') setEstado('idle')
    }

    recognitionRef.current = recognition

    return () => {
      try { recognition.stop() } catch {}
    }
  }, [lang, estado])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    setResultado('')
    try {
      recognitionRef.current.start()
    } catch {}
  }, [])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    try { recognitionRef.current.stop() } catch {}
    setEstado('idle')
  }, [])

  const speak = useCallback((texto) => {
    if (!synthRef.current) return
    synthRef.current.cancel()
    const utterance = new window.SpeechSynthesisUtterance(texto)
    utterance.lang = lang
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onstart = () => setEstado('speaking')
    utterance.onend = () => setEstado('idle')
    synthRef.current.speak(utterance)
  }, [lang])

  const stopSpeaking = useCallback(() => {
    if (!synthRef.current) return
    synthRef.current.cancel()
    setEstado('idle')
  }, [])

  const responder = useCallback((texto) => {
    setResultado(texto)
    speak(texto)
  }, [speak])

  const soportado =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) &&
    typeof window.speechSynthesis !== 'undefined'

  return {
    estado,
    resultado,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    responder,
    setResultado,
    soportado,
  }
}