import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)',
          fontFamily: 'var(--font-mono)', textAlign: 'center', padding: 40,
        }}>
          <span style={{ fontSize: 48, marginBottom: 16 }}>⚠️</span>
          <h2 style={{ color: 'var(--color-error)', marginBottom: 8, fontSize: 18 }}>页面出错了</h2>
          <p style={{ color: 'var(--color-dim)', fontSize: 12, marginBottom: 16, maxWidth: 500, lineHeight: 1.6 }}>
            {this.state.error?.message || '发生了未预期的错误'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="welcome-mode-btn active"
              onClick={this.handleReload}
              style={{ fontSize: 13, padding: '8px 20px' }}
            >
              重新加载
            </button>
            <button
              className="welcome-mode-btn"
              onClick={() => window.history.back()}
              style={{ fontSize: 13, padding: '8px 20px' }}
            >
              返回上一页
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
