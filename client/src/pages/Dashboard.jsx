import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getLocationId } from '../lib/api.js'
import { useAIConfig } from '../hooks/useAIConfig.js'
import { TYPES, TYPE_ORDER } from '../lib/types.js'
import { confirmToast, notifySuccess } from '../lib/toast.jsx'

const PAGE_SIZE = 5

function relTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function Pagination({ type, page, total, onPage }) {
  const pages = Math.ceil(total / PAGE_SIZE)
  if (pages <= 1) return null
  return (
    <div className="dash-pagination">
      <button
        className="dash-page-btn"
        disabled={page === 0}
        onClick={() => onPage(type, page - 1)}
        aria-label="Previous page"
      >
        ‹
      </button>
      <span className="dash-page-label">{page + 1} / {pages}</span>
      <button
        className="dash-page-btn"
        disabled={page === pages - 1}
        onClick={() => onPage(type, page + 1)}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const locationId = getLocationId()
  const { config } = useAIConfig()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pages, setPages] = useState({}) // { [typeKey]: pageIndex }

  useEffect(() => {
    api.getDashboard()
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setLoading(false) })
  }, [])

  function goTo(path) {
    const u = new URL(path, window.location.origin)
    if (locationId) u.searchParams.set('locationId', locationId)
    navigate(u.pathname + u.search)
  }

  function setPage(type, page) {
    setPages(prev => ({ ...prev, [type]: page }))
  }

  async function deleteCopy(e, copyId) {
    e.stopPropagation()
    if (!(await confirmToast('Move this conversation to Archive? You can restore it later.', { confirmText: 'Archive', danger: false }))) return
    setData(prev => prev ? {
      ...prev,
      recentCopies: (prev.recentCopies || []).filter(c => c.id !== copyId),
      totalCopies: Math.max(0, (prev.totalCopies ?? 1) - 1),
    } : prev)
    await api.deleteCopy(copyId).catch(() => {})   // soft-delete → archived
    notifySuccess('Moved to Archive')
  }

  if (loading) {
    return (
      <>
        <div className="topnav">
          <div className="topnav-left">
            <span className="breadcrumb-current">Dashboard</span>
          </div>
        </div>
        <div className="content" style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
          <div className="spinner" />
        </div>
      </>
    )
  }

  const allCopies    = data?.recentCopies || []
  const totalCopies  = data?.totalCopies ?? allCopies.length
  const aiReady      = !!(config?.apiKey)
  const locationName = data?.locationName || 'My Location'

  // Group by type preserving TYPE_ORDER
  const grouped = {}
  allCopies.forEach(c => {
    const t = c.type || 'general'
    if (!grouped[t]) grouped[t] = []
    grouped[t].push(c)
  })
  const orderedTypes = [...TYPE_ORDER, ...Object.keys(grouped).filter(t => !TYPE_ORDER.includes(t))]
    .filter(t => grouped[t])

  return (
    <>
      <div className="topnav">
        <div className="topnav-left">
          <span className="breadcrumb-current">Dashboard</span>
        </div>
        <div className="topnav-right">
          {aiReady ? (
            <span className="chip chip-green">
              <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
              AI Active
            </span>
          ) : (
            <span className="chip chip-red">AI not configured</span>
          )}
        </div>
      </div>

      <div className="content">
        {/* Header */}
        <div className="page-header">
          <div>
            <div className="page-title">Welcome back</div>
            <div className="page-sub">{locationName}</div>
          </div>
          <button className="btn btn-primary" onClick={() => goTo('/copywriters')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            New Copy
          </button>
        </div>

        {/* Stats */}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Total Copy</div>
            <div className="stat-value">{totalCopies}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Copywriters</div>
            <div className="stat-value">{Object.keys(TYPES).length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">AI Status</div>
            <div className="stat-value" style={{ fontSize: '1rem', marginTop: 8 }}>
              {aiReady
                ? <span className="chip chip-green">Active</span>
                : <span className="chip chip-red">Setup required</span>
              }
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Categories Used</div>
            <div className="stat-value">{orderedTypes.length}</div>
          </div>
        </div>

        {/* Recent copy — grouped by category */}
        <div className="section-title">Recent Copy</div>

        {allCopies.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✍️</div>
            <div className="empty-title">No copy yet</div>
            <div className="empty-sub">Start a conversation with a Copywriter</div>
            <button className="btn btn-primary mt-2" onClick={() => goTo('/copywriters')}>
              Open Copywriters
            </button>
          </div>
        ) : (
          <div className="dash-categories">
            {orderedTypes.map(typeKey => {
              const typeInfo = TYPES[typeKey] || TYPES.general
              const items    = grouped[typeKey]
              const page     = pages[typeKey] || 0
              const slice    = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

              return (
                <div key={typeKey} className="dash-category">
                  {/* Category header */}
                  <div className="dash-cat-header">
                    <div className="dash-cat-title">
                      <span
                        className="badge"
                        style={{ background: typeInfo.colorBg, color: typeInfo.color }}
                      >
                        {typeInfo.title}
                      </span>
                      <span className="dash-cat-count">{items.length} {items.length === 1 ? 'copy' : 'copies'}</span>
                    </div>
                    <Pagination
                      type={typeKey}
                      page={page}
                      total={items.length}
                      onPage={setPage}
                    />
                  </div>

                  {/* Rows */}
                  <div className="recent-list">
                    {slice.map(copy => {
                      const link = copy.customerId && copy.customerId !== '_unsorted'
                        ? `/library/${copy.customerId}/${copy.id}`
                        : `/library/_unsorted/${copy.id}`
                      return (
                        <div
                          key={copy.id}
                          className="recent-item"
                          onClick={() => goTo(link)}
                        >
                          <div className="recent-info">
                            <div className="recent-title">{copy.title || 'Untitled'}</div>
                            {copy.preview && (
                              <div className="recent-preview">{copy.preview}</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <div className="recent-meta">{relTime(copy.updatedAt)}</div>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--danger)', padding: '4px 6px', minHeight: 'auto' }}
                              onClick={e => deleteCopy(e, copy.id)}
                              title="Archive"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Quick access cards */}
        <div className="section-title" style={{ marginTop: 32 }}>Copywriters</div>
        <div className="card-grid">
          {Object.entries(TYPES).slice(0, 3).map(([key, type]) => (
            <div
              key={key}
              className="type-card"
              onClick={() => goTo(`/copywriters/${key}`)}
            >
              <div className="type-card-icon" style={{ background: type.colorBg }}>
                <span style={{ color: type.color, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  dangerouslySetInnerHTML={{ __html: type.icon }}
                />
              </div>
              <div>
                <h3>{type.title}</h3>
                <p className="mt-1">{type.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button className="btn btn-ghost text-sm" onClick={() => goTo('/copywriters')}>
            View all copywriters →
          </button>
        </div>
      </div>
    </>
  )
}
