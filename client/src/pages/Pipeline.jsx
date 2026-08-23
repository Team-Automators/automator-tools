import { useState, useEffect, useRef, useMemo } from 'react'
import { api } from '../lib/api.js'
import { confirmToast, notifySuccess, notifyError } from '../lib/toast.jsx'

const SERVICES = [
  { key: 'setup-calls',  label: 'Setup Calls',            color: '#6366F1' },
  { key: 'funnels',      label: 'Funnels',                color: '#EC4899' },
  { key: 'automations',  label: 'Automations & Workflows', color: '#F59E0B' },
  { key: 'testing-call', label: 'Testing Call',           color: '#10B981' },
  { key: 'voice-ai',     label: 'Voice AI',               color: '#06B6D4' },
]
const SVC = Object.fromEntries(SERVICES.map(s => [s.key, s]))

const DAY = 86400000
const today = () => new Date().toISOString().slice(0, 10)
function daysBetween(dateStr) {
  if (!dateStr) return 0
  const d = new Date(dateStr + 'T00:00:00')
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY))
}
function isOverdue(e) {
  return e.status === 'active' && e.dueDate && new Date(e.dueDate + 'T23:59:59').getTime() < Date.now()
}
function fmtDate(v) {
  if (!v) return ''
  const d = typeof v === 'number' ? new Date(v) : new Date(v + 'T00:00:00')
  return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' })
}
function monthKey(ts) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function monthLabel(key) { const [y, m] = key.split('-'); return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) }

