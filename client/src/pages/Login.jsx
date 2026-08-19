import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLocationId, persistLocationId } from '../lib/api.js'
import { PROVIDERS } from '../lib/providers.js'

const AI_KEY = 'ghl_ai_config'

function readAIConfig() {
  try { return JSON.parse(localStorage.getItem(AI_KEY)) } catch { return null }
}

export default function Login() {
  const navigate = useNavigate()

  const [step, setStep]         = useState(1)       // 1 = location id, 2 = api key
  const [locationId, setLocationId] = useState('')
  const [provider, setProvider] = useState(PROVIDERS[0].id)
  const [apiKey, setApiKey]     = useState('')
  const [model, setModel]       = useState('')
  const [error, setError]       = useState('')

  const selectedProv = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0]

  // Already fully signed in — skip to dashboard
  useEffect(() => {
    const id = getLocationId()
    if (id && readAIConfig()) navigate('/', { replace: true })
    else if (id) { setLocationId(id); setStep(2) } // has location but no API key
  }, [navigate])

  function handleLocationSubmit(e) {
    e.preventDefault()
    const id = locationId.trim()
    if (!id) { setError('Please enter your Location ID'); return }
    persistLocationId(id)
    setError('')
    setStep(2)
  }

  function handleAPIKeySubmit(e) {
    e.preventDefault()
    const key = apiKey.trim()
    if (!key) { setError('Please enter your API key'); return }
    localStorage.setItem(AI_KEY, JSON.stringify({
      provider,
      apiKey: key,
      model: model || selectedProv.defaultModel,
    }))
    navigate(`/?locationId=${locationId.trim() || getLocationId()}`, { replace: true })
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
                disabled={!locationId.trim()}
              >
                Next →
              </button>
            </form>
          </>
        )}

        {/* ── Step 2: API Key ── */}
        {step === 2 && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text)', marginBottom: 6 }}>
                Step 2 of 2 — AI Provider
              </div>
              <div style={{ fontSize: '.875rem', color: 'var(--sub)' }}>
                Enter your own API key — this stays on this device only
              </div>
              {locationId && (
                <div style={{ marginTop: 10, padding: '7px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '.8rem', color: 'var(--sub)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Location: <strong style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{locationId}</strong></span>
                  <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '.8rem', padding: 0 }} onClick={() => { localStorage.removeItem('ghl_location_id'); setStep(1); setLocationId('') }}>Change</button>
                </div>
              )}
            </div>

            <form onSubmit={handleAPIKeySubmit}>
              {/* Provider */}
              <div className="form-group">
                <label className="form-label">Provider</label>
                <select
                  className="form-input form-select"
                  value={provider}
                  onChange={e => { setProvider(e.target.value); setModel('') }}
                >
                  {PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* API Key */}
              <div className="form-group">
                <label className="form-label">API Key</label>
                <input
                  className="form-input"
                  type="password"
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setError('') }}
                  placeholder={selectedProv.placeholder}
                  autoComplete="off"
                  autoFocus
                />
                {error && <div style={{ fontSize: '.8125rem', color: 'var(--danger)', marginTop: 6 }}>{error}</div>}
              </div>

              {/* Model */}
              <div className="form-group">
                <label className="form-label">Model</label>
                <select
                  className="form-input form-select"
                  value={model || selectedProv.defaultModel}
                  onChange={e => setModel(e.target.value)}
                >
                  {selectedProv.models.map(m => (
                    <option key={m} value={m}>{m}{m === selectedProv.defaultModel ? ' (default)' : ''}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 8 }}
                disabled={!apiKey.trim()}
              >
                Start using Automator
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
