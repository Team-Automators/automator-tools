import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import CopywritersList from './pages/CopywritersList.jsx'
import CopywritersChat from './pages/CopywritersChat.jsx'
import Library from './pages/Library.jsx'
import CustomerDetail from './pages/CustomerDetail.jsx'
import LibraryChat from './pages/LibraryChat.jsx'
import Settings from './pages/Settings.jsx'
import Tasks from './pages/Tasks.jsx'
import Hooks from './pages/Hooks.jsx'
import Workflows from './pages/Workflows.jsx'
import Archive from './pages/Archive.jsx'
import Analyzer from './pages/Analyzer.jsx'
import Pipeline from './pages/Pipeline.jsx'
import Login from './pages/Login.jsx'
import { getLocationId, persistLocationId } from './lib/api.js'
import { getSessionToken, setSessionToken, getSessionClaims } from './lib/session.js'

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
  if (getSessionToken()) return // already have a local session

  // A valid httpOnly cookie session? Restore it (and mint a bearer for the iframe).
  try {
    const s = await fetch('/auth/session', { credentials: 'include' }).then(r => r.json()).catch(() => null)
    if (s?.authenticated && s.locationId) {
      persistLocationId(s.locationId)
      // Re-issue a bearer token so requests work even where cookies are blocked.
      await silentLogin(s.locationId)
      return
    }
  } catch {}

  // GHL iframe (or a persisted id) but no session yet — verify silently.
  const id = getLocationId()
  if (id) await silentLogin(id)
}

async function silentLogin(locationId) {
  try {
    const r = await fetch('/auth/location-login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ locationId }),
    })
    const d = await r.json().catch(() => ({}))
    if (r.ok && d.token) { setSessionToken(d.token); persistLocationId(locationId) }
  } catch {}
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
  if (!hasAIConfig())            return <Navigate to="/login" replace />
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

  if (booting) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <>
      <ToastContainer position="bottom-right" autoClose={3000} newestOnTop theme="colored" pauseOnFocusLoss={false} />
      <Routes>
      <Route path="login" element={<Login />} />
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
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </>
  )
}
