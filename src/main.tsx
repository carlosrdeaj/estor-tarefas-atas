import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

type BoundaryProps = { children: ReactNode }
type BoundaryState = { message: string | null }

class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { message: null }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { message: error instanceof Error ? error.message : 'Erro inesperado.' }
  }

  render() {
    if (this.state.message) {
      return (
        <div className="fatal">
          <h1>Algo saiu do lugar.</h1>
          <p>{this.state.message}</p>
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('Elemento raiz não encontrado.')

createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
