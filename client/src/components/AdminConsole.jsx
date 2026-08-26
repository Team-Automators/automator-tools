import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'
import { confirmToast, notifySuccess, notifyError } from '../lib/toast.jsx'

function relTime(ts) {
  if (!ts) return 'never'
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
const isActive = (ts) => ts && (Date.now() - ts) < 15 * 60 * 1000

// The users table + actions. Self-fetches. Used inside the standalone admin page.
export default function AdminConsole() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true)
    try { const d = await api.getAdminUsers(); setUsers(d.users || []) }
    catch (e) { notifyError(e.message || 'Could not load users') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function revokeKey(u) {
    if (!(await confirmToast(`Revoke the AI key for ${u.email}? They’ll need to add a new one to use AI.`, { confirmText: 'Revoke key', danger: true }))) return
    setBusy(u.email)
    try { await api.revokeUserKey(u.email); setUsers(us => us.map(x => x.email === u.email ? { ...x, hasApiKey: false, keyMasked: '', provider: '' } : x)); notifySuccess('API key revoked') }
    catch (e) { notifyError(e.message || 'Failed') } finally { setBusy('') }
  }
  async function toggleBlock(u) {
    const next = !u.blocked
    if (next && !(await confirmToast(`Force ${u.email} to sign out and block their access? They can’t sign back in until you restore it.`, { confirmText: 'Log out & block', danger: true }))) return
    setBusy(u.email)
    try { await api.setUserBlocked(u.email, next); setUsers(us => us.map(x => x.email === u.email ? { ...x, blocked: next } : x)); notifySuccess(next ? 'User logged out & blocked' : 'Access restored') }
    catch (e) { notifyError(e.message || 'Failed') } finally { setBusy('') }
  }

  const query = q.trim().toLowerCase()
  const rows = query ? users.filter(u => (u.email + ' ' + u.name).toLowerCase().includes(query)) : users
  const activeCount = users.filter(u => isActive(u.lastSeen) && !u.blocked).length

  const stat = (n, label, color) => (
    <div style={{ flex: '1 1 90px', minWidth: 0, textAlign: 'center', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: color || 'var(--text)' }}>{n}</div>
      <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--sub)' }}>{label}</div>
    </div>
  )

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        {stat(users.length, 'USERS')}
        {stat(activeCount, 'ACTIVE', '#16A34A')}
        {stat(users.filter(u => u.hasApiKey).length, 'WITH KEY', 'var(--accent)')}
        {stat(users.filter(u => u.blocked).length, 'BLOCKED', users.some(u => u.blocked) ? 'var(--danger)' : 'var(--sub)')}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '10px 0 16px' }}>
        <div style={{ fontSize: '.8rem', color: 'var(--sub)' }}>
          Everyone who has signed in. Revoke a user’s AI key or force them to sign out (also blocks re-login until restored).
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" style={{ flex: '1 1 160px', minWidth: 0, maxWidth: 240, height: 34 }} placeholder="Search name or email…" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>Refresh</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
      ) : rows.length === 0 ? (
        <div className="card empty-state" style={{ padding: 32 }}><div className="empty-sub">No users found.</div></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.86rem', minWidth: 720 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--sub)', fontSize: '.66rem', letterSpacing: '.06em' }}>
                  <th style={{ padding: '11px 16px' }}>USER</th>
                  <th style={{ padding: '11px 16px' }}>EMAIL</th>
                  <th style={{ padding: '11px 16px' }}>API KEY</th>
                  <th style={{ padding: '11px 16px' }}>LOCATIONS</th>
                  <th style={{ padding: '11px 16px' }}>LAST SEEN</th>
                  <th style={{ padding: '11px 16px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(u => {
                  const acting = busy === u.email
                  return (
                    <tr key={u.email} style={{ borderTop: '1px solid var(--border)', opacity: u.blocked ? 0.6 : 1 }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: u.blocked ? 'var(--danger)' : isActive(u.lastSeen) ? '#16A34A' : 'var(--border)' }} title={u.blocked ? 'Blocked' : isActive(u.lastSeen) ? 'Active' : 'Idle'} />
                          <span style={{ fontWeight: 600 }}>{u.name || '—'}</span>
                          {u.isAdmin && <span className="chip chip-green" style={{ fontSize: '.62rem' }}>admin</span>}
                          {u.blocked && <span className="chip chip-red" style={{ fontSize: '.62rem' }}>blocked</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--sub)' }}>{u.email}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {u.hasApiKey
                          ? <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.8rem' }}>{u.provider ? `${u.provider} · ` : ''}{u.keyMasked}</span>
                          : <span style={{ color: 'var(--sub)' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--sub)' }}>{u.locations?.length || 0}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--sub)' }}>{relTime(u.lastSeen)}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button className="btn btn-ghost btn-sm" disabled={acting || !u.hasApiKey} style={{ color: u.hasApiKey ? 'var(--danger)' : 'var(--sub)' }} onClick={() => revokeKey(u)}>Revoke key</button>
                          {u.blocked
                            ? <button className="btn btn-secondary btn-sm" disabled={acting} onClick={() => toggleBlock(u)}>Restore access</button>
                            : <button className="btn btn-secondary btn-sm" disabled={acting} style={{ color: 'var(--danger)' }} onClick={() => toggleBlock(u)}>Log out</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
