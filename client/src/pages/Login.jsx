import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLocationId, persistLocationId } from '../lib/api.js'
import { setSessionToken, getSessionToken, getSessionClaims } from '../lib/session.js'

export default function Login() {
  const navigate = useNavigate()

  const [step, setStep]         = useState(1)       // 1 = location, 2 = email
  const [locationId, setLocationId] = useState('')
  const [email, setEmail]       = useState('')
  const [error, setError]       = useState('')
  const [verifying, setVerifying] = useState(false)

  function enterApp(id) {
    navigate(`/?locationId=${(id || locationId || getLocationId() || '').trim()}`, { replace: true })
  }

  // Resume at the right step based on what's already established.
  useEffect(() => {
    const id = getLocationId()
    const hasLocation = id && getSessionToken()
    const hasUser = !!getSessionClaims()?.uid
    if (hasLocation && hasUser) enterApp(id)         // fully signed in → straight to the app
    else if (hasLocation)      { setLocationId(id); setStep(2) } // needs email
    else if (id) setLocationId(id)                   // prefill known location (e.g. from GHL URL)
  }, [navigate])

  async function handleEmailSubmit(e) {
    e.preventDefault()
    const addr = email.trim()
    if (!addr) { setError('Please enter your email'); return }
    setVerifying(true)
    setError('')
    try {
      const r = await fetch('/auth/user-login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: addr }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data.token) {
        setError(data.message || 'That email is not a user on this location.')
        setVerifying(false)
        return
      }
      setSessionToken(data.token)
      enterApp()   // done — API key is set later in Settings
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  async function handleLocationSubmit(e) {
    e.preventDefault()
    const id = locationId.trim()
    if (!id) { setError('Please enter your Location ID'); return }

    setVerifying(true)
    setError('')
    try {
      const r = await fetch('/auth/location-login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ locationId: id }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data.token) {
        setError(data.message || 'This Location ID is not authorized.')
        setVerifying(false)
        return
      }
      setSessionToken(data.token)
      persistLocationId(id)
      setStep(2)  // → email verification
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '40px 36px',
        width: '100%',
        maxWidth: 420,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'var(--accent)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" fill="#fff" width="18" height="18">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text)' }}>Automator</span>

          {/* Step indicator */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: s === step ? 'var(--accent)' : 'var(--border)',
                transition: 'background .2s',
              }} />
            ))}
          </div>
        </div>

        {/* ── Step 1: Location ID ── */}
        {step === 1 && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text)', marginBottom: 6 }}>
                Step 1 of 2 — Location ID
              </div>
              <div style={{ fontSize: '.875rem', color: 'var(--sub)' }}>
                Enter the GHL Location ID for your sub-account
              </div>
            </div>

            <form onSubmit={handleLocationSubmit}>
              <div className="form-group">
                <label className="form-label">Location ID</label>
                <input
                  className="form-input"
                  type="text"
                  value={locationId}
                  onChange={e => { setLocationId(e.target.value); setError('') }}
                  placeholder="e.g. KogOOG0gkaYzCE9gAaWr"
                  autoComplete="off"
                  autoFocus
                  spellCheck={false}
                />
                {error && <div style={{ fontSize: '.8125rem', color: 'var(--danger)', marginTop: 6 }}>{error}</div>}
                <div className="text-xs text-sub mt-1">
                  Found in GHL → Settings → Business Info
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 8 }}
                disabled={!locationId.trim() || verifying}
              >
                {verifying ? 'Verifying…' : 'Next →'}
              </button>
            </form>
          </>
        )}

        {/* ── Step 2: Email identity ── */}
        {step === 2 && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text)', marginBottom: 6 }}>
                Step 2 of 2 — Your Email
              </div>
              <div style={{ fontSize: '.875rem', color: 'var(--sub)' }}>
                Enter the email of your GHL account on this location — used to keep your work private to you
              </div>
            </div>

            <form onSubmit={handleEmailSubmit}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="you@company.com"
                  autoComplete="email"
                  autoFocus
                />
                {error && <div style={{ fontSize: '.8125rem', color: 'var(--danger)', marginTop: 6 }}>{error}</div>}
                <div className="text-xs text-sub mt-1">
                  Must match a user on this GHL location. You can add your AI API key later in Settings.
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 8 }}
                disabled={!email.trim() || verifying}
              >
                {verifying ? 'Verifying…' : 'Enter Automator →'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => { setStep(1); setError('') }}
              >
                ← Back
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
