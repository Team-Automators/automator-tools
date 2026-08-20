// Client-side session token: proves this browser passed the location-login
// check. Sent as `Authorization: Bearer <token>` on every same-origin request
// (works inside the GHL iframe where third-party cookies may be blocked). The
// server also sets an httpOnly cookie as a fallback for standalone use.

const KEY = 'ghl_session'

export function getSessionToken() {
  try { return localStorage.getItem(KEY) || '' } catch { return '' }
}

export function setSessionToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
  } catch {}
}

export function clearSessionToken() {
  setSessionToken('')
}

// The location context we can silently re-authenticate against.
function currentLocationId() {
  try {
    const fromUrl = new URL(window.location.href).searchParams.get('locationId')
    return fromUrl || localStorage.getItem('ghl_location_id') || ''
  } catch { return '' }
}

// Silently re-issue a session token for the known location. Uses `origFetch`
// (unpatched) to avoid recursing through the auth wrapper. Returns the new
// token, or '' if the location can't be authenticated.
async function reauth(origFetch) {
  const id = currentLocationId()
  if (!id) return ''
  try {
    const r = await origFetch('/auth/location-login', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ locationId: id }),
    })
    const d = await r.json().catch(() => ({}))
    if (r.ok && d.token) { setSessionToken(d.token); return d.token }
  } catch {}
  return ''
}

// Patch window.fetch once so every same-origin call carries the session token,
// and transparently recovers from an expired/missing session by re-authenticating.
let installed = false
export function installAuthFetch() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const orig = window.fetch.bind(window)

  function withAuth(input, init) {
    const headers = new Headers(
      (init && init.headers) ||
      (typeof input !== 'string' && input && input.headers) ||
      {}
    )
    const token = getSessionToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return { credentials: 'include', ...init, headers }
  }

  window.fetch = async (input, init = {}) => {
    let protectedPath = false
    try {
      const raw = typeof input === 'string' ? input : (input && input.url) || ''
      const abs = new URL(raw, window.location.origin)
      if (abs.origin === window.location.origin) {
        protectedPath = abs.pathname.startsWith('/api') || abs.pathname.startsWith('/copywrite')
        init = withAuth(input, init) // attach token + credentials for same-origin
      }
    } catch {}

    let res = await orig(input, init)

    // Expired/missing session on a tenant route — try one silent re-auth + retry.
    if (res.status === 401 && protectedPath) {
      const token = await reauth(orig)
      if (token) {
        res = await orig(input, withAuth(input, init))
      }
      if (res.status === 401 && window.location.pathname !== '/login') {
        clearSessionToken()
        window.location.href = '/login'
      }
    }
    return res
  }
}
