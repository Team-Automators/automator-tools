import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useLocationId } from '../hooks/useLocationId.js'
import { useAIConfig } from '../hooks/useAIConfig.js'
import { getLocationId } from '../lib/api.js'

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    key: 'copywriters',
    label: 'Copywriters',
    path: '/copywriters',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
  {
    key: 'library',
    label: 'Library',
    path: '/library',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    key: 'hooks',
    label: 'Hooks',
    path: '/hooks',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
  },
  {
    key: 'workflows',
    label: 'Workflows',
    path: '/workflows',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M5 3h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
        <path d="M5 13h6a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z"/>
        <path d="M17 13l4 4-4 4"/>
        <path d="M21 17h-6"/>
      </svg>
    ),
  },
  {
    key: 'tasks',
    label: 'Tasks',
    path: '/tasks',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <rect x="3" y="3" width="5" height="18" rx="1"/>
        <rect x="10" y="3" width="5" height="12" rx="1"/>
        <rect x="17" y="3" width="5" height="16" rx="1"/>
      </svg>
    ),
  },
  {
    key: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    ),
  },
]

function navPath(path) {
  const id = getLocationId()
  if (!id) return path
  const u = new URL(path === '/' ? '/' : path, 'http://x')
  u.searchParams.set('locationId', id)
  return u.pathname + u.search
}

export default function Layout() {
  useLocationId() // persist locationId from URL on first load
  const { config, loading: configLoading, locationName } = useAIConfig()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const locationId = getLocationId()
  const initials = locationId ? locationId.slice(0, 2).toUpperCase() : 'GL'

  function isActive(item) {
    const path = window.location.pathname
    if (item.path === '/') return path === '/' || path === '/dashboard'
    return path.startsWith(item.path)
  }

  return (
    <div className="app-shell">
      {/* ── Desktop Sidebar ─────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sb-logo">
          <div className="sb-logo-icon">
            <svg viewBox="0 0 24 24" fill="#fff" width="18" height="18">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <span className="sb-logo-name">Automator</span>
        </div>

        <nav className="sb-nav">
          <div className="sb-section-label">Menu</div>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.key}
              to={navPath(item.path)}
              end={item.path === '/'}
              className={({ isActive: ra }) => `nav-item ${(ra || isActive(item)) ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sb-ai-status">
          {config?.apiKey ? (
            <span className="chip chip-green" style={{ fontSize: '.72rem', gap: 5 }}>
              <svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
              AI Active
            </span>
          ) : (
            <span className="chip chip-red" style={{ fontSize: '.72rem' }}>AI not configured</span>
          )}
        </div>

        <div className="sb-user-wrap" ref={menuRef}>
          <div className="sb-user" onClick={() => setMenuOpen(v => !v)}>
            <div className="sb-avatar"><span>{initials}</span></div>
            <div className="sb-user-info">
              <div className="sb-user-name">{locationName || 'My Location'}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
              <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </div>
          {menuOpen && (
            <div className="user-menu">
              <button
                className="user-menu-item danger"
                onClick={() => {
                  localStorage.removeItem('ghl_ai_config')
                  localStorage.removeItem('ghl_session')
                  fetch('/auth/logout', { method: 'POST' }).catch(() => {})
                  window.location.href = '/login'
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────── */}
      <main className="main">
        {/* AI config warning banner */}
        {!configLoading && !config && (
          <div className="ai-banner">
            <span>No AI provider connected — set an API key to use Copywriters.</span>
            <NavLink to={navPath('/settings')} className="ai-banner-link">
              Set up AI →
            </NavLink>
          </div>
        )}

        <Outlet />
      </main>

      {/* ── Mobile bottom nav ────────────────────────────────────── */}
      <nav className="mobile-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.key}
            to={navPath(item.path)}
            end={item.path === '/'}
            className={({ isActive: ra }) => `mobile-nav-item ${(ra || isActive(item)) ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
