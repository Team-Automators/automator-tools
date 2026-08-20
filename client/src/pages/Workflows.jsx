import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiFetch, getLocationId } from '../lib/api.js'

// ── Constants ─────────────────────────────────────────────────────────────────
const TRIGGER_TYPES = [
  { value: 'opportunity_status_changed', label: 'Opportunity Status Changed' },
  { value: 'contact_tag_added',          label: 'Contact Tag Added' },
  { value: 'form_submitted',             label: 'Form Submitted' },
  { value: 'appointment_booked',         label: 'Appointment Booked' },
  { value: 'contact_created',            label: 'Contact Created' },
  { value: 'invoice_sent',               label: 'Invoice Sent' },
  { value: 'payment_received',           label: 'Payment Received' },
  { value: 'inbound_webhook',            label: 'Inbound Webhook' },
]

const STEP_TYPES = [
  { value: 'wait',              label: 'Wait',       icon: '⏱' },
  { value: 'sms',               label: 'SMS',        icon: '💬' },
  { value: 'email',             label: 'Email',      icon: '✉️' },
  { value: 'task-notification', label: 'Task',       icon: '✅' },
]

const WAIT_UNITS = ['minutes', 'hours', 'days', 'weeks']

const MERGE = ['{{contact.name}}', '{{contact.email}}', '{{contact.phone}}',
               '{{user.name}}', '{{location.name}}']

function emptyStep(type = 'wait') {
  switch (type) {
    case 'wait':              return { type, value: 1, unit: 'hours', name: '' }
    case 'sms':               return { type, body: '', name: '' }
    case 'email':             return { type, subject: '', body: '', name: '' }
    case 'task-notification': return { type, title: '', body: '', dueDate: 1, name: '' }
    default:                  return { type, name: '' }
  }
}