export default function Pipeline() {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView]     = useState('board')     // 'board' | 'completed'
  const [search, setSearch] = useState('')
  const [addCol, setAddCol] = useState(null)         // service key being added to
  const [addName, setAddName] = useState('')
  const [addDue, setAddDue]   = useState('')
  const [analytics, setAnalytics] = useState('monthly')
  const [selMonth, setSelMonth]   = useState(null)
  const fileRef = useRef(null)

  async function load() {
    setLoading(true)
    const list = await api.getPipeline()
    setItems(Array.isArray(list) ? list : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const q = search.trim().toLowerCase()
  const visible = q ? items.filter(e => (e.clientName || '').toLowerCase().includes(q)) : items
  const active = visible.filter(e => e.status === 'active')
  const completed = visible.filter(e => e.status === 'completed')

  // Total services per client (for the "N svc" dots)
  const svcByClient = useMemo(() => {
    const m = {}
    active.forEach(e => { (m[e.clientName] ||= []).push(e.service) })
    return m
  }, [active])

  const stats = {
    total: items.length,
    active: items.filter(e => e.status === 'active').length,
    overdue: items.filter(isOverdue).length,
    completed: items.filter(e => e.status === 'completed').length,
  }

  async function addClient(serviceKey) {
    const name = addName.trim()
    if (!name) return
    const created = await api.createEngagement({ clientName: name, service: serviceKey, assignedDate: today(), dueDate: addDue || '' })
    if (created?.id) setItems(prev => [...prev, created])
    setAddCol(null); setAddName(''); setAddDue('')
  }

  async function complete(e) {
    setItems(prev => prev.map(x => x.id === e.id ? { ...x, status: 'completed', finishedAt: Date.now() } : x))
    await api.updateEngagement(e.id, { status: 'completed' }).catch(() => load())
    notifySuccess('Marked complete')
  }
  async function reopen(e) {
    setItems(prev => prev.map(x => x.id === e.id ? { ...x, status: 'active', finishedAt: null } : x))
    await api.updateEngagement(e.id, { status: 'active' }).catch(() => load())
  }
  async function setWaiting(e, waitingOn) {
    setItems(prev => prev.map(x => x.id === e.id ? { ...x, waitingOn } : x))
    await api.updateEngagement(e.id, { waitingOn }).catch(() => load())
  }
  async function removeEng(e) {
    if (!(await confirmToast(`Remove ${e.clientName} from ${SVC[e.service]?.label || 'this column'}?`, { confirmText: 'Remove' }))) return
    setItems(prev => prev.filter(x => x.id !== e.id))
    await api.deleteEngagement(e.id).catch(() => load())
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
        if (!(await confirmToast(`Import ${arr.length} engagements? This replaces your current pipeline.`, { confirmText: 'Import' }))) return
        await api.importPipeline(arr)
        await load()
        notifySuccess(`Imported ${arr.length}`)
      } catch (e) { notifyError(e.message || 'Import failed') }
    }
    reader.readAsText(file)
    ev.target.value = ''
  }

  // ── Analytics ──────────────────────────────────────────────────────────────
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
            <button className={`btn btn-sm ${view === 'completed' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('completed')}>Completed Clients</button>
          </div>
          <input className="form-input" style={{ width: 200, height: 34 }} placeholder="Search clients by name…" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-secondary btn-sm" onClick={exportBackup}>Export Backup</button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={onImport} style={{ display: 'none' }} />
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>Import Backup</button>
        </div>
      </div>

      <div className="content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div className="page-title" style={{ marginRight: 8 }}>Client Pipeline Tracker</div>
          {stat(stats.total, 'TOTAL')}
          {stat(stats.active, 'ACTIVE', '#D97706')}
          {stat(stats.overdue, 'OVERDUE', stats.overdue ? 'var(--danger)' : 'var(--sub)')}
          {stat(stats.completed, 'COMPLETED', '#16A34A')}
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
                <div key={svc.key} style={{ minWidth: 250, width: 250, flexShrink: 0, background: 'var(--surface)', borderRadius: 12, borderTop: `3px solid ${svc.color}`, display: 'flex', flexDirection: 'column' }}>
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
                      return (
                        <div key={e.id} style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 10, padding: 12, position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--text)' }}>{e.clientName}</div>
                            <input type="checkbox" title="Mark complete" onChange={() => complete(e)} style={{ cursor: 'pointer', marginTop: 2 }} />
                          </div>
                          <div style={{ fontSize: '.72rem', color: isOverdue(e) ? 'var(--danger)' : 'var(--sub)', margin: '4px 0' }}>
                            Assigned {fmtDate(e.assignedDate)} · {daysBetween(e.assignedDate)}d waiting
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ fontSize: '.72rem', color: 'var(--sub)' }}>{clientSvcs.length} svc</span>
                            {clientSvcs.map((s, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: SVC[s]?.color || '#999', display: 'inline-block' }} />)}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '.7rem', color: isOverdue(e) ? 'var(--danger)' : 'var(--sub)' }}>{e.dueDate ? `Due ${fmtDate(e.dueDate)}` : 'No due date'}</span>
                            <select
                              value={wait || ''}
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
                          <button onClick={() => removeEng(e)} title="Remove" style={{ position: 'absolute', bottom: 6, right: 8, background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: '.7rem' }}>✕</button>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ padding: 10 }}>
                    {addCol === svc.key ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input className="form-input" style={{ height: 32 }} autoFocus placeholder="Client name" value={addName} onChange={e => setAddName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addClient(svc.key)} />
                        <input className="form-input" style={{ height: 32 }} type="date" value={addDue} onChange={e => setAddDue(e.target.value)} title="Due date (optional)" />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => addClient(svc.key)} disabled={!addName.trim()}>Add</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setAddCol(null); setAddName(''); setAddDue('') }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-sm" style={{ width: '100%', color: 'var(--sub)' }} onClick={() => { setAddCol(svc.key); setAddName(''); setAddDue('') }}>+ Add Client</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <CompletedTable completed={completed} onReopen={reopen} />
        )}

        {/* Analytics */}
        {view === 'board' && (
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
    </>
  )
}

function CompletedTable({ completed, onReopen }) {
  const [group, setGroup] = useState(true)
  const [sort, setSort]   = useState('finished-desc')

  const rows = group
    ? Object.values(completed.reduce((m, e) => {
        (m[e.clientName] ||= { clientName: e.clientName, services: [], created: e.createdAt, finished: e.finishedAt, count: 0 })
        m[e.clientName].services.push(e.service)
        m[e.clientName].created = Math.min(m[e.clientName].created, e.createdAt)
        m[e.clientName].finished = Math.max(m[e.clientName].finished || 0, e.finishedAt || 0)
        m[e.clientName].count++
        return m
      }, {}))
    : completed.map(e => ({ clientName: e.clientName, services: [e.service], created: e.createdAt, finished: e.finishedAt, count: 1 }))

  rows.sort((a, b) => sort === 'finished-desc' ? (b.finished - a.finished) : sort === 'finished-asc' ? (a.finished - b.finished) : a.clientName.localeCompare(b.clientName))

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', flexWrap: 'wrap', gap: 8 }}>
        <div className="fw-700">Completed Clients</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <label style={{ fontSize: '.8rem', color: 'var(--sub)', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={group} onChange={e => setGroup(e.target.checked)} /> Group by client
          </label>
          <select className="form-input" style={{ width: 'auto', height: 32, fontSize: '.8rem' }} value={sort} onChange={e => setSort(e.target.value)}>
            <option value="finished-desc">Date finished (newest first)</option>
            <option value="finished-asc">Date finished (oldest first)</option>
            <option value="name">Client name</option>
          </select>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state" style={{ padding: 32 }}><div className="empty-sub">No completed clients yet.</div></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--sub)', fontSize: '.7rem', letterSpacing: '.05em' }}>
                <th style={{ padding: '10px 18px' }}>CLIENT</th>
                <th style={{ padding: '10px 18px' }}>SERVICES COMPLETED</th>
                <th style={{ padding: '10px 18px' }}>CREATED</th>
                <th style={{ padding: '10px 18px' }}>FINISHED</th>
                <th style={{ padding: '10px 18px' }}>NOTES</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 18px', fontWeight: 600 }}>{r.clientName}</td>
                  <td style={{ padding: '12px 18px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[...new Set(r.services)].map(s => (
                        <span key={s} style={{ fontSize: '.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: `${SVC[s]?.color || '#999'}22`, color: SVC[s]?.color || '#666', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: SVC[s]?.color || '#999' }} />{SVC[s]?.label || s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px 18px', color: 'var(--sub)' }}>{fmtDate(r.created)}</td>
                  <td style={{ padding: '12px 18px', color: 'var(--sub)' }}>{fmtDate(r.finished)}</td>
                  <td style={{ padding: '12px 18px', color: 'var(--sub)' }}>{r.count} engagement{r.count !== 1 ? 's' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
