import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './ErrorState'

interface ChartErrorBoundaryProps {
  children: ReactNode
}

interface ChartErrorBoundaryState {
  hasError: boolean
}

/**
 * Defense-in-depth for CR-01: `decodeShareLink`'s shape check rejects
 * anything that isn't chart-spec-shaped before it reaches GraphicWalker, but
 * a class component error boundary is the only mechanism React offers to
 * contain a render-time throw from a third-party component (there is no
 * hook equivalent — `componentDidCatch`/`getDerivedStateFromError` require a
 * class). Wrapping `<GraphicWalker />` here means any future crash inside it
 * (a decode edge case this fix didn't anticipate, or an unrelated internal
 * GraphicWalker bug) degrades to a friendly `ErrorState` instead of an
 * unrecoverable blank page past the nearest React root.
 */
export class ChartErrorBoundary extends Component<ChartErrorBoundaryProps, ChartErrorBoundaryState> {
  state: ChartErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ChartErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Logged for local debugging only — no telemetry/reporting service is
    // part of this $0 static-hosting project's stack.
    console.error('ChartErrorBoundary caught an error rendering the chart:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="No s'ha pogut mostrar el gràfic"
          message="L'enllaç compartit no és vàlid per a aquesta enquesta. Torna a la pàgina de l'enquesta per començar un gràfic nou."
        />
      )
    }
    return this.props.children
  }
}
