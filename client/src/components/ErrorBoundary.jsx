import React from 'react'

// Catches render/hydration errors anywhere below it so one broken page can't
// blank the whole app. Shows a friendly recovery panel instead of a white
// screen, with a reload that fetches a fresh bundle.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Surface it for debugging; no external logging to keep it private.
    console.error('[app] render error:', error, info?.componentStack)
  }

  handleReload = () => {
    try { window.location.reload() } catch {}
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg, #0F172A)', color: 'var(--text, #F1F5F9)' }}>
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>⚠️</div>
          <h1 style={{ fontSize: '1.25rem', margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ opacity: 0.75, fontSize: '.95rem', lineHeight: 1.5, margin: '0 0 20px' }}>
            This page hit an unexpected error. Reloading usually fixes it — your saved work isn’t affected.
          </p>
          <button
            onClick={this.handleReload}
            style={{ background: 'var(--accent, #6366F1)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: '.95rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
