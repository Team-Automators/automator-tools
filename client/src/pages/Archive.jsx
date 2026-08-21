import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getLocationId } from '../lib/api.js'

function fmtDate(ts) {
  if (!ts) return ''
  try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return '' }
}

export default function Archive() {
  const navigate = useNavigate()
  const locationId = getLocationId()

  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId]   = useState(null)

  async function load() {
    setLoading(true)
    const list = await api.getArchivedCopies()
    setItems(Array.isArray(list) ? list : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCopy(item) {
    const cust = item.customerId || '_unsorted'
    const u = new URL(`/library/${cust}/${item.id}`, window.location.origin)
    if (locationId) u.searchParams.set('locationId', locationId)
    navigate(u.pathname + u.search)
  }

  async function restore(e, id) {
    e.stopPropagation()
    setBusyId(id)
    await api.setCopyStatus(id, 'in-progress').catch(() => {})
    setItems(prev => prev.filter(i => i.id !== id))
    setBusyId(null)
  }

  async function purge(e, id) {
    e.stopPropagation()
    if (!confirm('Permanently delete this conversation? This cannot be undone.')) return
    setBusyId(id)
    await api.purgeCopy(id).catch(() => {})
    setItems(prev => prev.filter(i => i.id !== id))
    setBusyId(null)
  }

  return (
    <>
      <div className="topnav">
        <div className="topnav-left">
          <span className="breadcrumb">Library</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Archive</span>
        </div>
      </div>

      <div className="content">
        <div className="page-header">
          <div>
            <div className="page-title">Archive</div>
            <div className="page-sub">Your archived conversations — restore or permanently delete</div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗄️</div>
            <div className="empty-title">Archive is empty</div>
            <div className="empty-sub">Deleted conversations land here so you can restore them.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(item => (
              <div
                key={item.id}
                className="card"
                style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}
                onClick={() => openCopy(item)}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '.9375rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title || 'Untitled conversation'}
                  </div>
                  <div style={{ fontSize: '.78rem', color: 'var(--sub)', marginTop: 3 }}>
                    {item.customerName || 'Unsorted'} · {item.type || 'copy'} · archived {fmtDate(item.updatedAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busyId === item.id}
                    onClick={e => restore(e, item.id)}
                    title="Restore to In Progress"
                  >
                    Restore
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)' }}
                    disabled={busyId === item.id}
                    onClick={e => purge(e, item.id)}
                    title="Delete permanently"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
