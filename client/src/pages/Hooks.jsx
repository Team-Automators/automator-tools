import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'

const APP_FIELDS = [
  { key: 'task_title',    label: 'Task Title',     required: true  },
  { key: 'task_stage',    label: 'Stage',          required: false },
  { key: 'customer_name', label: 'Customer Name',  required: false },
  { key: 'task_note',     label: 'Note',           required: false },
]

const STAGES = ['urgent', 'in-progress', 'blocked', 'for-later', 'done']

function flattenKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj || {})) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

function getPath(obj, dotPath) {
  return dotPath.split('.').reduce((cur, k) => cur?.[k], obj)
}

function inboundUrl(hook) {
  if (!hook.incomingToken) return null
  return `${window.location.origin}/api/incoming/${hook.incomingToken}`
}

function relTime(ts) {
  if (!ts) return null
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Field Mapper ──────────────────────────────────────────────────────────────
function FieldMapper({ hook, onMappingSaved }) {
  const payload    = hook.lastIncoming?.payload
  const sourceKeys = payload ? flattenKeys(payload) : []
  const [map,        setMap]        = useState(hook.fieldMap || {})
  const [autoCreate, setAutoCreate] = useState(hook.autoCreate || false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  async function handleSave() {
    setSaving(true)
    const updated = await api.saveHookMapping(hook.id, { fieldMap: map, autoCreate }).catch(() => null)
    setSaving(false)
    if (updated) { setSaved(true); setTimeout(() => setSaved(false), 2500); onMappingSaved(updated) }
  }

  if (!payload) {
    return (
      <div className="hook-mapper-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28" style={{ color: 'var(--border)' }}>
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        <div style={{ fontSize: '.8125rem', color: 'var(--sub)', marginTop: 6 }}>
          Send a test payload to this URL first — the fields will appear here for mapping.
        </div>
      </div>
    )
  }

  return (
    <div className="hook-mapper">
      <div className="hook-mapper-title">
        Map incoming fields to task fields
      </div>

      {/* Received payload preview */}
      <div className="hook-mapper-payload">
        <div className="hook-mapper-payload-label">Last received payload</div>
        <pre className="hook-mapper-payload-pre">{JSON.stringify(payload, null, 2)}</pre>
      </div>

      {/* Mapping table */}
      <div className="hook-mapper-table">
        <div className="hook-mapper-row hook-mapper-header">
          <span>App field</span>
          <span>Payload field</span>
          <span>Preview value</span>
        </div>
        {APP_FIELDS.map(field => {
          const selected = map[field.key] || ''
          const preview  = selected ? getPath(payload, selected) : null
          return (
            <div key={field.key} className="hook-mapper-row">
              <span className="hook-mapper-app-field">
                {field.label}
                {field.required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
              </span>
              <select
                className="form-input form-select hook-mapper-select"
                value={selected}
                onChange={e => setMap(prev => ({ ...prev, [field.key]: e.target.value }))}
              >
                <option value="">— skip —</option>
                {sourceKeys.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <span className="hook-mapper-preview">
                {preview !== null && preview !== undefined ? String(preview) : <em style={{ color: 'var(--border)' }}>—</em>}
              </span>
            </div>
          )
        })}
      </div>

      {/* Stage note */}
      {map.task_stage && (
        <div style={{ fontSize: '.72rem', color: 'var(--sub)', marginBottom: 8 }}>
          Stage field: value must be one of <code>{STAGES.join(', ')}</code>. Unrecognised values default to <code>urgent</code>.
        </div>
      )}

      {/* Auto-create toggle */}
      <label className="hook-mapper-toggle">
        <input
          type="checkbox"
          checked={autoCreate}
          onChange={e => setAutoCreate(e.target.checked)}
        />
        <span className="hook-mapper-toggle-label">
          Auto-create task when payload is received
          <span style={{ color: 'var(--sub)', fontWeight: 400, fontSize: '.75rem', display: 'block' }}>
            Requires Task Title to be mapped
          </span>
        </span>
      </label>

      <button
        className="btn btn-primary btn-sm"
        style={{ alignSelf: 'flex-start', marginTop: 4 }}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save mapping'}
      </button>
    </div>
  )
}

// ── Hook card ─────────────────────────────────────────────────────────────────
function HookCard({ hook: initialHook, onEdit, onDelete, onToggle }) {
  const [hook,         setHook]         = useState(initialHook)
  const [testing,      setTesting]      = useState(false)
  const [testMsg,      setTestMsg]      = useState(null)
  const [copiedUrl,    setCopiedUrl]    = useState(false)
  const [showMapper,   setShowMapper]   = useState(false)
  const [showRawOut,   setShowRawOut]   = useState(false)

  const url         = inboundUrl(hook)
  const inCount     = hook.incomingCount || 0
  const lastIn      = hook.lastIncoming

  async function handleTest() {
    setTesting(true); setTestMsg(null)
    const res = await api.testHook(hook.id).catch(e => ({ error: e.message }))
    setTesting(false)
    setTestMsg(res.error ? `Failed: ${res.error}` : 'Test sent ✓')
    setTimeout(() => setTestMsg(null), 4000)
  }

  function copyUrl() {
    if (!url) return
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000)
    })
  }

  return (
    <div className={`hook-card ${!hook.active ? 'inactive' : ''}`}>
      {/* Header */}
      <div className="hook-card-header">
        <div className="hook-card-title-row">
          <div className="hook-card-name">{hook.name}</div>
          <div className="hook-card-badges">
            <span className={`hook-status ${hook.active ? 'active' : 'paused'}`}>
              {hook.active ? 'Active' : 'Paused'}
            </span>
            {hook.autoCreate && (
              <span className="hook-in-count" style={{ background: 'rgba(139,92,246,.12)', color: '#8B5CF6' }} title="Auto-create task enabled">
                ⚡ auto
              </span>
            )}
            {inCount > 0 && (
              <span className="hook-in-count" title={`${inCount} payload${inCount !== 1 ? 's' : ''} received`}>
                ↓ {inCount}
              </span>
            )}
          </div>
        </div>
        <div className="hook-card-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => onToggle(hook)}>{hook.active ? 'Pause' : 'Resume'}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(hook)}>Edit</button>
          <button className="btn btn-ghost btn-sm danger" onClick={() => onDelete(hook.id)}>Delete</button>
        </div>
      </div>

      <div className="hook-card-body">
        {/* ── Inbound URL ──────────────────────────────────────── */}
        {url && (
          <div className="hook-inbound-section">
            <div className="hook-inbound-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
              Inbound Webhook URL
              <span className="hook-inbound-pill">POST · No auth</span>
            </div>
            <div className="hook-inbound-url-row">
              <code className="hook-inbound-url">{url}</code>
              <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={copyUrl}>
                {copiedUrl ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                )}
                {copiedUrl ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {lastIn && (
              <div className="hook-inbound-last">
                Last received {relTime(lastIn.receivedAt)}
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '.7rem', padding: '2px 8px', minHeight: 'unset' }}
                  onClick={() => setShowMapper(v => !v)}
                >
                  {showMapper ? 'Hide field mapping' : (hook.fieldMap ? 'Edit field mapping' : 'Map fields →')}
                </button>
              </div>
            )}
            {!lastIn && (
              <div style={{ fontSize: '.75rem', color: 'var(--sub)' }}>
                Waiting for first payload…
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '.7rem', padding: '2px 8px', minHeight: 'unset', marginLeft: 8 }}
                  onClick={() => setShowMapper(v => !v)}
                >
                  {showMapper ? 'Hide' : 'Preview mapping'}
                </button>
              </div>
            )}
            {showMapper && (
              <FieldMapper
                hook={hook}
                onMappingSaved={updated => setHook(prev => ({ ...prev, ...updated }))}
              />
            )}
          </div>
        )}

        {/* ── Customer ─────────────────────────────────────────── */}
        <div className="hook-field">
          <span className="hook-field-label">Customer</span>
          <span className="hook-field-value">
            {hook.customerName
              ? <span className="hook-customer-chip">{hook.customerName}</span>
              : <em style={{ color: 'var(--sub)' }}>All customers</em>}
          </span>
        </div>

        {/* ── Outbound ─────────────────────────────────────────── */}
        {hook.destinationUrl && (
          <div className="hook-field">
            <span className="hook-field-label">Outbound URL</span>
            <span className="hook-field-value url">{hook.destinationUrl}</span>
          </div>
        )}
        {hook.destinationUrl && (
          <div className="hook-field">
            <span className="hook-field-label">Last triggered</span>
            <span className="hook-field-value">{hook.lastTriggered ? new Date(hook.lastTriggered).toLocaleString() : 'Never'}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      {hook.destinationUrl && (
        <div className="hook-card-footer">
          <button className="btn btn-secondary btn-sm" onClick={handleTest} disabled={testing}>
            {testing ? 'Sending…' : 'Test outbound'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowRawOut(v => !v)}>
            {showRawOut ? 'Hide payload' : 'View outbound payload'}
          </button>
          {testMsg && (
            <span className={`hook-test-msg ${testMsg.startsWith('Failed') ? 'error' : 'ok'}`}>{testMsg}</span>
          )}
        </div>
      )}

      {showRawOut && (
        <div className="hook-payload-wrap">
          <div className="hook-payload-toolbar">
            <span className="hook-payload-label">Outbound JSON payload (sample)</span>
          </div>
          <pre className="hook-payload-json">{JSON.stringify({
            event: 'kanban_update', hook_id: hook.id,
            customer: { id: hook.customerId, name: hook.customerName },
            task: { title: 'Example task', stage: 'in-progress', updated_at: new Date().toISOString() },
            timestamp: new Date().toISOString(),
          }, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

// ── Hook modal ────────────────────────────────────────────────────────────────
function HookModal({ initial, customers, onSave, onClose }) {
  const [name,           setName]        = useState(initial?.name || '')
  const [destinationUrl, setDestUrl]     = useState(initial?.destinationUrl || '')
  const [customerId,     setCustomerId]  = useState(initial?.customerId || '')
  const [customerName,   setCustName]    = useState(initial?.customerName || '')
  const [saving,         setSaving]      = useState(false)
  const [createdHook,    setCreatedHook] = useState(null)
  const [copied,         setCopied]      = useState(false)

  const isEdit = !!initial?.id

  function handleCustomerChange(e) {
    const id = e.target.value
    setCustomerId(id)
    setCustName(customers.find(c => c.id === id)?.name || '')
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const result = await onSave({
      name: name.trim() || 'Unnamed Hook',
      destinationUrl: destinationUrl.trim(),
      customerId, customerName,
    })
    setSaving(false)
    if (result && !isEdit) setCreatedHook(result)
  }

  function copyUrl() {
    const url = inboundUrl(createdHook)
    if (!url) return
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500)
    })
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (createdHook) {
    const url = inboundUrl(createdHook)
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,.12)', color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div className="modal-title" style={{ marginBottom: 0 }}>Hook created!</div>
            <div style={{ fontSize: '.8125rem', color: 'var(--sub)', textAlign: 'center' }}>
              Paste this URL into Zapier, Make, or any platform. When they POST to it, the data arrives here — no authentication needed.
            </div>
          </div>

          <div className="hook-inbound-section" style={{ marginTop: 8 }}>
            <div className="hook-inbound-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
              Your Inbound Webhook URL
              <span className="hook-inbound-pill">POST · No auth</span>
            </div>
            <div className="hook-inbound-url-row">
              <code className="hook-inbound-url">{url}</code>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', gap: 8 }} onClick={copyUrl}>
              {copied ? (
                <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>
              ) : (
                <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy URL</>
              )}
            </button>
            <div style={{ fontSize: '.72rem', color: 'var(--sub)', textAlign: 'center' }}>
              Once you send a test payload from Zapier, come back to this hook and click <strong>Map fields</strong> to connect incoming data to tasks.
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-secondary flex-1" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Create / Edit form ─────────────────────────────────────────────────────
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">{isEdit ? 'Edit Hook' : 'New Hook'}</div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Hook name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Zapier lead intake" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">
              Outbound URL
              <span style={{ fontWeight: 400, color: 'var(--sub)', marginLeft: 4 }}>(optional)</span>
            </label>
            <input className="form-input" type="text" value={destinationUrl} onChange={e => setDestUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/hooks/catch/…" autoComplete="off" spellCheck={false} />
            <div className="text-xs text-sub mt-1">We'll POST JSON here on every Kanban task update.</div>
          </div>
          <div className="form-group">
            <label className="form-label">
              Assign to customer
              <span style={{ fontWeight: 400, color: 'var(--sub)', marginLeft: 4 }}>(optional)</span>
            </label>
            <select className="form-input form-select" value={customerId} onChange={handleCustomerChange}>
              <option value="">— All customers —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {isEdit && (
            <div className="hook-edit-note">
              The inbound URL is permanent — delete and recreate the hook to rotate it.
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn-primary flex-1" type="submit" disabled={saving}>
              {saving ? 'Creating…' : isEdit ? 'Save changes' : 'Create hook & get URL'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Hooks() {
  const [hooks,     setHooks]     = useState([])
  const [customers, setCustomers] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null)

  useEffect(() => {
    Promise.all([api.getHooks(), api.getCustomers()]).then(([h, c]) => {
      setHooks(Array.isArray(h) ? h : [])
      setCustomers(Array.isArray(c) ? c : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleSave(fields) {
    if (modal.hook) {
      const updated = await api.updateHook(modal.hook.id, fields)
      setHooks(prev => prev.map(h => h.id === modal.hook.id ? updated : h))
      setModal(null)
      return null
    } else {
      const created = await api.createHook(fields)
      setHooks(prev => [...prev, created])
      return created
    }
  }

  async function handleDelete(id) {
    setHooks(prev => prev.filter(h => h.id !== id))
    await api.deleteHook(id).catch(() => {})
  }

  async function handleToggle(hook) {
    const updated = await api.updateHook(hook.id, { active: !hook.active })
    setHooks(prev => prev.map(h => h.id === hook.id ? updated : h))
  }

  return (
    <>
      <div className="topnav">
        <div className="topnav-left"><span className="breadcrumb-current">Hooks</span></div>
        <div className="topnav-right">
          <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ New Hook</button>
        </div>
      </div>

      <div className="page-body">
        <div className="hook-info-banner">
          <div className="hook-info-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
          </div>
          <div>
            <div className="hook-info-title">Inbound Webhooks</div>
            <div className="hook-info-body">
              Each hook has a unique URL. Paste it into Zapier, Make, or any platform — they POST data, you map the fields, tasks get created automatically.
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
        ) : hooks.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40" style={{ color: 'var(--border)' }}>
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
            <div className="empty-title">No hooks yet</div>
            <div className="empty-sub">Create a hook to get your unique webhook URL for Zapier or any platform.</div>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setModal({})}>+ New Hook</button>
          </div>
        ) : (
          <div className="hooks-list">
            {hooks.map(hook => (
              <HookCard key={hook.id} hook={hook}
                onEdit={h => setModal({ hook: h })}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>

      {modal !== null && (
        <HookModal initial={modal.hook || null} customers={customers} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </>
  )
}
