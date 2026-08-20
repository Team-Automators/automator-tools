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

// Patch window.fetch once so every same-origin call carries the session token.
let installed = false
export function installAuthFetch() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const orig = window.fetch.bind(window)

  window.fetch = (input, init = {}) => {
    let protectedPath = false
    try {
      const raw = typeof input === 'string' ? input : (input && input.url) || ''
      const abs = new URL(raw, window.location.origin)
      if (abs.origin === window.location.origin) {
        protectedPath = abs.pathname.startsWith('/api') || abs.pathname.startsWith('/copywrite')
        const token = getSessionToken()
        const headers = new Headers(
          (init && init.headers) ||
          (typeof input !== 'string' && input && input.headers) ||
          {}
        )
        if (token && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`)
        }
        init = { credentials: 'include', ...init, headers }
      }
    } catch {}

    return orig(input, init).then(res => {
      // Session expired or missing on a tenant route — force a fresh login.
      if (res.status === 401 && protectedPath && window.location.pathname !== '/login') {
        clearSessionToken()
        window.location.href = '/login'
      }
      return res
    })
  }
}
