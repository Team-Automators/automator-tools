import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { api } from '../lib/api.js'
import { confirmToast, notifySuccess, notifyError } from '../lib/toast.jsx'
import { SERVICES, SVC } from '../lib/services.js'
import { stageOf, TaskModal } from '../components/TaskModals.jsx'

// The Pipeline is a synchronized VIEW of Tasks: every task that has a Service
// assigned shows up here as a card in that service's column. Tasks are the
// single source of truth — completing/removing/re-tagging a task here writes
// straight back to the task, and the Tasks tab reflects it (and vice-versa).

const DAY = 86400000
const today = () => new Date().toISOString().slice(0, 10)
const toDateStr = (ts) => new Date(ts).toISOString().slice(0, 10)
function daysBetween(dateStr) {
  if (!dateStr) return 0
  const d = new Date(dateStr + 'T00:00:00')
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY))
}
function fmtDate(v) {
  if (!v) return ''
  const d = typeof v === 'number' ? new Date(v) : new Date(v + 'T00:00:00')
  return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' })
}
function monthKey(ts) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function monthLabel(key) { const [y, m] = key.split('-'); return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) }

// Task → pipeline engagement (a card). Only tasks WITH a service appear.
function toEng(t) {
  const completed = t.stage === 'done'
  return {
    id:           t.id,
    title:        t.title,
    clientName:   t.customerName || 'Unassigned',
    customerId:   t.customerId || '',
    service:      t.service,
    stage:        t.stage,
    assignedDate: toDateStr(t.createdAt),
    dueDate:      t.dueDate || '',
    waitingOn:    t.waitingOn || '',
    status:       completed ? 'completed' : 'active',
    finishedAt:   completed ? (t.updatedAt || t.createdAt) : null,
    createdAt:    t.createdAt,
  }
}
function isOverdue(e) {
  return e.status === 'active' && e.dueDate && new Date(e.dueDate + 'T23:59:59').getTime() < Date.now()
}

