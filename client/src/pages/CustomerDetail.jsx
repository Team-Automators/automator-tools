import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, getLocationId } from '../lib/api.js'
import { TYPES, TYPE_ORDER } from '../lib/types.js'
import { TaskModal, TaskDetail, stageOf } from '../components/TaskModals.jsx'

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

// Live statuses (archived is set via delete, not shown as a picker option here).
const STATUS_OPTS = [
  { value: 'draft',       label: 'Draft',       color: '#64748B', bg: 'rgba(100,116,139,.14)' },
  { value: 'in-progress', label: 'In Progress', color: '#2563EB', bg: 'rgba(37,99,235,.14)' },
  { value: 'completed',   label: 'Completed',   color: '#16A34A', bg: 'rgba(22,163,74,.14)' },
]
const STATUS_META = Object.fromEntries(STATUS_OPTS.map(s => [s.value, s]))

export default function CustomerDetail() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const locationId = getLocationId()
  const isUnsorted = customerId === '_unsorted'

  const [customer, setCustomer] = useState(null)
  const [copies, setCopies] = useState([])
  const [tasks, setTasks] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  // Task modals
  const [editingTask, setEditingTask] = useState(null)
  const [detailTask,  setDetailTask]  = useState(null)

  // Move modal
  const [movingCopyId, setMovingCopyId] = useState(null)
  const [moveToCustId, setMoveToCustId] = useState('')

  const [renaming, setRenaming]   = useState(false)
  const [renameVal, setRenameVal] = useState('')

  async function load() {
    if (isUnsorted) {
      const [allCopies, custs] = await Promise.all([api.getCopies(), api.getCustomers()])
      const unsorted = (Array.isArray(allCopies) ? allCopies : []).filter(
        c => !c.customerId || c.customerId === '_unsorted'
      )
      setCopies(unsorted)
      setCustomers(Array.isArray(custs) ? custs : [])
      setLoading(false)
      return
    }

    const [allCopies, custs, allTasks] = await Promise.all([
      api.getCopies(customerId),
      api.getCustomers(),
      api.getTasks(),
    ])
    setCopies(Array.isArray(allCopies) ? allCopies : [])
    setTasks((Array.isArray(allTasks) ? allTasks : []).filter(t => t.customerId === customerId))
    const custs2 = Array.isArray(custs) ? custs : []
    setCustomers(custs2)
    const found = custs2.find(c => c.id === customerId)
    if (!found && !isUnsorted) {
      goLibrary()
      return
    }
    setCustomer(found || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [customerId])

  function goLibrary() {
    const u = new URL('/library', window.location.origin)
    if (locationId) u.searchParams.set('locationId', locationId)
    navigate(u.pathname + u.search)
  }

  function goCopy(copyId) {
    const u = new URL(`/library/${customerId}/${copyId}`, window.location.origin)
    if (locationId) u.searchParams.set('locationId', locationId)
    navigate(u.pathname + u.search)
  }

  function goCopywriters(type) {
    const u = new URL(`/copywriters/${type}`, window.location.origin)
    if (locationId) u.searchParams.set('locationId', locationId)
    navigate(u.pathname + u.search)
  }

  async function deleteCopy(e, copyId) {
    e.stopPropagation()
    if (!confirm('Move this conversation to Archive? You can restore it later.')) return
    setCopies(prev => prev.filter(c => c.id !== copyId))   // optimistic — leaves the live view
    await api.deleteCopy(copyId).catch(() => load())        // soft-delete → archived
  }

  async function changeStatus(e, copyId, status) {
    e.stopPropagation()
    setCopies(prev => prev.map(c => c.id === copyId ? { ...c, status } : c))
    await api.setCopyStatus(copyId, status).catch(() => load())
  }

  function startRename() {
    setRenameVal(customer?.name || '')
    setRenaming(true)
  }

  async function saveRename() {
    const name = renameVal.trim()
    if (!name || name === customer?.name) { setRenaming(false); return }
    setCustomer(c => c ? { ...c, name } : c)   // optimistic
    setRenaming(false)
    const res = await api.updateCustomer(customerId, { name }).catch(() => null)
    if (!res || res.error) load()               // revert/sync on failure
  }

  async function handleTaskSave(fields) {
    if (!editingTask?.id) return
    const updated = await api.updateTask(editingTask.id, fields).catch(() => null)
    if (updated) {
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
      if (detailTask?.id === updated.id) setDetailTask(updated)
    }
    setEditingTask(null)
  }

  function handleTaskUpdate(updated) {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    if (detailTask?.id === updated.id) setDetailTask(updated)
  }

  async function doMove() {
    if (!moveToCustId || !movingCopyId) return
    const cust = customers.find(c => c.id === moveToCustId)
    const full = await api.getCopy(movingCopyId)
    if (!full) return
    await api.updateCopy(movingCopyId, {
      messages: full.messages || [],
      customerId: moveToCustId,
      customerName: cust?.name || '',
    })
    setMovingCopyId(null)
    load()
  }

  // Group copies by type
  const grouped = {}
  copies.forEach(c => {
    const t = c.type || 'general'
    if (!grouped[t]) grouped[t] = []
    grouped[t].push(c)
  })

  const customerName = isUnsorted ? 'Unsorted' : (customer?.name || customerId)

  if (loading) return (
    <>
      <div className="topnav">
        <div className="topnav-left">
          <button className="btn btn-ghost btn-sm" onClick={goLibrary} style={{ padding: '6px 8px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <span className="breadcrumb-current">Loading…</span>
        </div>
      </div>
      <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><div className="spinner"/></div>
    </>
  )

  return (
    <>
      <div className="topnav">
        <div className="topnav-left">
          <button className="btn btn-ghost btn-sm" onClick={goLibrary} style={{ padding: '6px 8px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <span className="breadcrumb">Library</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{customerName}</span>
        </div>
      </div>

      <div className="content">
        <div className="page-header">
          <div>
            {renaming ? (
              <input
                className="form-input"
                style={{ fontSize: '1.1rem', fontWeight: 700, maxWidth: 380 }}
                value={renameVal}
                autoFocus
                onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveRename(); else if (e.key === 'Escape') setRenaming(false) }}
                onBlur={saveRename}
              />
            ) : (
              <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {customerName}
                {!isUnsorted && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 6px', minHeight: 'auto', color: 'var(--sub)' }}
                    onClick={startRename}
                    title="Rename folder"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                )}
              </div>
            )}
            {customer?.email && <div className="page-sub">{customer.email}</div>}
            <div className="page-sub">{copies.length} saved copy piece{copies.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Tasks linked to this customer */}
        {tasks.length > 0 && (
          <div className="type-group" style={{ marginBottom: 24 }}>
            <div className="type-group-header">
              <div className="type-group-title">
                <div className="type-group-icon" style={{ background: 'rgba(139,92,246,.12)', color: '#8B5CF6' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/>
                  </svg>
                </div>
                Tasks
                <span style={{ background: 'rgba(139,92,246,.12)', color: '#8B5CF6', fontSize: '.6875rem', fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>
                  {tasks.length}
                </span>
              </div>
            </div>
            <div className="copy-list">
              {tasks.map(task => {
                const stage = stageOf(task.stage)
                const notes = Array.isArray(task.notes) ? task.notes : []
                const lastNote = notes[notes.length - 1]
                return (
                  <div key={task.id} className="copy-row" onClick={() => setDetailTask(task)} style={{ cursor: 'pointer' }}>
                    <div className="copy-row-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: stage.bg, color: stage.color }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: stage.color, display: 'inline-block' }} />
                          {stage.label}
                        </span>
                        <div className="copy-row-title">{task.title}</div>
                      </div>
                      {lastNote && (
                        <div className="copy-row-meta truncate" style={{ maxWidth: '60vw' }}>{lastNote.text}</div>
                      )}
                      <div className="copy-row-meta" style={{ display: 'flex', gap: 10 }}>
                        {notes.length > 0 && <span>{notes.length} note{notes.length !== 1 ? 's' : ''}</span>}
                        {task.clickupTaskId && (
                          <a
                            href={`https://app.clickup.com/t/${task.clickupTaskId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="task-cu-detail-link"
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: '.75rem' }}
                          >
                            {task.clickupTaskName || 'ClickUp'} ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="copy-row-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Edit task"
                        onClick={e => { e.stopPropagation(); setEditingTask(task) }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        title="View notes"
                        onClick={e => { e.stopPropagation(); setDetailTask(task) }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 0 2 2z"/>
                        </svg>
                        {notes.length > 0 && <span style={{ fontSize: '.65rem', marginLeft: 2 }}>{notes.length}</span>}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {copies.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <div className="empty-title">No copy yet</div>
            <div className="empty-sub">Save from a Copywriter session to build this folder</div>
            <button className="btn btn-primary mt-2" onClick={() => goCopywriters('email')}>
              Open Copywriters
            </button>
          </div>
        ) : (
          TYPE_ORDER.filter(t => grouped[t]).map(typeKey => {
            const typeInfo = TYPES[typeKey] || TYPES.general
            return (
              <div key={typeKey} className="type-group">
                <div className="type-group-header">
                  <div className="type-group-title">
                    <div
                      className="type-group-icon"
                      style={{ background: typeInfo.colorBg, color: typeInfo.color }}
                      dangerouslySetInnerHTML={{ __html: typeInfo.icon.replace('width="18"', 'width="14"').replace('height="18"', 'height="14"') }}
                    />
                    {typeInfo.title}
                    <span style={{ background: typeInfo.colorBg, color: typeInfo.color, fontSize: '.6875rem', fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>
                      {grouped[typeKey].length}
                    </span>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => goCopywriters(typeKey)}>
                    + New
                  </button>
                </div>

                <div className="copy-list">
                  {grouped[typeKey].map(copy => (
                    <div key={copy.id} className="copy-row" onClick={() => goCopy(copy.id)}>
                      <div className="copy-row-info">
                        <div className="copy-row-title">{copy.title || 'Untitled'}</div>
                        {copy.preview && (
                          <div className="copy-row-meta truncate" style={{ maxWidth: '60vw' }}>{copy.preview}</div>
                        )}
                        <div className="copy-row-meta">{relTime(copy.updatedAt)}</div>
                      </div>
                      <div className="copy-row-actions" onClick={e => e.stopPropagation()}>
                        <select
                          className="form-input form-select"
                          value={STATUS_META[copy.status] ? copy.status : 'in-progress'}
                          onClick={e => e.stopPropagation()}
                          onChange={e => changeStatus(e, copy.id, e.target.value)}
                          title="Status"
                          style={{
                            width: 'auto', minHeight: 'auto', padding: '4px 24px 4px 10px',
                            fontSize: '.72rem', fontWeight: 700,
                            color: (STATUS_META[copy.status] || STATUS_META['in-progress']).color,
                            background: (STATUS_META[copy.status] || STATUS_META['in-progress']).bg,
                            border: 'none', borderRadius: 99,
                          }}
                        >
                          {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        {isUnsorted && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={e => { e.stopPropagation(); setMovingCopyId(copy.id); setMoveToCustId('') }}
                          >
                            Move
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)' }}
                          onClick={e => deleteCopy(e, copy.id)}
                          title="Archive"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Task edit modal */}
      {editingTask && (
        <TaskModal
          initial={editingTask}
          customers={customers}
          onSave={handleTaskSave}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* Task detail / notes panel */}
      {detailTask && (
        <TaskDetail
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onTaskUpdate={handleTaskUpdate}
        />
      )}

      {/* Move to customer modal */}
      {movingCopyId && (
        <div className="modal-backdrop" onClick={() => setMovingCopyId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Move to Customer</div>
            <div className="form-group">
              <label className="form-label">Select customer</label>
              <select
                className="form-input form-select"
                value={moveToCustId}
                onChange={e => setMoveToCustId(e.target.value)}
              >
                <option value="">Choose…</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary flex-1" onClick={doMove} disabled={!moveToCustId}>
                Move
              </button>
              <button className="btn btn-secondary" onClick={() => setMovingCopyId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
