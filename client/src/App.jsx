import { Routes, Route, Navigate, useParams } from 'react-router-dom'
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
import Login from './pages/Login.jsx'
import { getLocationId } from './lib/api.js'
import { getSessionToken } from './lib/session.js'

function hasAIConfig() {
  try { return !!JSON.parse(localStorage.getItem('ghl_ai_config'))?.apiKey } catch { return false }
}

// Forces a full remount of CopywritersChat when the type param changes,
// so useState re-reads the correct localStorage key instead of reusing stale state.
function CopywritersChatKeyed() {
  const { type } = useParams()
  return <CopywritersChat key={type} />
}

function RequireLocation({ children }) {
  if (!getLocationId())    return <Navigate to="/login" replace />
  if (!getSessionToken())  return <Navigate to="/login" replace />
  if (!hasAIConfig())      return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
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
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
