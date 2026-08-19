import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getLocationId } from '../lib/api.js'
import { TaskModal, TaskDetail, stageOf } from '../components/TaskModals.jsx'

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

export default function Library() {
  const navigate = useNavigate()
  const locationId = getLocationId()

  const [customers, setCustomers] = useState([])
  const [counts, setCounts] = useState({})
  const [unsortedCount, setUnsortedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [creating, setCreating] = useState(false)

  const [allTasks, setAllTasks] = useState([])
  const [taskCounts, setTaskCounts] = useState({})

  // Task panel state
  const [panelCustomer, setPanelCustomer] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [detailTask, setDetailTask] = useState(null)

  async function load() {
    const [custs, copies, tasks] = await Promise.all([
      api.getCustomers(),
      api.getCopies(),
      api.getTasks(),
    ])
    setCustomers(Array.isArray(custs) ? custs : [])

    const cmap = {}
    let unsorted = 0
    ;(Array.isArray(copies) ? copies : []).forEach(c => {
      if (!c.customerId || c.customerId === '_unsorted') {
        unsorted++
      } else {
        cmap[c.customerId] = (cmap[c.customerId] || 0) + 1
      }
    })
    setCounts(cmap)
    setUnsortedCount(unsorted)

    const taskList = Array.isArray(tasks) ? tasks : []
    setAllTasks(taskList)
    const tmap = {}
    taskList.forEach(t => {
      if (t.customerId) tmap[t.customerId] = (tmap[t.customerId] || 0) + 1
    })
    setTaskCounts(tmap)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function goCustomer(id) {
    const u = new URL(`/library/${id}`, window.location.origin)
    if (locationId) u.searchParams.set('locationId', locationId)
    navigate(u.pathname + u.search)
  }

  async function createCustomer() {
    if (!newName.trim()) return
    setCreating(true)
    const cust = await api.createCustomer(newName.trim(), newEmail.trim())
    setCreating(false)
    setShowForm(false)
    setNewName('')
    setNewEmail('')
    await load()
    goCustomer(cust.id)
  }

  async function deleteCustomer(e, id) {
    e.stopPropagation()
    if (!confirm('Delete this customer and remove them from all copies?')) return
    await api.deleteCustomer(id)
    load()
  }

  function openTaskPanel(e, customer) {
    e.stopPropagation()
    setPanelCustomer(customer)
  }

  async function handleTaskSave(fields) {
    if (!editingTask?.id) return
    const updated = await api.updateTask(editingTask.id, fields).catch(() => null)
    if (updated) {
      setAllTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
      if (detailTask?.id === updated.id) setDetailTask(updated)
    }
    setEditingTask(null)
  }

  function handleTaskUpdate(updated) {
    setAllTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    if (detailTask?.id === updated.id) setDetailTask(updated)
  }

  const panelTasks = panelCustomer
    ? allTasks.filter(t => t.customerId === panelCustomer.id)
    : []

  if (loading) return (
    <>
      <div className="topnav">
        <div className="topnav-left"><span className="breadcrumb-current">Library</span></div>
      </div>
      <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><div className="spinner"/></div>
    </>
  )

  return (
    <>
      <div className="topnav">
        <div className="topnav-left">
          <span className="breadcrumb">Dashboard</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Library</span>
        </div>
        <div className="topnav-right">
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Customer
          </button>
        </div>
      </div>

      <div className="content">
        <div className="page-header">
          <div>
            <div className="page-title">Copy Library</div>
            <div className="page-sub">Organize generated copy by customer</div>
          </div>
        </div>

        {/* New customer form */}
        {showForm && (
          <div className="card" style={{ padding: 20, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="fw-700" style={{ fontSize: '.9375rem' }}>New Customer</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
                <label className="form-label">Name *</label>
                <input
                  className="form-input"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Acme Corp"
                  onKeyDown={e => e.key === 'Enter' && createCustomer()}
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
                <label className="form-label">Email (optional)</label>
                <input
                  className="form-input"
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="name@company.com"
                  onKeyDown={e => e.key === 'Enter' && createCustomer()}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={createCustomer} disabled={creating || !newName.trim()}>
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Customer grid */}
        {customers.length === 0 && unsortedCount === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <div className="empty-title">No copy saved yet</div>
            <div className="empty-sub">Save copy from a Copywriter session to build your library</div>
          </div>
        ) : (
          <div className="customer-grid">
            {/* Unsorted folder */}
            {unsortedCount > 0 && (
              <div className="customer-card unsorted" onClick={() => goCustomer('_unsorted')}>
                <div className="customer-avatar" style={{ fontSize: '1.25rem' }}>📂</div>
                <div className="customer-name">Unsorted</div>
                <div className="customer-meta">{unsortedCount} saved copy piece{unsortedCount !== 1 ? 's' : ''}</div>
              </div>
            )}

            {/* Real customers */}
            {customers.map(c => (
              <div key={c.id} className="customer-card" onClick={() => goCustomer(c.id)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div className="customer-avatar">{initials(c.name)}</div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)', padding: '4px 6px', minHeight: 'auto' }}
                    onClick={e => deleteCustomer(e, c.id)}
                    title="Delete customer"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
                    </svg>
                  </button>
                </div>
                <div className="customer-name">{c.name}</div>
                {c.email && <div className="customer-meta">{c.email}</div>}
                <div className="customer-meta">{counts[c.id] || 0} copy piece{counts[c.id] !== 1 ? 's' : ''}</div>
                {taskCounts[c.id] > 0 && (
                  <button
                    className="lib-task-badge"
                    onClick={e => openTaskPanel(e, c)}
                    title="View & edit tasks"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/>
                    </svg>
                    {taskCounts[c.id]} task{taskCounts[c.id] !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task panel slide-over */}
      {panelCustomer && (
        <div className="modal-backdrop" onClick={() => setPanelCustomer(null)}>
          <div className="lib-task-panel" onClick={e => e.stopPropagation()}>
            <div className="lib-task-panel-header">
              <div>
                <div className="lib-task-panel-title">{panelCustomer.name}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--sub)', marginTop: 2 }}>
                  {panelTasks.length} task{panelTasks.length !== 1 ? 's' : ''}
                </div>
              </div>
              <button className="task-detail-close" onClick={() => setPanelCustomer(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="18" height="18">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="lib-task-panel-body">
              {panelTasks.map(task => {
                const stage = stageOf(task.stage)
                const notes = Array.isArray(task.notes) ? task.notes : []
                const lastNote = notes[notes.length - 1]
                return (
                  <div key={task.id} className="lib-task-row">
                    <div className="lib-task-row-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: '.68rem', fontWeight: 700, padding: '2px 7px',
                          borderRadius: 99, background: stage.bg, color: stage.color,
                          flexShrink: 0,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: stage.color, display: 'inline-block' }} />
                          {stage.label}
                        </span>
                        <div style={{ fontSize: '.875rem', fontWeight: 600 }}>{task.title}</div>
                      </div>
                      {lastNote && (
                        <div style={{ fontSize: '.75rem', color: 'var(--sub)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lastNote.text}
                        </div>
                      )}
                      {notes.length > 0 && (
                        <div style={{ fontSize: '.7rem', color: 'var(--sub)', marginTop: 2 }}>
                          {notes.length} note{notes.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        className="task-icon-btn"
                        title="Edit task"
                        onClick={() => setEditingTask(task)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        className="task-icon-btn"
                        title="View notes"
                        onClick={() => setDetailTask(task)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Task edit modal */}
      {editingTask && (
        <TaskModal
          initial={editingTask}
          customers={customers}
          onSave={handleTaskSave}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* Task notes panel */}
      {detailTask && (
        <TaskDetail
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onTaskUpdate={handleTaskUpdate}
        />
      )}
    </>
  )
}
