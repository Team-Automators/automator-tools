import { Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import Layout from './components/Layout.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Login from './pages/Login.jsx'
import { getLocationId, persistLocationId } from './lib/api.js'
import { getSessionToken, setSessionToken, getSessionClaims, reauth } from './lib/session.js'

// Route-level code splitting lives in ./routes.jsx — each page is its own chunk,
// loaded on demand, and preloadable on hover/idle so navigation feels instant.
import {
  Dashboard, CopywritersList, CopywritersChat, Library, CustomerDetail, LibraryChat,
  Settings, Tasks, Hooks, Workflows, Archive, Analyzer, FunnelArchitect, Pipeline, Admin,
} from './routes.jsx'

function hasAIConfig() {
  try { return !!JSON.parse(localStorage.getItem('ghl_ai_config'))?.apiKey } catch { return false }
}

// Boot-time authentication detection.
// Recognizes an already-authenticated app before rendering, covering:
//   • a returning localStorage session (fast path)
//   • a still-valid server session cookie (GET /auth/session)
//   • the GHL-embedded context — locationId in the URL for an already-installed
//     agency — which we can authenticate silently, no manual entry.
async function bootstrapAuth() {
  // On the login page, never attempt a silent re-auth — it would block rendering
  // (blank/spinner) while a network round-trip runs. Let the login screen show.
  if (window.location.pathname === '/login') return

  // If we already hold a VALID (unexpired) user session, keep it.
  const claims = getSessionClaims()
  if (claims?.uid && claims.exp && Date.now() < claims.exp) return

  // A valid httpOnly cookie session? Restore the location id first.
  try {
    const s = await fetch('/auth/session', { credentials: 'include' }).then(r => r.json()).catch(() => null)
    if (s?.authenticated && s.locationId) persistLocationId(s.locationId)
  } catch {}

  // GHL iframe (or a persisted id) — silently restore the FULL user session
  // (location-login → user-login using the remembered email) so we're not
  // bounced to /login when the old token lapses.
  const id = getLocationId()
  if (id) { await reauth(); persistLocationId(id) }
}

// Forces a full remount of CopywritersChat when the type param changes,
// so useState re-reads the correct localStorage key instead of reusing stale state.
function CopywritersChatKeyed() {
  const { type } = useParams()
  return <CopywritersChat key={type} />
}

function RequireLocation({ children }) {
  const authed = getLocationId() && getSessionToken() && getSessionClaims()?.uid
  if (authed) return children  // AI API key is NOT required — users add it later in Settings
  // On the server we can't always see auth (the GHL iframe blocks the cookie, so
  // only the browser's localStorage knows) — render nothing and let the client
  // decide routing, instead of redirecting and possibly bouncing a valid user.
  if (typeof window === 'undefined') return null
  return <Navigate to="/login" replace />
}

export default function App() {
  // Initial boot state must be identical on the server and on the client's first
  // (hydration) render, so it's derived only from what BOTH can see: the injected
  // session claims. If we already hold a valid user session, render immediately;
  // never block during SSR; only the client, when it genuinely needs a silent
  // re-auth, shows the boot spinner.
  const [booting, setBooting] = useState(() => {
    const claims = getSessionClaims()
    if (claims?.uid && claims.exp && Date.now() < claims.exp) return false
    if (typeof window === 'undefined') return false
    if (window.location.pathname === '/login') return false
    return true
  })

  // Detect an existing authenticated state before rendering the route gate,
  // so an already-authenticated app is never bounced to the login screen.
  useEffect(() => {
    let alive = true
    bootstrapAuth().finally(() => { if (alive) setBooting(false) })
    return () => { alive = false }
  }, [])

  // Heartbeat: tell the server we're online (drives online/offline in Admin).
  useEffect(() => {
    const ping = () => { try { if (getSessionClaims()?.uid) fetch('/auth/ping', { method: 'POST' }).catch(() => {}) } catch {} }
    ping()
    const id = setInterval(ping, 60000)
    const onVis = () => { if (document.visibilityState === 'visible') ping() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  const Loading = (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spinner" />
    </div>
  )

  if (booting) return Loading

  return (
    <>
      <ToastContainer position="bottom-right" autoClose={3000} newestOnTop theme="colored" pauseOnFocusLoss={false} />
      <ErrorBoundary>
      <Suspense fallback={Loading}>
      <Routes>
      <Route path="login" element={<Login />} />
      <Route path="admin" element={<Admin />} />
      <Route element={<RequireLocation><Layout /></RequireLocation>}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="copywriters" element={<CopywritersList />} />
        <Route path="copywriters/:type" element={<CopywritersChatKeyed />} />
        <Route path="library" element={<Library />} />
        <Route path="library/:customerId" element={<CustomerDetail />} />
        <Route path="library/:customerId/:copyId" element={<LibraryChat />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="hooks" element={<Hooks />} />
        <Route path="workflows" element={<Workflows />} />
        <Route path="archive" element={<Archive />} />
        <Route path="analyzer" element={<Analyzer />} />
        <Route path="architect" element={<FunnelArchitect />} />
        <Route path="website" element={<FunnelArchitect kind="website" />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
    </ErrorBoundary>
    </>
  )
}
