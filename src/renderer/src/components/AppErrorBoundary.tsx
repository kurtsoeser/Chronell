import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/** Fängt Render-Crashes ab, damit ein weißer Bildschirm die Fehlerursache zeigt. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      const msg = this.state.error.message || String(this.state.error)
      const stack = this.state.error.stack ?? ''
      return (
        <div
          style={{
            boxSizing: 'border-box',
            height: '100%',
            overflow: 'auto',
            padding: 24,
            fontFamily: 'ui-monospace, Consolas, monospace',
            fontSize: 13,
            color: '#111',
            background: '#fafafa'
          }}
        >
          <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>Chronell – Render-Fehler</h1>
          <p style={{ margin: '0 0 16px', color: '#b91c1c' }}>{msg}</p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{stack}</pre>
          <button
            type="button"
            style={{ marginTop: 16, padding: '8px 12px' }}
            onClick={(): void => window.location.reload()}
          >
            Neu laden
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