export default function Pipeline() {
  const [tasks, setTasks]     = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView]       = useState('board')     // 'board' | 'completed'
  const [search, setSearch]   = useState('')
  const [addCol, setAddCol]   = useState(null)         // service key being added to
  const [addTitle, setAddTitle] = useState('')
  const [addClient, setAddClient] = useState('')       // customerId
  const [addDue, setAddDue]   = useState('')
  const [analytics, setAnalytics] = useState('monthly')
  const [selMonth, setSelMonth]   = useState(null)
  const [editId, setEditId]       = useState(null)   // task id being edited in the modal
  const fileRef = useRef(null)

  async function load() {
    setLoading(true)
    const [t, c] = await Promise.all([api.getTasks(), api.getCustomers()])
    setTasks(Array.isArray(t) ? t : [])
    setCustomers(Array.isArray(c) ? c : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Only tasks that have been tagged with a service belong to the pipeline.
  const items = useMemo(() => tasks.filter(t => t.service && SVC[t.service]).map(toEng), [tasks])

  const q = search.trim().toLowerCase()
  const visible = q ? items.filter(e => (e.clientName || '').toLowerCase().includes(q) || (e.title || '').toLowerCase().includes(q)) : items
  const active = visible.filter(e => e.status === 'active')
  const completed = visible.filter(e => e.status === 'completed')

  // Distinct services per client (for the "N svc" dots on a card)
  const svcByClient = useMemo(() => {
    const m = {}
    active.forEach(e => { (m[e.clientName] ||= new Set()).add(e.service) })
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]]))
  }, [active])

  const stats = {
    total: items.length,
    active: items.filter(e => e.status === 'active').length,
    overdue: items.filter(isOverdue).length,
    completed: items.filter(e => e.status === 'completed').length,
  }

  // ── Mutations write back to the underlying task ──────────────────────────────
  function patchTask(id, fields) { setTasks(prev => prev.map(t => t.id === id ? { ...t, ...fields, updatedAt: Date.now() } : t)) }

  async function addTask(serviceKey) {
    const title = addTitle.trim()
    if (!title) return
    const cust = customers.find(c => c.id === addClient)
    const created = await api.createTask({
      title, service: serviceKey, stage: 'urgent',
      customerId: addClient || '', customerName: cust?.name || '',
      dueDate: addDue || '',
    }).catch(() => null)
    if (created?.id) setTasks(prev => [...prev, created])
    setAddCol(null); setAddTitle(''); setAddClient(''); setAddDue('')
  }
  async function complete(e) {
    patchTask(e.id, { stage: 'done' })
    await api.updateTask(e.id, { stage: 'done' }).catch(() => load())
    notifySuccess('Marked complete')
  }
  async function reopen(e) {
    patchTask(e.id, { stage: 'in-progress' })
    await api.updateTask(e.id, { stage: 'in-progress' }).catch(() => load())
  }
  async function setWaiting(e, waitingOn) {
    patchTask(e.id, { waitingOn })
    await api.updateTask(e.id, { waitingOn }).catch(() => load())
  }
  async function setDue(e, dueDate) {
    patchTask(e.id, { dueDate })
    await api.updateTask(e.id, { dueDate }).catch(() => load())
  }
  // Full edit (title / stage / customer / service / due) — lets a card move
  // to any service column or stage, or be re-assigned to another client.
  const editTask = editId ? tasks.find(t => t.id === editId) : null
  async function saveEdit(fields) {
    const updated = await api.updateTask(editId, fields).catch(() => null)
    if (updated?.id) setTasks(prev => prev.map(t => t.id === editId ? updated : t))
    else await load()
    setEditId(null)
  }
  async function removeEng(e) {
    if (!(await confirmToast(`Delete task "${e.title}"? This removes it from Tasks and Pipeline.`, { confirmText: 'Delete' }))) return
    setTasks(prev => prev.filter(t => t.id !== e.id))
    await api.deleteTask(e.id).catch(() => load())
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `pipeline-backup-${today()}.json`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }
  function onImport(ev) {
    const file = ev.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '[]'))
        const arr = Array.isArray(parsed) ? parsed : parsed.items
        if (!Array.isArray(arr)) throw new Error('Invalid backup file')
        const valid = arr.filter(e => e.service && SVC[e.service])
        if (!valid.length) throw new Error('No valid pipeline items in file')
        if (!(await confirmToast(`Import ${valid.length} item(s) as new tasks?`, { confirmText: 'Import' }))) return
        const created = []
        for (const e of valid) {
          const t = await api.createTask({
            title: e.title || e.clientName || 'Imported', service: e.service,
            customerName: e.clientName === 'Unassigned' ? '' : (e.clientName || ''),
            dueDate: e.dueDate || '', waitingOn: e.waitingOn || '',
            stage: e.status === 'completed' ? 'done' : 'urgent',
          }).catch(() => null)
          if (t?.id) created.push(t)
        }
        setTasks(prev => [...prev, ...created])
        notifySuccess(`Imported ${created.length}`)
      } catch (e) { notifyError(e.message || 'Import failed') }
    }
    reader.readAsText(file)
    ev.target.value = ''
  }

  // ── Analytics (completed tasks by finish month/year × service) ───────────────
  const buckets = useMemo(() => {
    const done = items.filter(e => e.status === 'completed' && e.finishedAt)
    if (analytics === 'monthly') {
      const keys = []
      const now = new Date()
      for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
      return keys.map(k => ({ key: k, label: monthLabel(k), rows: done.filter(e => monthKey(e.finishedAt) === k) }))
    }
    const years = {}
    done.forEach(e => { const y = String(new Date(e.finishedAt).getFullYear()); (years[y] ||= []).push(e) })
    return Object.keys(years).sort().map(y => ({ key: y, label: y, rows: years[y] }))
  }, [items, analytics])

  const maxCount = Math.max(1, ...buckets.map(b => b.rows.length))
  const sel = buckets.find(b => b.key === selMonth) || [...buckets].reverse().find(b => b.rows.length) || buckets[buckets.length - 1]

  const stat = (n, label, color) => (
    <div style={{ textAlign: 'center', padding: '6px 16px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: color || 'var(--text)' }}>{n}</div>
      <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--sub)' }}>{label}</div>
    </div>
  )

  return (
    <>
      <div className="topnav">
        <div className="topnav-left"><span className="breadcrumb-current">Pipeline</span></div>
        <div className="topnav-right" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 8, padding: 3 }}>
            <button className={`btn btn-sm ${view === 'board' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('board')}>Board</button>
            <button className={`btn btn-sm ${view === 'clients' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('clients')}>By Client</button>
            <button className={`btn btn-sm ${view === 'completed' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('completed')}>Completed Clients</button>
          </div>
          <input className="form-input" style={{ width: 200, height: 34 }} placeholder="Search client or task…" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-secondary btn-sm" onClick={exportBackup}>Export Backup</button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={onImport} style={{ display: 'none' }} />
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>Import Backup</button>
        </div>
      </div>

      <div className="content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <div className="page-title" style={{ marginRight: 8 }}>Client Pipeline Tracker</div>
          {stat(stats.total, 'TOTAL')}
          {stat(stats.active, 'ACTIVE', '#D97706')}
          {stat(stats.overdue, 'OVERDUE', stats.overdue ? 'var(--danger)' : 'var(--sub)')}
          {stat(stats.completed, 'COMPLETED', '#16A34A')}
        </div>
        <div style={{ fontSize: '.78rem', color: 'var(--sub)', marginBottom: 18 }}>
          Synced with <b>Tasks</b> — every task tagged with a service appears here. Set a task's Service in the Tasks tab or via <b>+ Add Task</b> below.
        </div>

        {loading ? (
          <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
        ) : view === 'board' ? (
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
            {SERVICES.map(svc => {
              const colItems = active.filter(e => e.service === svc.key)
              const overdueN = colItems.filter(isOverdue).length
              const doneN = items.filter(e => e.service === svc.key && e.status === 'completed').length
              return (
                <div key={svc.key} style={{ minWidth: 260, width: 260, flexShrink: 0, background: 'var(--surface)', borderRadius: 12, borderTop: `3px solid ${svc.color}`, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--text)' }}>{svc.label}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--sub)', marginTop: 2 }}>
                      {colItems.length} active · {overdueN} overdue · {doneN} completed
                    </div>
                  </div>

                  <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto' }}>
                    {colItems.map(e => {
                      const wait = e.waitingOn
                      const bg = wait === 'client' ? 'rgba(245,158,11,.10)' : wait === 'consultant' ? 'rgba(124,58,237,.10)' : 'var(--card)'
                      const bd = isOverdue(e) ? 'var(--danger)' : wait === 'client' ? 'rgba(245,158,11,.4)' : wait === 'consultant' ? 'rgba(124,58,237,.4)' : 'var(--border)'
                      const clientSvcs = svcByClient[e.clientName] || []
                      const st = stageOf(e.stage)
                      return (
                        <div key={e.id} onClick={() => setEditId(e.id)} title="Click to edit / move"
                          style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 10, padding: 12, position: 'relative', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--text)', lineHeight: 1.3, paddingRight: 4 }}>{e.title}</div>
                            <input type="checkbox" title="Mark complete" onClick={ev => ev.stopPropagation()} onChange={() => complete(e)} style={{ cursor: 'pointer', marginTop: 2 }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '5px 0' }}>
                            <span style={{ fontSize: '.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: st.bg, color: st.color }}>{st.label}</span>
                            <span style={{ fontSize: '.74rem', color: 'var(--sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.clientName}</span>
                          </div>
                          <div style={{ fontSize: '.72rem', color: isOverdue(e) ? 'var(--danger)' : 'var(--sub)', marginBottom: 4 }}>
                            Assigned {fmtDate(e.assignedDate)} · {daysBetween(e.assignedDate)}d
                          </div>
                          {clientSvcs.length > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                              <span style={{ fontSize: '.7rem', color: 'var(--sub)' }}>{clientSvcs.length} svc</span>
                              {clientSvcs.map((s, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: SVC[s]?.color || '#999', display: 'inline-block' }} />)}
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                            <input
                              type="date"
                              value={e.dueDate || ''}
                              onClick={ev => ev.stopPropagation()}
                              onChange={ev => setDue(e, ev.target.value)}
                              title="Due date — click to edit"
                              style={{
                                fontSize: '.66rem', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', padding: '1px 4px',
                                background: 'var(--surface)', color: isOverdue(e) ? 'var(--danger)' : 'var(--sub)', width: 118,
                              }}
                            />
                            <select
                              value={wait || ''}
                              onClick={ev => ev.stopPropagation()}
                              onChange={ev => setWaiting(e, ev.target.value)}
                              style={{
                                fontSize: '.66rem', fontWeight: 700, border: 'none', borderRadius: 99, cursor: 'pointer', padding: '2px 6px',
                                background: wait === 'client' ? 'rgba(245,158,11,.18)' : wait === 'consultant' ? 'rgba(124,58,237,.18)' : 'var(--surface)',
                                color: wait === 'client' ? '#B45309' : wait === 'consultant' ? '#6D28D9' : 'var(--sub)',
                              }}
                            >
                              <option value="">Set status</option>
                              <option value="client">Waiting on Client</option>
                              <option value="consultant">Waiting for Consultant</option>
                            </select>
                          </div>
                          <button onClick={ev => { ev.stopPropagation(); removeEng(e) }} title="Delete task" style={{ position: 'absolute', bottom: 6, right: 8, background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: '.7rem' }}>✕</button>
                        </div>
                      )
                    })}
                    {colItems.length === 0 && <div style={{ fontSize: '.75rem', color: 'var(--sub)', textAlign: 'center', padding: '14px 0' }}>No tasks</div>}
                  </div>

                  <div style={{ padding: 10 }}>
                    {addCol === svc.key ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input className="form-input" style={{ height: 32 }} autoFocus placeholder="Task title" value={addTitle} onChange={e => setAddTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask(svc.key)} />
                        <select className="form-input form-select" style={{ height: 32 }} value={addClient} onChange={e => setAddClient(e.target.value)}>
                          <option value="">— No client —</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <input className="form-input" style={{ height: 32 }} type="date" value={addDue} onChange={e => setAddDue(e.target.value)} title="Due date (optional)" />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => addTask(svc.key)} disabled={!addTitle.trim()}>Add</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setAddCol(null); setAddTitle(''); setAddClient(''); setAddDue('') }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-sm" style={{ width: '100%', color: 'var(--sub)' }} onClick={() => { setAddCol(svc.key); setAddTitle(''); setAddClient(''); setAddDue('') }}>+ Add Task</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : view === 'clients' ? (
          <ClientRollup visible={visible} onComplete={complete} onReopen={reopen} onSetWaiting={setWaiting} />
        ) : (
          <CompletedTable completed={completed} onReopen={reopen} onEdit={setEditId} />
        )}

        {/* Analytics */}
        {(view === 'board' || view === 'clients') && (
          <div className="card" style={{ marginTop: 24, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div className="fw-700" style={{ fontSize: '.95rem' }}>Completed Work Analytics</div>
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 8, padding: 3 }}>
                <button className={`btn btn-sm ${analytics === 'monthly' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setAnalytics('monthly'); setSelMonth(null) }}>Monthly</button>
                <button className={`btn btn-sm ${analytics === 'yearly' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setAnalytics('yearly'); setSelMonth(null) }}>Yearly</button>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
              {SERVICES.map(s => (
                <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '.72rem', color: 'var(--sub)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color }} /> {s.label}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {/* Bars */}
              <div style={{ flex: '1 1 420px', display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
                {buckets.map(b => {
                  const h = Math.round((b.rows.length / maxCount) * 130)
                  return (
                    <div key={b.key} onClick={() => setSelMonth(b.key)} style={{ flex: 1, minWidth: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ fontSize: '.7rem', color: 'var(--sub)', marginBottom: 4 }}>{b.rows.length || 0}</div>
                      <div style={{ width: '70%', height: Math.max(2, h), display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden', outline: sel && sel.key === b.key ? '2px solid var(--accent)' : 'none' }}>
                        {SERVICES.map(s => {
                          const c = b.rows.filter(r => r.service === s.key).length
                          if (!c) return null
                          return <div key={s.key} style={{ background: s.color, height: `${(c / (b.rows.length || 1)) * 100}%` }} />
                        })}
                        {b.rows.length === 0 && <div style={{ background: 'var(--border)', height: 2 }} />}
                      </div>
                      <div style={{ fontSize: '.6rem', color: 'var(--sub)', marginTop: 6, transform: 'rotate(-35deg)', whiteSpace: 'nowrap', transformOrigin: 'center' }}>{b.label}</div>
                    </div>
                  )
                })}
              </div>

              {/* Selected period breakdown */}
              {sel && (
                <div style={{ flex: '1 1 300px', minWidth: 260 }}>
                  <div className="fw-700" style={{ fontSize: '.9rem', marginBottom: 10 }}>{sel.label} — {sel.rows.length} completed</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {SERVICES.map(s => (
                      <span key={s.key} style={{ fontSize: '.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: `${s.color}22`, color: s.color }}>
                        {s.label} {sel.rows.filter(r => r.service === s.key).length}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                    {[...new Set(sel.rows.map(r => r.clientName))].map(n => (
                      <div key={n} style={{ fontSize: '.8rem', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>{n}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {editTask && (
        <TaskModal
          initial={editTask}
          customers={customers}
          onSave={saveEdit}
          onClose={() => setEditId(null)}
        />
      )}
    </>
  )
}

// Client-centric rollup: one panel per customer showing every service-tagged
// task, grouped by service, with a progress bar and an explicit "remaining" list
// so the user sees exactly what's left for each client.
function ClientRollup({ visible, onComplete, onReopen, onSetWaiting }) {
  const [sort, setSort] = useState('remaining')   // 'remaining' | 'name' | 'progress'

  const clients = useMemo(() => {
    const m = {}
    visible.forEach(e => {
      const c = (m[e.clientName] ||= { name: e.clientName, all: [] })
      c.all.push(e)
    })
    const list = Object.values(m).map(c => {
      const total = c.all.length
      const done = c.all.filter(e => e.status === 'completed').length
      const remaining = c.all.filter(e => e.status === 'active')
      const overdue = remaining.filter(isOverdue).length
      const services = {}
      c.all.forEach(e => {
        const s = (services[e.service] ||= { key: e.service, total: 0, done: 0 })
        s.total++; if (e.status === 'completed') s.done++
      })
      return { ...c, total, done, remaining, overdue, pct: total ? Math.round((done / total) * 100) : 0, services: Object.values(services) }
    })
    list.sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name)
      : sort === 'progress' ? b.pct - a.pct
      : (b.remaining.length - a.remaining.length) || a.name.localeCompare(b.name))
    return list
  }, [visible, sort])

  if (clients.length === 0) {
    return <div className="card empty-state" style={{ padding: 32 }}><div className="empty-sub">No clients yet — tag a task with a Customer and a Service.</div></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <select className="form-input" style={{ width: 'auto', height: 32, fontSize: '.8rem' }} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="remaining">Most remaining first</option>
          <option value="progress">Most complete first</option>
          <option value="name">Client name</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {clients.map(c => (
          <div key={c.name} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{c.name}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--sub)' }}>
                {c.remaining.length} remaining{c.overdue ? ` · ${c.overdue} overdue` : ''} · {c.done}/{c.total} done
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 8, borderRadius: 99, background: 'var(--surface)', overflow: 'hidden', margin: '10px 0' }}>
              <div style={{ width: `${c.pct}%`, height: '100%', background: c.pct === 100 ? '#16A34A' : 'var(--accent, #6366F1)', transition: 'width .3s' }} />
            </div>

            {/* Per-service breakdown */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {c.services.map(s => {
                const rem = s.total - s.done
                return (
                  <span key={s.key} title={`${s.done}/${s.total} done`} style={{ fontSize: '.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: `${SVC[s.key]?.color || '#999'}18`, color: SVC[s.key]?.color || '#666', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: SVC[s.key]?.color || '#999' }} />
                    {SVC[s.key]?.label || s.key}
                    <span style={{ opacity: .8 }}>{rem ? `${rem} left` : '✓'}</span>
                  </span>
                )
              })}
            </div>

            {/* Remaining tasks — what's left */}
            {c.remaining.length > 0 ? (
              <div>
                <div style={{ fontSize: '.66rem', fontWeight: 700, letterSpacing: '.06em', color: 'var(--sub)', marginBottom: 6 }}>REMAINING</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {c.remaining.map(e => {
                    const st = stageOf(e.stage)
                    return (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: `1px solid ${isOverdue(e) ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 8 }}>
                        <input type="checkbox" title="Mark complete" onChange={() => onComplete(e)} style={{ cursor: 'pointer' }} />
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: SVC[e.service]?.color || '#999', flexShrink: 0 }} />
                        <span style={{ fontSize: '.8rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                        {e.dueDate && <span style={{ fontSize: '.66rem', color: isOverdue(e) ? 'var(--danger)' : 'var(--sub)' }}>{fmtDate(e.dueDate)}</span>}
                        <span style={{ fontSize: '.64rem', fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '.78rem', color: '#16A34A', fontWeight: 600 }}>✓ All tasks complete</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CompletedTable({ completed, onReopen, onEdit }) {
  const [sort, setSort]   = useState('finished-desc')
  const [open, setOpen]   = useState(null)   // expanded client name

  // Group completed tasks by client; keep each client's task history for the
  // expandable detail view.
  const byClient = Object.values(completed.reduce((m, e) => {
    const c = (m[e.clientName] ||= { clientName: e.clientName, tasks: [], services: new Set(), created: e.createdAt, finished: 0 })
    c.tasks.push(e)
    c.services.add(e.service)
    c.created = Math.min(c.created, e.createdAt)
    c.finished = Math.max(c.finished, e.finishedAt || 0)
    return m
  }, {}))
  byClient.forEach(c => c.tasks.sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0)))
  byClient.sort((a, b) => sort === 'finished-desc' ? (b.finished - a.finished) : sort === 'finished-asc' ? (a.finished - b.finished) : a.clientName.localeCompare(b.clientName))

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="fw-700">Completed Clients</div>
          <div style={{ fontSize: '.72rem', color: 'var(--sub)', marginTop: 2 }}>Click a client to see task history and reopen (move back to board).</div>
        </div>
        <select className="form-input" style={{ width: 'auto', height: 32, fontSize: '.8rem' }} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="finished-desc">Date finished (newest first)</option>
          <option value="finished-asc">Date finished (oldest first)</option>
          <option value="name">Client name</option>
        </select>
      </div>
      {byClient.length === 0 ? (
        <div className="empty-state" style={{ padding: 32 }}><div className="empty-sub">No completed tasks yet.</div></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--sub)', fontSize: '.7rem', letterSpacing: '.05em' }}>
                <th style={{ padding: '10px 18px', width: 28 }}></th>
                <th style={{ padding: '10px 18px' }}>CLIENT</th>
                <th style={{ padding: '10px 18px' }}>SERVICES COMPLETED</th>
                <th style={{ padding: '10px 18px' }}>CREATED</th>
                <th style={{ padding: '10px 18px' }}>FINISHED</th>
                <th style={{ padding: '10px 18px' }}>TASKS</th>
              </tr>
            </thead>
            <tbody>
              {byClient.map((r, i) => {
                const isOpen = open === r.clientName
                return (
                  <Fragment key={r.clientName}>
                    <tr onClick={() => setOpen(isOpen ? null : r.clientName)}
                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', background: isOpen ? 'var(--surface)' : 'transparent' }}>
                      <td style={{ padding: '12px 18px', color: 'var(--sub)' }}>{isOpen ? '▾' : '▸'}</td>
                      <td style={{ padding: '12px 18px', fontWeight: 600 }}>{r.clientName}</td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {[...r.services].map(s => (
                            <span key={s} style={{ fontSize: '.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `${SVC[s]?.color || '#999'}22`, color: SVC[s]?.color || '#666', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: SVC[s]?.color || '#999' }} />{SVC[s]?.label || s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px', color: 'var(--sub)' }}>{fmtDate(r.created)}</td>
                      <td style={{ padding: '12px 18px', color: 'var(--sub)' }}>{fmtDate(r.finished)}</td>
                      <td style={{ padding: '12px 18px', color: 'var(--sub)' }}>{r.tasks.length} task{r.tasks.length !== 1 ? 's' : ''}</td>
                    </tr>
                    {isOpen && (
                      <tr style={{ background: 'var(--surface)' }}>
                        <td colSpan={6} style={{ padding: '4px 18px 14px 46px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {r.tasks.map(e => (
                              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: SVC[e.service]?.color || '#999', flexShrink: 0 }} />
                                <span style={{ fontSize: '.82rem', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                                <span style={{ fontSize: '.72rem', color: 'var(--sub)' }}>{SVC[e.service]?.label || e.service}</span>
                                <span style={{ fontSize: '.72rem', color: 'var(--sub)' }}>Finished {fmtDate(e.finishedAt)}</span>
                                {onEdit && <button className="btn btn-ghost btn-sm" onClick={() => onEdit(e.id)}>Edit</button>}
                                <button className="btn btn-secondary btn-sm" onClick={() => onReopen(e)} title="Move back onto the board">↩ Reopen</button>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
