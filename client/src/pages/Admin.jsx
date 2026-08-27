import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLocationId, persistLocationId } from '../lib/api.js'
import { getSessionToken, getSessionClaims, setSessionToken } from '../lib/session.js'
import AdminConsole from '../components/AdminConsole.jsx'

// Standalone admin portal at /admin — its own login + console, outside the main
// app shell. Bookmarkable. Admin identity is verified server-side (ADMIN_EMAILS
// / built-in list); a non-admin who signs in here is told they lack access.
export default function AdminPortal() {
  const navigate = useNavigate()
  const [tick, setTick] = useState(0)                 // re-read claims after login
  const [step, setStep] = useState(1)                 // 1 = location, 2 = email
  const [locationId, setLocationId] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  const claims = getSessionClaims()
  const signedIn = !!getSessionToken() && !!claims?.uid

  useEffect(() => {
    const id = getLocationId()
    if (id && !signedIn) { setLocationId(id); if (getSessionToken()) setStep(2) }
  }, []) // eslint-disable-line

  async function submitLocation(e) {
    e.preventDefault()
    const id = locationId.trim()
    if (!id) { setError('Enter your Location ID'); return }
    setVerifying(true); setError('')
    try {
      const r = await fetch('/auth/location-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId: id }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.token) { setError(d.message || 'This Location ID is not authorized.'); return }
      setSessionToken(d.token); persistLocationId(id); setStep(2)
    } catch { setError('Could not reach the server. Try again.') }
    finally { setVerifying(false) }
  }

  async function submitEmail(e) {
    e.preventDefault()
    const addr = email.trim()
    if (!addr) { setError('Enter your admin email'); return }
    setVerifying(true); setError('')
    try {
      const r = await fetch('/auth/user-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: addr }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.token) { setError(d.message || 'That email is not a user on this location.'); return }
      setSessionToken(d.token); setTick(t => t + 1)   // re-render → console or "not admin"
    } catch { setError('Could not reach the server. Try again.') }
    finally { setVerifying(false) }
  }

  function signOut() {
    localStorage.removeItem('ghl_session')
    localStorage.removeItem('ghl_user_email')
    fetch('/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    setStep(1); setEmail(''); setTick(t => t + 1)
  }

  const shell = (children, wide) => (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
        <div style={{ maxWidth: wide ? 1080 : 460, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="17" height="17"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/></svg>
          </span>
          <div style={{ fontWeight: 700, letterSpacing: '-.01em' }}>Automator <span style={{ color: 'var(--sub)', fontWeight: 600 }}>Admin</span></div>
          {signedIn && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.8rem', color: 'var(--sub)' }}>{claims?.email}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/?locationId=${getLocationId()}`)}>← Dashboard</button>
              <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
            </div>
          )}
        </div>
      </div>
      <div style={{ maxWidth: wide ? 1080 : 460, width: '100%', margin: '0 auto', padding: wide ? '24px' : '48px 24px', flex: 1 }}>
        {children}
      </div>
    </div>
  )

  // ── Signed in as an admin → the console ──────────────────────────────
  if (signedIn && claims?.adm) {
    return shell(
      <>
        <div className="page-title" style={{ marginBottom: 14 }}>User Administration</div>
        <AdminConsole />
      </>,
      true
    )
  }

  // ── Signed in, but not an admin ──────────────────────────────────────
  if (signedIn && !claims?.adm) {
    return shell(
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <div className="empty-title" style={{ marginBottom: 6 }}>Not an admin account</div>
        <div className="empty-sub" style={{ marginBottom: 16 }}>
          <b>{claims?.email}</b> doesn’t have admin access. Ask an administrator to add your email, or open the main app.
        </div>
        <button className="btn btn-primary" onClick={() => navigate(`/?locationId=${getLocationId()}`)}>Open Automator →</button>
      </div>
    )
  }

  // ── Not signed in → admin login ──────────────────────────────────────
  const stepDot = (n) => <div style={{ width: 8, height: 8, borderRadius: '50%', background: n === step ? 'var(--accent)' : 'var(--border)' }} />
  return shell(
    <div className="card" style={{ padding: '32px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{step === 1 ? 'Admin sign-in' : 'Verify your email'}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>{stepDot(1)}{stepDot(2)}</div>
      </div>

      {step === 1 ? (
        <form onSubmit={submitLocation}>
          <div className="form-group">
            <label className="form-label">Location ID</label>
            <input className="form-input" value={locationId} autoFocus spellCheck={false}
              onChange={e => { setLocationId(e.target.value); setError('') }} placeholder="e.g. KogOOG0gkaYzCE9gAaWr" />
            {error && <div style={{ fontSize: '.8125rem', color: 'var(--danger)', marginTop: 6 }}>{error}</div>}
            <div className="text-xs text-sub mt-1">Sign in with a location under your installed agency.</div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={!locationId.trim() || verifying}>
            {verifying ? 'Verifying…' : 'Next →'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitEmail}>
          <div className="form-group">
            <label className="form-label">Admin email</label>
            <input className="form-input" type="email" value={email} autoFocus autoComplete="email"
              onChange={e => { setEmail(e.target.value); setError('') }} placeholder="you@youragency.com" />
            {error && <div style={{ fontSize: '.8125rem', color: 'var(--danger)', marginTop: 6 }}>{error}</div>}
            <div className="text-xs text-sub mt-1">Must be an admin email on this location.</div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={!email.trim() || verifying}>
            {verifying ? 'Verifying…' : 'Enter admin console →'}
          </button>
          <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => { setStep(1); setError('') }}>← Back</button>
        </form>
      )}
    </div>
  )
}