function LibraryAnalyzer({ onFill, onClose }) {
  const locationId = getLocationId()
  const [copies,    setCopies]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [err,       setErr]       = useState('')

  useEffect(() => {
    fetch(`/api/copies?locationId=${locationId}`)
      .then(r => r.json())
      .then(d => { setCopies(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [locationId])

  async function pick(item) {
    setAnalyzing(true); setErr('')
    let messages = [], title = item.title
    try {
      const r = await fetch(`/api/copies/${item.id}`)
      const copy = await r.json()
      messages = copy.messages || []
      title = copy.title || title
    } catch {}

    let aiConfig = {}
    try { aiConfig = JSON.parse(localStorage.getItem('ghl_ai_config') || '{}') } catch {}

    try {
      const r = await fetch('/api/workflows/analyze-copy', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages, title, provider: aiConfig.provider, apiKey: aiConfig.apiKey, model: aiConfig.model }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Analysis failed')
      onFill(d.brief)
    } catch (e) {
      setErr(e.message)
      setAnalyzing(false)
    }
  }

  const filtered = copies.filter(c =>
    !search ||
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.preview?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="modal-backdrop" onClick={analyzing ? undefined : onClose}>
      <div className="modal wf-lib-modal" onClick={e => e.stopPropagation()}>
        {analyzing ? (
          <div className="wf-lib-summarizing">
            <div className="spinner" style={{ width: 36, height: 36 }} />
            <p className="wf-lib-summ-label">Analyzing conversation…</p>
            <p className="wf-lib-summ-sub">Extracting campaign goal, audience, and CTA</p>
          </div>
        ) : (
          <>
            <div className="wf-modal-head">
              <div className="modal-title">Import from Library</div>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
            </div>
            <p className="wf-lib-hint">
              Select a copy — AI will read the full conversation and extract the campaign brief to auto-fill the goal field.
            </p>
            <input className="input wf-field" style={{ marginBottom: 12 }}
              placeholder="Search copies…" value={search}
              onChange={e => setSearch(e.target.value)} autoFocus />
            {err && <p className="wf-paste-err" style={{ marginBottom: 8 }}>{err}</p>}
            {loading && <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" /></div>}
            {!loading && filtered.length === 0 && <p className="wf-lib-empty">No copies yet. Create some in Copywriters first.</p>}
            <div className="wf-lib-list">
              {filtered.map(c => (
                <button key={c.id} className="wf-lib-item" onClick={() => pick(c)}>
                  <div className="wf-lib-item-top">
                    <span className="wf-lib-item-title">{c.title || 'Untitled'}</span>
                    <span className="wf-badge wf-badge--draft">{c.type}</span>
                  </div>
                  {c.preview && <div className="wf-lib-item-preview">{c.preview.slice(0, 100)}{c.preview.length > 100 ? '…' : ''}</div>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Inline workflow builder ────────────────────────────────────────────────────
function WorkflowBuilder({ onCancel, onCreate, initialDraft = null, onReconnect }) {
  const locationId = getLocationId()

  const [draftId,    setDraftId]    = useState(initialDraft?.id    || null)
  const [name,       setName]       = useState(initialDraft?.name  || '')
  const [brief,      setBrief]      = useState(initialDraft?.brief || '')
  const [emailCount, setEmailCount] = useState(initialDraft?.emailCount ?? 3)
  const [smsCount,   setSmsCount]   = useState(initialDraft?.smsCount   ?? 1)
  const [steps,      setSteps]      = useState(initialDraft?.steps || [])
  const [phase,      setPhase]      = useState(initialDraft?.steps?.length ? 'preview' : 'form')
  const [err,        setErr]        = useState('')
  const [authErr,    setAuthErr]    = useState(false)
  const [libOpen,    setLibOpen]    = useState(false)

  // Load sessionStorage draft from Copywriters (only for fresh builder)
  useEffect(() => {
    if (initialDraft) return
    try {
      const raw = sessionStorage.getItem('automator_wf_draft')
      if (!raw) return
      const d = JSON.parse(raw)
      if (Date.now() - d.timestamp > 10 * 60 * 1000) { sessionStorage.removeItem('automator_wf_draft'); return }
      setBrief(d.content || '')
      const emailTypes = ['email', 'webinar', 'sales-page', 'blog']
      if (!emailTypes.includes(d.copywriterType)) { setEmailCount(2); setSmsCount(2) }
      if (d.copywriterType) setName(`${d.copywriterType} sequence`)
      sessionStorage.removeItem('automator_wf_draft')
    } catch {}
  }, [initialDraft])

  const eCount = Math.max(0, Number(emailCount) || 0)
  const sCount = Math.max(0, Number(smsCount)   || 0)
  const tCount = eCount + sCount

  function updateStep(i, key, val) {
    setSteps(s => s.map((step, j) => j === i ? { ...step, [key]: val } : step))
  }

  async function generateCopy() {
    if (!name.trim())  { setErr('Workflow name is required'); return }
    if (!brief.trim()) { setErr('Campaign goal is required'); return }
    if (tCount === 0)  { setErr('Set at least one email or SMS'); return }
    setErr(''); setPhase('generating')

    let aiConfig = {}
    try { aiConfig = JSON.parse(localStorage.getItem('ghl_ai_config') || '{}') } catch {}

    try {
      const r = await fetch('/api/workflows/generate-sequence', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          brief: brief.trim(), emailCount: eCount, smsCount: sCount,
          provider: aiConfig.provider, apiKey: aiConfig.apiKey, model: aiConfig.model,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Generation failed')

      setSteps(d.steps)
      setPhase('preview')

      // Auto-save / update draft in history
      if (draftId) {
        fetch(`/api/workflows/drafts/${draftId}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ locationId, name: name.trim(), brief: brief.trim(), steps: d.steps, emailCount: eCount, smsCount: sCount }),
        }).catch(() => {})
      } else {
        fetch('/api/workflows/drafts', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ locationId, name: name.trim(), brief: brief.trim(), steps: d.steps, emailCount: eCount, smsCount: sCount }),
        }).then(r => r.json()).then(saved => { if (saved?.id) setDraftId(saved.id) }).catch(() => {})
      }
    } catch (e) { setErr(e.message); setPhase('form') }
  }

  async function publish() {
    setErr(''); setAuthErr(false); setPhase('publishing')
    const trigger = { type: 'contact_created', name: 'Contact Created', conditions: [] }
    try {
      const r = await fetch('/api/workflows', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          locationId,
          name:       name.trim(),
          trigger,
          steps,
          workflowId: initialDraft?.ghlWorkflowId || undefined,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        if (d.error === 'ghl_unauthorized' || d.error === 'no_session') {
          setAuthErr(true)
          throw new Error('GHL is not reachable for this location. Make sure the app is installed on your agency account, then try again.')
        }
        throw new Error(d.error || JSON.stringify(d.raw || d))
      }

      // Mark draft as published
      if (draftId) {
        fetch(`/api/workflows/drafts/${draftId}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ locationId, steps, ghlWorkflowId: d.workflowId, publishedAt: Date.now() }),
        }).catch(() => {})
      }
      onCreate(d)
    } catch (e) { setErr(e.message); setPhase('preview') }
  }

  // ── Form view ──────────────────────────────────────────────────────────────
  if (phase === 'form' || phase === 'generating') {
    const busy = phase === 'generating'
    return (
      <div className="wf-builder">
        <div className="wf-builder-head">
          <div>
            <h2 className="wf-builder-title">{initialDraft ? 'Edit Sequence' : 'New Workflow Sequence'}</h2>
            <p className="wf-builder-sub">Describe your goal — AI writes a story-driven email &amp; SMS sequence.</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>

        <div className="wf-builder-body">
          <div className="wf-field-group">
            <label className="wf-lbl">Workflow Name</label>
            <input className="input wf-field" placeholder="e.g. Summer Sale Nurture Sequence"
              value={name} onChange={e => setName(e.target.value)} disabled={busy} />
          </div>

          <div className="wf-field-group">
            <div className="wf-brief-header">
              <label className="wf-lbl">Campaign Goal</label>
              <button className="btn btn-secondary btn-sm" onClick={() => setLibOpen(true)} disabled={busy}>
                📚 Import from Library
              </button>
            </div>
            <textarea className="wf-brief-ta" rows={6}
              placeholder={
                'Describe your campaign. Be specific:\n' +
                '• Who is the audience and what pain point do they have?\n' +
                '• What is the offer or product?\n' +
                '• What action should they take at the end?\n\n' +
                'Or click "Import from Library" to auto-fill from a saved copy.'
              }
              value={brief} onChange={e => setBrief(e.target.value)} disabled={busy} />
          </div>

          <div className="wf-builder-counts">
            <div className="wf-count-group">
              <label className="wf-lbl">Number of Emails</label>
              <input type="number" className="input wf-count-input" min={0} max={10}
                value={emailCount} onChange={e => setEmailCount(e.target.value)} disabled={busy} />
            </div>
            <div className="wf-count-group">
              <label className="wf-lbl">Number of SMS</label>
              <input type="number" className="input wf-count-input" min={0} max={10}
                value={smsCount} onChange={e => setSmsCount(e.target.value)} disabled={busy} />
            </div>
            <p className="wf-count-note">Timing between steps is set automatically from your goal.</p>
          </div>

          {err && <p className="wf-err" style={{ marginTop: 4 }}>{err}</p>}

          <div className="wf-builder-actions">
            <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className="btn btn-primary wf-generate-btn" onClick={generateCopy} disabled={busy || tCount === 0}>
              {busy && <span className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />}
              {busy ? `Writing ${eCount} email${eCount !== 1 ? 's' : ''}${sCount ? ` + ${sCount} SMS` : ''}…` : 'Generate Copy'}
            </button>
          </div>
        </div>

        {libOpen && <LibraryAnalyzer onFill={t => { setBrief(t); setLibOpen(false) }} onClose={() => setLibOpen(false)} />}
      </div>
    )
  }

  // ── Preview view ───────────────────────────────────────────────────────────
  const busy       = phase === 'publishing'
  const emailSteps = steps.filter(s => s.type === 'email')
  const smsSteps   = steps.filter(s => s.type === 'sms')
  const isPublished = !!initialDraft?.ghlWorkflowId
  let emailIdx = 0, smsIdx = 0

  return (
    <div className="wf-builder">
      <div className="wf-builder-head">
        <div>
          <h2 className="wf-builder-title">{name}</h2>
          <p className="wf-builder-sub">
            {emailSteps.length} email{emailSteps.length !== 1 ? 's' : ''}
            {smsSteps.length ? ` · ${smsSteps.length} SMS` : ''} · Review and edit before publishing
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setPhase('form')} disabled={busy}>← Edit Goal</button>
      </div>

      <div className="wf-preview-steps">
        {steps.map((step, i) => {
          if (step.type === 'wait') return (
            <div key={i} className="wf-wait-divider">
              <div className="wf-wait-line" />
              <span className="wf-wait-label">⏱ {step.value} {step.unit}</span>
              <div className="wf-wait-line" />
            </div>
          )
          if (step.type === 'email') {
            const n = ++emailIdx
            return (
              <div key={i} className="wf-preview-card wf-preview-card--email">
                <div className="wf-preview-card-head">
                  <span className="wf-preview-badge wf-preview-badge--email">✉ Email {n}</span>
                  {step.name && <span className="wf-preview-card-label">{step.name}</span>}
                </div>
                <div className="wf-field-group" style={{ marginBottom: 10 }}>
                  <label className="wf-lbl" style={{ fontSize: '.75rem', marginBottom: 4 }}>Subject line</label>
                  <input className="input wf-field" value={step.subject || ''}
                    onChange={e => updateStep(i, 'subject', e.target.value)} disabled={busy} />
                </div>
                <div className="wf-field-group">
                  <label className="wf-lbl" style={{ fontSize: '.75rem', marginBottom: 4 }}>Body</label>
                  <textarea className="wf-ta" style={{ minHeight: 180 }} value={step.body || ''}
                    onChange={e => updateStep(i, 'body', e.target.value)} disabled={busy} />
                </div>
              </div>
            )
          }
          if (step.type === 'sms') {
            const n = ++smsIdx
            return (
              <div key={i} className="wf-preview-card wf-preview-card--sms">
                <div className="wf-preview-card-head">
                  <span className="wf-preview-badge wf-preview-badge--sms">💬 SMS {n}</span>
                  {step.name && <span className="wf-preview-card-label">{step.name}</span>}
                </div>
                <textarea className="wf-ta" rows={3} value={step.body || ''}
                  onChange={e => updateStep(i, 'body', e.target.value)} disabled={busy} />
              </div>
            )
          }
          return null
        })}
      </div>

      {err && <p className="wf-err" style={{ marginTop: 12 }}>{err}</p>}

      {authErr && (
        <div className="wf-auth-err-box">
          <p className="wf-auth-err-msg">
            GHL could not be reached for this location. Confirm the app is installed on your agency account, then try again.
          </p>
          <div className="wf-panel-actions">
            <button className="btn btn-primary btn-sm" onClick={() => { setAuthErr(false); publish() }}>Retry</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAuthErr(false)}>Dismiss</button>
          </div>
        </div>
      )}

      <div className="wf-builder-actions" style={{ marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={() => setPhase('form')} disabled={busy}>← Edit Goal</button>
        <button className="btn btn-secondary" onClick={generateCopy} disabled={busy}>↻ Regenerate</button>
        <button className="btn btn-primary wf-generate-btn" onClick={publish} disabled={busy || authErr}>
          {busy && <span className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />}
          {busy ? 'Publishing to GHL…' : isPublished ? 'Republish to GHL →' : 'Publish to GHL →'}
        </button>
      </div>
    </div>
  )
}

// ── Relative time helper ──────────────────────────────────────────────────────
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)   return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Workflows() {
  const locationId = getLocationId()
  const [searchParams] = useSearchParams()
  const [connected,   setConnected]   = useState(false)
  const [workflows,   setWorkflows]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [listErr,     setListErr]     = useState('')
  const [showBuilder, setShowBuilder] = useState(false)
  const [editDraft,   setEditDraft]   = useState(null)   // draft object to edit
  const [drafts,      setDrafts]      = useState([])
  const [draftsLoad,  setDraftsLoad]  = useState(true)
  const [toast,       setToast]       = useState('')

  // Auto-open builder when arriving from Copywriters via ?build=1
  const didAutoOpen = useRef(false)
  useEffect(() => {
    if (didAutoOpen.current) return
    if (searchParams.get('build') === '1') {
      didAutoOpen.current = true
      setShowBuilder(true)
    }
  }, [searchParams])

  const loadDrafts = useCallback(async () => {
    setDraftsLoad(true)
    try {
      const r = await fetch(`/api/workflows/drafts?locationId=${locationId}`)
      const d = await r.json()
      setDrafts(Array.isArray(d) ? d : [])
    } catch {}
    setDraftsLoad(false)
  }, [locationId])

  useEffect(() => { loadDrafts() }, [loadDrafts])

  async function deleteDraft(id) {
    await fetch(`/api/workflows/drafts/${id}?locationId=${locationId}`, { method: 'DELETE' }).catch(() => {})
    setDrafts(ds => ds.filter(d => d.id !== id))
  }

  function openDraft(draft) {
    // Need full draft with steps — fetch it
    fetch(`/api/workflows/drafts/${draft.id}`)
      .then(r => r.json())
      .then(full => { setEditDraft(full); setShowBuilder(true) })
      .catch(() => { setEditDraft(draft); setShowBuilder(true) })
  }

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const checkSession = useCallback(async () => {
    try {
      const r = await apiFetch('/api/workflows/session/status')
      const d = await r.json()
      return !!d.connected
    } catch { return false }
  }, [])

  const loadWorkflows = useCallback(async () => {
    setLoading(true); setListErr('')
    try {
      const r = await apiFetch('/api/workflows')
      if (r.status === 401) { setWorkflows([]); setLoading(false); return }
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Load failed') }
      const d = await r.json()
      setWorkflows(Array.isArray(d) ? d : [])
    } catch (e) { setListErr(e.message) }
    setLoading(false)
  }, [])

  // Authentication is automatic — the server mints a location token from the
  // agency OAuth install. Just check whether that succeeds for this location.
  const recheck = useCallback(() => {
    setLoading(true)
    checkSession().then(ok => {
      setConnected(ok)
      if (ok) loadWorkflows()
      else setLoading(false)
    })
  }, [checkSession, loadWorkflows])

  useEffect(() => { recheck() }, [recheck])

  function onCreated() {
    setShowBuilder(false)
    setEditDraft(null)
    flash('Workflow published to GHL!')
    loadWorkflows()
    loadDrafts()
  }

  function triggerLabel(wf) {
    const t = wf.triggers?.[0]?.type || wf.type || ''
    return TRIGGER_TYPES.find(x => x.value === t)?.label || t || '—'
  }

  function stepSummary(wf) {
    const tpls = wf.workflowData?.templates || []
    if (!tpls.length) return 'No steps'
    const counts = {}
    tpls.forEach(s => { counts[s.type] = (counts[s.type] || 0) + 1 })
    return Object.entries(counts).map(([t, n]) => `${n}× ${t}`).join('  ·  ')
  }

  return (
    <>
      {/* Top nav */}
      <div className="topnav">
        <div className="topnav-left">
          <span className="breadcrumb-current">Workflows</span>
        </div>
        <div className="topnav-right">
          {!showBuilder && connected && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowBuilder(true)}>
              + New Workflow
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Session status bar — hide while builder is open */}
        {!showBuilder && (
          <>
            <div className={`wf-sess-bar ${connected ? 'wf-sess-bar--ok' : 'wf-sess-bar--warn'}`}>
              <div className="wf-sess-left">
                <span className="wf-sess-dot" />
                <span className="wf-sess-text">
                  {connected
                    ? 'GHL connected — workflows can be created and listed'
                    : 'GHL not reachable for this location. Ensure the app is installed on your agency account.'}
                </span>
              </div>
              {!connected && (
                <button className="btn btn-secondary btn-sm wf-sess-btn" onClick={recheck} disabled={loading}>
                  {loading ? 'Checking…' : 'Retry'}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Inline builder ── */}
        {showBuilder && (
          <WorkflowBuilder
            initialDraft={editDraft}
            onCancel={() => { setShowBuilder(false); setEditDraft(null) }}
            onCreate={onCreated}
            onReconnect={recheck}
          />
        )}

        {/* ── Main view ── */}
        {!showBuilder && (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Workflows</h1>
                <p className="page-sub">Create and manage GHL automation workflows</p>
              </div>
            </div>

            {/* ── Sequence History ── */}
            {(draftsLoad || drafts.length > 0) && (
              <div className="wf-history">
                <div className="wf-history-head">
                  <h3 className="wf-history-title">Sequence History</h3>
                  <span className="wf-history-count">{drafts.length} saved</span>
                </div>

                {draftsLoad && (
                  <div style={{ padding: '16px 0' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                )}

                <div className="wf-history-list">
                  {drafts.map(d => (
                    <div key={d.id} className="wf-history-card">
                      <div className="wf-history-card-info">
                        <div className="wf-history-card-name">{d.name}</div>
                        <div className="wf-history-card-meta">
                          <span className={`wf-badge ${d.publishedAt ? 'wf-badge--published' : 'wf-badge--draft'}`}>
                            {d.publishedAt ? '✓ Published' : 'Draft'}
                          </span>
                          <span className="wf-history-stat">{d.emailCount} email{d.emailCount !== 1 ? 's' : ''}</span>
                          {d.smsCount > 0 && <span className="wf-history-stat">{d.smsCount} SMS</span>}
                          <span className="wf-history-time">{timeAgo(d.updatedAt || d.createdAt)}</span>
                        </div>
                      </div>
                      <div className="wf-history-card-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => openDraft(d)}>
                          {d.publishedAt ? 'Edit & Republish' : 'Edit'}
                        </button>
                        {d.ghlWorkflowId && (
                          <a href={`https://app.gohighlevel.com/v2/location/${locationId}/workflows/${d.ghlWorkflowId}`}
                            target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                            GHL ↗
                          </a>
                        )}
                        <button className="btn btn-ghost btn-sm wf-history-del"
                          onClick={() => deleteDraft(d.id)} title="Delete">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Live GHL Workflows ── */}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div className="spinner" />
              </div>
            )}
            {!loading && listErr && <div className="wf-err-box">{listErr}</div>}
            {!loading && !listErr && !connected && drafts.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-text">
                  GHL isn’t reachable for this location. Make sure Automator is installed on your agency account.
                </p>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={recheck}>
                  Retry
                </button>
              </div>
            )}
            {!loading && !listErr && connected && workflows.length === 0 && drafts.length === 0 && (
              <div className="empty-state">
                <p className="empty-state-text">No workflows yet — create your first sequence</p>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowBuilder(true)}>
                  + New Workflow
                </button>
              </div>
            )}
            {workflows.length > 0 && (
              <>
                <h3 className="wf-section-title">Live in GHL</h3>
                <div className="wf-list">
                  {workflows.map(wf => (
                    <div key={wf.id || wf._id} className="wf-card">
                      <div className="wf-card-info">
                        <div className="wf-card-name">{wf.name}</div>
                        <div className="wf-card-meta">
                          <span className={`wf-badge wf-badge--${wf.status || 'draft'}`}>{wf.status || 'draft'}</span>
                          <span className="wf-card-trigger">⚡ {triggerLabel(wf)}</span>
                          <span className="wf-card-steps">{stepSummary(wf)}</span>
                        </div>
                      </div>
                      <a href={`https://app.gohighlevel.com/v2/location/${locationId}/workflows/${wf.id || wf._id}`}
                        target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                        Open in GHL ↗
                      </a>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {toast && <div className="wf-toast">{toast}</div>}
    </>
  )
}
