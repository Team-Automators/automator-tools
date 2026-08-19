import { useState, useEffect, useRef } from 'react'
import { api, getLocationId } from '../lib/api.js'

export const STAGES = [
  { id: 'urgent',       label: 'Urgent',      color: '#EF4444', bg: 'rgba(239,68,68,.12)' },
  { id: 'in-progress',  label: 'In Progress', color: '#3B82F6', bg: 'rgba(59,130,246,.12)' },
  { id: 'blocked',      label: 'Blocked',     color: '#F97316', bg: 'rgba(249,115,22,.12)' },
  { id: 'for-later',    label: 'For Later',   color: '#8B5CF6', bg: 'rgba(139,92,246,.12)' },
  { id: 'done',         label: 'Done',        color: '#22C55E', bg: 'rgba(34,197,94,.12)' },
]
const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]))
export function stageOf(id) { return STAGE_MAP[id] || STAGES[0] }
export function formatDate(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
export function getNotes(task) { return Array.isArray(task.notes) ? task.notes : [] }

// ── Task detail panel (notes feed) ────────────────────────────────────────────
export function TaskDetail({ task: initialTask, onClose, onTaskUpdate }) {
  const [task,     setTask]     = useState(initialTask)
  const [noteText, setNoteText] = useState('')
  const [adding,   setAdding]   = useState(false)
  const [deleting, setDeleting] = useState(null)
  const notesEndRef = useRef(null)

  const notes = getNotes(task)
  const stage = stageOf(task.stage)

  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [notes.length])

  async function handleAddNote(e) {
    e.preventDefault()
    const text = noteText.trim()
    if (!text) return
    setAdding(true)
    const updated = await api.addNote(task.id, text).catch(() => null)
    setAdding(false)
    if (updated && updated.id) { setTask(updated); onTaskUpdate(updated); setNoteText('') }
  }

  async function handleDeleteNote(noteId) {
    setDeleting(noteId)
    const updated = await api.deleteNote(task.id, noteId).catch(() => null)
    setDeleting(null)
    if (updated && updated.id) { setTask(updated); onTaskUpdate(updated) }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote(e)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="task-detail-panel" onClick={e => e.stopPropagation()}>
        <div className="task-detail-header">
          <div className="task-detail-title-row">
            <span className="task-stage-dot" style={{ background: stage.color, width: 9, height: 9 }} />
            <div className="task-detail-title">{task.title}</div>
          </div>
          <div className="task-detail-meta">
            <span className="kanban-col-badge" style={{ background: stage.bg, color: stage.color, fontSize: '.7rem' }}>
              {stage.label}
            </span>
            {task.customerName && (
              <span className="task-customer-chip" style={{ cursor: 'default' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                {task.customerName}
              </span>
            )}
            {task.clickupTaskId && (
              <a href={`https://app.clickup.com/t/${task.clickupTaskId}`} target="_blank"
                rel="noopener noreferrer" className="task-cu-detail-link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                {task.clickupTaskName || 'Open in ClickUp'} ↗
              </a>
            )}
          </div>
          <button className="task-detail-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="task-detail-notes">
          {notes.length === 0 ? (
            <div className="task-notes-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32"
                style={{ color: 'var(--border)', marginBottom: 8 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <div style={{ fontSize: '.8125rem', color: 'var(--sub)' }}>No notes yet — add the first one below</div>
            </div>
          ) : notes.map(note => (
            <div key={note.id} className="task-note-item">
              <div className="task-note-bubble">
                <div className="task-note-text">{note.text}</div>
                <div className="task-note-footer">
                  <span className="task-note-date">{formatDate(note.createdAt)}</span>
                  {note.clickupPushed === true && (
                    <span className="note-cu-pill note-cu-ok">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>
                      ClickUp
                    </span>
                  )}
                  {note.clickupPushed === false && (
                    <span className="note-cu-pill note-cu-fail" title="Failed to push to ClickUp">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="10" height="10"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      ClickUp
                    </span>
                  )}
                  <button className="task-note-delete" onClick={() => handleDeleteNote(note.id)}
                    disabled={deleting === note.id} title="Delete note">
                    {deleting === note.id ? '…' : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div ref={notesEndRef} />
        </div>

        <form className="task-detail-add" onSubmit={handleAddNote}>
          <textarea className="task-note-input" placeholder="Add a note… (Ctrl+Enter to submit)"
            value={noteText} onChange={e => setNoteText(e.target.value)}
            onKeyDown={handleKey} rows={3} disabled={adding} />
          <button className="btn btn-primary" type="submit"
            disabled={!noteText.trim() || adding} style={{ alignSelf: 'flex-end' }}>
            {adding ? 'Adding…' : 'Add Note'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Create / Edit modal ───────────────────────────────────────────────────────
export function TaskModal({ initial, customers, onSave, onClose }) {
  const [title,        setTitle]        = useState(initial?.title || '')
  const [stage,        setStage]        = useState(initial?.stage || 'urgent')
  const [customerId,   setCustomerId]   = useState(initial?.customerId || '')
  const [customerName, setCustomerName] = useState(initial?.customerName || '')
  const [saving,       setSaving]       = useState(false)

  const [cuTaskId,      setCuTaskId]      = useState(initial?.clickupTaskId   || '')
  const [cuTaskName,    setCuTaskName]    = useState(initial?.clickupTaskName || '')
  const [cuSpaces,      setCuSpaces]      = useState([])
  const [cuSpaceId,     setCuSpaceId]     = useState('')
  const [cuLists,       setCuLists]       = useState([])
  const [cuListId,      setCuListId]      = useState('')
  const [cuTasks,       setCuTasks]       = useState([])
  const [loadingSpaces, setLoadingSpaces] = useState(false)
  const [loadingLists,  setLoadingLists]  = useState(false)
  const [loadingTasks,  setLoadingTasks]  = useState(false)
  const [cuError,       setCuError]       = useState('')
  const [cuDebug,       setCuDebug]       = useState(null)

  const isEdit = !!initial?.id

  useEffect(() => {
    setLoadingSpaces(true)
    api.getClickupWorkspaces()
      .then(ws => { if (Array.isArray(ws) && ws.length) return api.getClickupSpaces(ws[0].id) })
      .then(spaces => { if (spaces) setCuSpaces(spaces) })
      .catch(() => setCuError('Could not load ClickUp spaces'))
      .finally(() => setLoadingSpaces(false))
  }, [])

  async function handleSpaceChange(e) {
    const spaceId = e.target.value
    setCuSpaceId(spaceId); setCuLists([]); setCuListId(''); setCuTasks([])
    setCuTaskId(''); setCuTaskName(''); setCuError('')
    if (!spaceId) return
    setLoadingLists(true)
    try {
      const content = await api.getClickupSpaceContent(spaceId)
      const folderless = content.lists || []
      const folderListArrays = await Promise.all(
        (content.folders || []).map(f =>
          api.getClickupFolderLists(f.id).then(ls => ls.map(l => ({ ...l, folderName: f.name }))).catch(() => [])
        )
      )
      setCuLists([...folderless, ...folderListArrays.flat()])
    } catch { setCuError('Could not load lists') }
    finally { setLoadingLists(false) }
  }

  async function handleListChange(e) {
    const listId = e.target.value
    setCuListId(listId); setCuTasks([]); setCuTaskId(''); setCuTaskName(''); setCuError(''); setCuDebug(null)
    if (!listId) return
    setLoadingTasks(true)
    try {
      const tasks = await api.getClickupListTasks(listId)
      setCuTasks(Array.isArray(tasks) ? tasks : [])
    } catch (err) { setCuError(err.message || 'Could not load tasks') }
    finally { setLoadingTasks(false) }
  }

  async function runDebug() {
    if (!cuListId) return
    setCuDebug('loading')
    try {
      const url = new URL(`/api/clickup/debug/list/${cuListId}`, window.location.origin)
      url.searchParams.set('locationId', getLocationId())
      const r = await fetch(url.toString())
      setCuDebug(await r.json())
    } catch (e) { setCuDebug({ error: e.message }) }
  }

  function handleTaskChange(e) {
    const id = e.target.value
    if (!id) { setCuTaskId(''); setCuTaskName(''); return }
    const t = cuTasks.find(r => r.id === id)
    if (t) { setCuTaskId(t.id); setCuTaskName(t.name) }
  }

  function unlinkClickup() { setCuTaskId(''); setCuTaskName('') }

  async function handleSave(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    await onSave({ title: title.trim(), stage, customerId, customerName, clickupTaskId: cuTaskId, clickupTaskName: cuTaskName })
    setSaving(false)
  }

  function handleCustomerChange(e) {
    const id = e.target.value
    setCustomerId(id)
    const found = customers.find(c => c.id === id)
    setCustomerName(found ? found.name : '')
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">{isEdit ? 'Edit Task' : 'New Task'}</div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Describe the task…" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Stage</label>
            <select className="form-input form-select" value={stage} onChange={e => setStage(e.target.value)}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Customer (optional)</label>
            <select className="form-input form-select" value={customerId} onChange={handleCustomerChange}>
              <option value="">— No customer —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">ClickUp Task (optional)</label>
            {cuTaskId ? (
              <div className="cu-linked-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="#7B68EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span className="cu-linked-name">{cuTaskName || cuTaskId}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={unlinkClickup}>Unlink</button>
              </div>
            ) : loadingSpaces ? (
              <div className="cu-cascade-loading">Loading ClickUp…</div>
            ) : (
              <div className="cu-cascade">
                <select className="form-input form-select" value={cuSpaceId} onChange={handleSpaceChange}>
                  <option value="">— Select space —</option>
                  {cuSpaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {cuSpaceId && (loadingLists ? (
                  <div className="cu-cascade-loading">Loading lists…</div>
                ) : (
                  <select className="form-input form-select" value={cuListId} onChange={handleListChange}>
                    <option value="">— Select list —</option>
                    {cuLists.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.folderName ? `${l.folderName} / ${l.name}` : l.name}
                      </option>
                    ))}
                  </select>
                ))}
                {cuListId && (loadingTasks ? (
                  <div className="cu-cascade-loading">Loading tasks…</div>
                ) : cuTasks.length > 0 ? (
                  <select className="form-input form-select" value={cuTaskId} onChange={handleTaskChange}>
                    <option value="">— Select task ({cuTasks.length}) —</option>
                    {cuTasks.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.parent ? `  ↳ ${t.name}` : t.name}
                        {t.status?.status ? ` (${t.status.status})` : ''}
                      </option>
                    ))}
                  </select>
                ) : !cuError ? (
                  <div style={{ fontSize: '.8125rem', color: 'var(--sub)', padding: '4px 0' }}>No tasks found in this list</div>
                ) : null)}
              </div>
            )}
            {cuError && (
              <div style={{ fontSize: '.75rem', color: 'var(--danger)', marginTop: 6, padding: '6px 10px', background: 'var(--danger-bg)', borderRadius: 6 }}>
                {cuError}
              </div>
            )}
            {cuListId && !loadingTasks && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '.7rem', marginTop: 6 }} onClick={runDebug}>
                {cuDebug === 'loading' ? 'Checking…' : '🔍 Debug: inspect list response'}
              </button>
            )}
            {cuDebug && cuDebug !== 'loading' && (
              <pre style={{ fontSize: '.65rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: 8, marginTop: 4, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflowY: 'auto' }}>
                {JSON.stringify(cuDebug, null, 2)}
              </pre>
            )}
          </div>

          <div className="modal-actions">
            <button className="btn btn-primary flex-1" type="submit" disabled={!title.trim() || saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
