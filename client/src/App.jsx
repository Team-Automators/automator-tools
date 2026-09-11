import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import { getLocationId, persistLocationId } from './lib/api.js'
import { getSessionToken, setSessionToken, getSessionClaims, reauth } from './lib/session.js'

// Route-level code splitting: each page ships as its own chunk that loads only
// when its route is visited, so the initial bundle stays small and the app
// paints fast. Layout + Login are eager (they're on the critical first paint).
const Dashboard       = lazy(() => import('./pages/Dashboard.jsx'))
const CopywritersList = lazy(() => import('./pages/CopywritersList.jsx'))
const CopywritersChat = lazy(() => import('./pages/CopywritersChat.jsx'))
const Library         = lazy(() => import('./pages/Library.jsx'))
const CustomerDetail  = lazy(() => import('./pages/CustomerDetail.jsx'))
const LibraryChat     = lazy(() => import('./pages/LibraryChat.jsx'))
const Settings        = lazy(() => import('./pages/Settings.jsx'))
const Tasks           = lazy(() => import('./pages/Tasks.jsx'))
const Hooks           = lazy(() => import('./pages/Hooks.jsx'))
const Workflows       = lazy(() => import('./pages/Workflows.jsx'))
const Archive         = lazy(() => import('./pages/Archive.jsx'))
const Analyzer        = lazy(() => import('./pages/Analyzer.jsx'))
const FunnelArchitect = lazy(() => import('./pages/FunnelArchitect.jsx'))
const Pipeline        = lazy(() => import('./pages/Pipeline.jsx'))
const Admin           = lazy(() => import('./pages/Admin.jsx'))

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
  if (!getLocationId())          return <Navigate to="/login" replace />
  if (!getSessionToken())        return <Navigate to="/login" replace />
  if (!getSessionClaims()?.uid)  return <Navigate to="/login" replace />  // needs verified user
  // AI API key is NOT required to enter — users can explore and add it later in Settings.
  return children
}

export default function App() {
  const [booting, setBooting] = useState(true)

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
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
    </>
  )
}
