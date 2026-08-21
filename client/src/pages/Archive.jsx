import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getLocationId } from '../lib/api.js'
import { confirmToast, notifySuccess } from '../lib/toast.jsx'

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
  const [selected, setSelected] = useState(() => new Set())

  async function load() {
    setLoading(true)
    const list = await api.getArchivedCopies()
    setItems(Array.isArray(list) ? list : [])
    setSelected(new Set())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const allSelected = items.length > 0 && selected.size === items.length

  function toggle(id) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map(i => i.id)))
  }

  async function bulkRestore() {
    const ids = [...selected]
    if (!ids.length) return
    setItems(prev => prev.filter(i => !selected.has(i.id)))
    setSelected(new Set())
    await Promise.all(ids.map(id => api.setCopyStatus(id, 'in-progress').catch(() => {})))
    notifySuccess(`Restored ${ids.length} conversation${ids.length !== 1 ? 's' : ''}`)
  }

  async function bulkDelete() {
    const ids = [...selected]
    if (!ids.length) return
    if (!(await confirmToast(`Permanently delete ${ids.length} conversation${ids.length !== 1 ? 's' : ''}? This cannot be undone.`, { confirmText: 'Delete' }))) return
    setItems(prev => prev.filter(i => !selected.has(i.id)))
    setSelected(new Set())
    await Promise.all(ids.map(id => api.purgeCopy(id).catch(() => {})))
    notifySuccess(`Deleted ${ids.length} conversation${ids.length !== 1 ? 's' : ''}`)
  }

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
    notifySuccess('Restored to In Progress')
  }

  async function purge(e, id) {
    e.stopPropagation()
    if (!(await confirmToast('Permanently delete this conversation? This cannot be undone.', { confirmText: 'Delete' }))) return
    setBusyId(id)
    await api.purgeCopy(id).catch(() => {})
    setItems(prev => prev.filter(i => i.id !== id))
    setBusyId(null)
    notifySuccess('Deleted permanently')
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
            {/* Bulk toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 4px 8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.8rem', color: 'var(--sub)', cursor: 'pointer' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
              </label>
              {selected.size > 0 && (
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  <button className="btn btn-secondary btn-sm" onClick={bulkRestore}>Restore selected</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={bulkDelete}>Delete selected</button>
                </div>
              )}
            </div>

            {items.map(item => (
              <div
                key={item.id}
                className="card"
                style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', borderColor: selected.has(item.id) ? 'var(--accent)' : undefined }}
                onClick={() => openCopy(item)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onClick={e => e.stopPropagation()}
                  onChange={() => toggle(item.id)}
                  style={{ flexShrink: 0 }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
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
