// Client-side session token: proves this browser passed the location-login
// check. Sent as `Authorization: Bearer <token>` on every same-origin request
// (works inside the GHL iframe where third-party cookies may be blocked). The
// server also sets an httpOnly cookie as a fallback for standalone use.

const KEY = 'ghl_session'
const EMAIL_KEY = 'ghl_user_email'   // remembered so we can silently re-login as the user

export function getSessionToken() {
  try { return localStorage.getItem(KEY) || '' } catch { return '' }
}

export function setSessionToken(token) {
  try {
    if (token) {
      localStorage.setItem(KEY, token)
      // Remember the user's email from the token so an expired session can be
      // silently restored WITH the user identity (uid), not just location-level.
      const email = decodeClaims(token)?.email
      if (email) localStorage.setItem(EMAIL_KEY, email)
    } else {
      localStorage.removeItem(KEY)
    }
  } catch {}
}

// Only cleared on an explicit sign-out — NOT on transient session expiry, so
// silent re-auth can always recover the user.
export function getRememberedEmail() {
  try { return localStorage.getItem(EMAIL_KEY) || '' } catch { return '' }
}
export function setRememberedEmail(email) {
  try { if (email) localStorage.setItem(EMAIL_KEY, email); else localStorage.removeItem(EMAIL_KEY) } catch {}
}

export function clearSessionToken() {
  setSessionToken('')
}

function decodeClaims(t) {
  if (!t || t.indexOf('.') < 1) return null
  try {
    let b = t.slice(0, t.indexOf('.')).replace(/-/g, '+').replace(/_/g, '/')
    while (b.length % 4) b += '='
    return JSON.parse(atob(b))
  } catch { return null }
}

// Decode the (signed, not encrypted) session payload for UI gating only.
// The server always re-verifies — never trust this for authorization.
export function getSessionClaims() {
  return decodeClaims(getSessionToken())
}

// The location context we can silently re-authenticate against.
function currentLocationId() {
  try {
    const fromUrl = new URL(window.location.href).searchParams.get('locationId')
    return fromUrl || localStorage.getItem('ghl_location_id') || ''
  } catch { return '' }
}

// Silently restore a session for the known location — and, when we remember the
// user's email, restore the FULL user session (uid/email) so route guards that
// require a verified user don't bounce to /login. Uses `origFetch` (unpatched)
// to avoid recursing through the auth wrapper. Returns the new token, or ''.
export async function reauth(origFetch = window.fetch.bind(window)) {
  const id = currentLocationId()
  if (!id) return ''
  try {
    // Step 1 — location session.
    const lr = await origFetch('/auth/location-login', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ locationId: id }),
    })
    const ld = await lr.json().catch(() => ({}))
    if (!lr.ok || !ld.token) return ''
    setSessionToken(ld.token)

    // Step 2 — upgrade to the user session if we remember the email.
    const email = getRememberedEmail()
    if (email) {
      const ur = await origFetch('/auth/user-login', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ld.token}` },
        body:        JSON.stringify({ locationId: id, email }),
      })
      const ud = await ur.json().catch(() => ({}))
      if (ur.ok && ud.token) { setSessionToken(ud.token); return ud.token }
    }
    return ld.token
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
