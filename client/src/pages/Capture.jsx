import { useEffect, useState } from 'react'

// Signal to any open Automator tab on the same origin that a session was stored.
function signalConnected(locationId) {
  try {
    // localStorage 'storage' event fires in OTHER same-origin tabs instantly.
    localStorage.setItem('ghl_wf_connected', locationId + ':' + Date.now())
  } catch {}
  try {
    // BroadcastChannel for same-origin tabs (modern browsers).
    new BroadcastChannel('ghl_wf').postMessage({ connected: true, locationId })
  } catch {}
}

export default function Capture() {
  const [status, setStatus] = useState('connecting') // connecting | ok | error
  const [msg,    setMsg]    = useState('')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    async function run() {
      try {
        const hash     = window.location.hash.slice(1)
        const params   = new URLSearchParams(hash)
        const token    = params.get('t')
        const locationId = params.get('l')

        if (!token || !locationId) {
          setStatus('error')
          setMsg('Missing token or location ID.')
          setDetail('Close this tab and click the bookmarklet again while on a GHL page that has requests loading.')
          return
        }

        const r = await fetch('/api/workflows/session', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ locationId, token }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Server error')

        // Signal the Automator tab — no waiting for its 4-second poll.
        signalConnected(locationId)

        const tokenType = d.type === 'refresh' ? '30-day refresh token' : '1-hour session token'
        setStatus('ok')
        setMsg(`Connected using ${tokenType}`)
        setDetail('You can close this tab and return to Automator.')
        setTimeout(() => { try { window.close() } catch {} }, 3000)
      } catch (e) {
        setStatus('error')
        setMsg(e.message || 'Unknown error')
        setDetail('Try closing this tab and clicking the bookmarklet again.')
      }
    }
    run()
  }, [])

  const palette = { connecting: '#2563eb', ok: '#16a34a', error: '#dc2626' }
  const icons   = { connecting: '⏳', ok: '✓', error: '✗' }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8fafc',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 48px',
        boxShadow: '0 8px 32px rgba(0,0,0,.10)', textAlign: 'center', maxWidth: 420,
      }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>{icons[status]}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: palette[status], marginBottom: 10 }}>
          {status === 'connecting' ? 'Connecting…' : status === 'ok' ? 'Connected!' : 'Connection failed'}
        </div>
        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 6 }}>
          {msg || 'Storing your GHL session…'}
        </div>
        {detail && (
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{detail}</div>
        )}
        <button
          onClick={() => window.close()}
          style={{
            marginTop: 24, padding: '9px 24px', borderRadius: 8,
            background: status === 'ok' ? '#16a34a' : '#f1f5f9',
            color: status === 'ok' ? '#fff' : '#374151',
            border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
        >
          Close tab
        </button>
      </div>
    </div>
  )
}
