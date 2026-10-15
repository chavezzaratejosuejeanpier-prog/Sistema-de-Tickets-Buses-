import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Error de render:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-lg mx-auto mt-16 card p-8 text-center">
          <h1 className="text-xl font-bold text-navy dark:text-white">Algo salió mal</h1>
          <p className="text-muted dark:text-stone-400 mt-2 text-sm">
            Ocurrió un error inesperado. Recarga la página para continuar.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-primary px-5 py-2.5 font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
