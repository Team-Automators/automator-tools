import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAIConfig } from '../hooks/useAIConfig.js'
import { api, getLocationId } from '../lib/api.js'
import { notifySuccess, notifyError, confirmToast } from '../lib/toast.jsx'

const PRICE_POINTS = ['Free / Lead magnet', '$100 to $1k', '$1k to $5k', '$5k to $25k', '$25k+']
const TRAFFIC      = ['Paid ads', 'Organic / Social', 'Email list', 'SEO', 'Referrals', 'Cold outreach']
const GOALS        = ['Book calls', 'Sell a product', 'Collect leads', 'Webinar registrations', 'Applications']

// GHL automation step types → our palette (no pink).
const STEP = {
  TAG:       '#8B5CF6',
  PIPELINE:  '#6366F1',
  EMAIL:     '#10B981',
  SMS:       '#06B6D4',
  WAIT:      '#F59E0B',
  INTERNAL:  '#64748B',
  CONDITION: '#EF4444',
}
const stepColor = (t) => STEP[String(t || '').toUpperCase()] || '#64748B'

function Chip({ children, color }) {
  return (
    <span style={{ fontSize: '.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: 99, border: '1px solid var(--border)', background: color ? `${color}18` : 'var(--surface)', color: color || 'var(--sub)', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}
function Flow({ pages }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {(pages || []).map((p, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)' }}>{p}</span>
          {i < pages.length - 1 && <span style={{ color: 'var(--sub)' }}>→</span>}
        </span>
      ))}
    </div>
  )
}

// Plain-text build sheet (Copy) + printable HTML (Download PDF).
function buildToText(ctx, b) {
  const L = []
  L.push(`FUNNEL BUILD SHEET`, b.funnelName || '', b.flow || '', '')
  L.push(`OFFER: ${ctx.offer}`)
  L.push(`PRICE POINT: ${ctx.price}`, `TRAFFIC: ${ctx.traffic}`, `GOAL: ${ctx.goal}`)
  if (b.watchOut) L.push(`WATCH OUT: ${b.watchOut}`)
  L.push('', '== CUSTOMER JOURNEY ==')
  ;(b.journey || []).forEach((j, i) => {
    L.push('', `${i + 1}. ${j.page}`)
    if (j.mindset) L.push(`   MINDSET: ${j.mindset}`)
    if (j.pageJob) L.push(`   PAGE JOB: ${j.pageJob}`)
    ;(j.mustHave || []).forEach(m => L.push(`   MUST HAVE: ${m}`))
    if (j.button) L.push(`   BUTTON: ${j.button}`)
    if (j.dropOff) L.push(`   DROP-OFF: ${j.dropOff}`)
  })
  if ((b.pageCopy || []).length) {
    L.push('', '== PAGE COPY ==')
    b.pageCopy.forEach(p => {
      L.push('', `${p.badge || p.page}`)
      if (p.headline) L.push(`   ${p.headline}`)
      if (p.subhead) L.push(`   ${p.subhead}`)
      ;(p.bullets || []).forEach(x => L.push(`   • ${x}`))
      if ((p.formFields || []).length) L.push(`   FORM: ${p.formFields.join(', ')}`)
      if (p.button) L.push(`   [${p.button}]`)
      if (p.testimonial) L.push(`   ${p.testimonial}`)
    })
  }
  L.push('', '== GHL AUTOMATION MAP ==')
  ;(b.workflows || []).forEach(w => {
    L.push('', `${w.name}  (Trigger: ${w.trigger})`)
    ;(w.steps || []).forEach(s => L.push(`   [${String(s.type).toUpperCase()}] ${s.text}`))
  })
  if ((b.tagsToCreate || []).length)   L.push('', `TAGS TO CREATE: ${b.tagsToCreate.join(', ')}`)
  if ((b.customFields || []).length)   L.push(`CUSTOM FIELDS: ${b.customFields.join(', ')}`)
  if ((b.pipelineStages || []).length) L.push(`PIPELINE STAGES: ${b.pipelineStages.join(' → ')}`)
  return L.join('\n')
}

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function downloadPDF(ctx, b) {
  const w = window.open('', '_blank')
  if (!w) { notifyError('Allow pop-ups to download the PDF'); return }
  const row = (label, val) => `<tr><td class="lbl">${esc(label)}</td><td>${val}</td></tr>`
  const journey = (b.journey || []).map((j, i) => `
    <div class="blk"><h3>${i + 1}. ${esc(j.page)}</h3><table>
      ${j.mindset ? row('MINDSET', esc(j.mindset)) : ''}
      ${j.pageJob ? row('PAGE JOB', esc(j.pageJob)) : ''}
      ${(j.mustHave || []).length ? row('MUST HAVE', (j.mustHave || []).map(esc).join('<br>')) : ''}
      ${j.button ? row('BUTTON', `<b>${esc(j.button)}</b>`) : ''}
      ${j.dropOff ? row('DROP-OFF', esc(j.dropOff)) : ''}
    </table></div>`).join('')
  const wf = (b.workflows || []).map(wf => `
    <div class="blk"><h3>${esc(wf.name)}</h3><div class="trg">Trigger: ${esc(wf.trigger)}</div>
      <table>${(wf.steps || []).map(s => `<tr><td class="lbl">${esc(String(s.type).toUpperCase())}</td><td>${esc(s.text)}</td></tr>`).join('')}</table></div>`).join('')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(b.funnelName || 'Funnel Build Sheet')}</title>
    <style>
      *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;margin:32px;font-size:12px;line-height:1.5}
      h1{font-size:20px;margin:0 0 2px} h2{font-size:13px;letter-spacing:.06em;background:#0f172a;color:#fff;padding:6px 10px;border-radius:6px;margin:22px 0 10px}
      h3{font-size:13px;margin:0 0 6px} .flow{color:#475569;margin:0 0 16px}
      .sub{color:#64748b;text-transform:uppercase;letter-spacing:.08em;font-size:10px;font-weight:700}
      table{width:100%;border-collapse:collapse;margin:2px 0} td{padding:5px 8px;vertical-align:top;border-top:1px solid #e2e8f0}
      td.lbl{width:110px;color:#64748b;font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:.05em}
      .blk{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin:0 0 12px} .trg{font-size:10px;color:#334155;margin:0 0 6px}
      .meta td.lbl{width:120px} @media print{body{margin:12mm}}
    </style></head><body>
    <div class="sub">Funnel Build Sheet</div>
    <h1>${esc(b.funnelName || '')}</h1>
    <div class="flow">${esc(b.flow || '')}</div>
    <table class="meta">
      ${row('OFFER', esc(ctx.offer))}
      ${row('PRICE POINT', esc(ctx.price))}
      ${row('TRAFFIC', esc(ctx.traffic))}
      ${row('GOAL', esc(ctx.goal))}
      ${b.watchOut ? row('WATCH OUT', esc(b.watchOut)) : ''}
    </table>
    <h2>CUSTOMER JOURNEY</h2>${journey}
    <h2>GHL AUTOMATION MAP</h2>${wf}
    ${(b.tagsToCreate || []).length ? `<h2>SETUP</h2><table>${row('TAGS', (b.tagsToCreate || []).map(esc).join(', '))}${row('CUSTOM FIELDS', (b.customFields || []).map(esc).join(', '))}${row('PIPELINE', (b.pipelineStages || []).map(esc).join(' → '))}</table>` : ''}
    <script>window.onload=function(){window.print()}</script>
    </body></html>`)
  w.document.close()
}

export default function FunnelArchitect() {
  const navigate = useNavigate()
  const location = useLocation()
  const locationId = getLocationId()
  const { config, loading: configLoading } = useAIConfig()
  const handoffDone = useRef(false)

  const [stage, setStage]     = useState('intake') // intake | options | pages | build
  const [offer, setOffer]     = useState('')
  const [price, setPrice]     = useState(PRICE_POINTS[1])
  const [traffic, setTraffic] = useState(TRAFFIC[0])
  const [goal, setGoal]       = useState(GOALS[0])
  const [inputMode, setInputMode] = useState('offer') // 'offer' | 'notes'
  const [notes, setNotes]     = useState('')
  const [notesFile, setNotesFile] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const [options, setOptions] = useState([])
  const [chosen, setChosen]   = useState(null)
  const [selPages, setSelPages] = useState([])
  const [build, setBuild]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [copyIdx, setCopyIdx] = useState(0)   // which page-copy page is showing
  const [rewriting, setRewriting] = useState(false)
  const [feedback, setFeedback] = useState(null)   // 'up' | 'down' on the current build
  const [showPB, setShowPB]   = useState(false)    // playbook panel open
  const [pb, setPb]           = useState(null)     // { playbook, count, examples }
  const [pbText, setPbText]   = useState('')
  const [pbBusy, setPbBusy]   = useState(false)
  const notesFileRef = useRef(null)

  const ctx = { offer, price, traffic, goal }
  const aiArgs = () => ({ offer, pricePoint: price, traffic, goal, notes, provider: config.provider, apiKey: config.apiKey, model: config.model })

  const TEXT_EXTS = ['txt', 'vtt', 'srt', 'md', 'csv', 'rtf', 'json', 'html', 'htm', 'log']
  async function onNotesFile(e) {
    const file = e.target.files?.[0]; if (!file) return
    setNotesFile(file.name)
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (TEXT_EXTS.includes(ext)) {
      const reader = new FileReader()
      reader.onload = () => setNotes(prev => (prev ? prev + '\n\n' : '') + String(reader.result || ''))
      reader.readAsText(file)
      e.target.value = ''
      return
    }
    setExtracting(true)
    try {
      const { text, chars } = await api.extractFile(file)
      setNotes(prev => (prev ? prev + '\n\n' : '') + text)
      notifySuccess(`Extracted ${chars.toLocaleString()} characters`)
    } catch (err) { notifyError(err.message || 'Could not read that file'); setNotesFile('') }
    finally { setExtracting(false); e.target.value = '' }
  }

  async function analyzeNotes() {
    if (!notes.trim()) { notifyError('Paste or upload notes first'); return }
    if (!config?.apiKey) { notifyError('Connect an AI provider in Settings first'); return }
    setAnalyzing(true)
    try {
      const d = await api.architectFromNotes({ notes, provider: config.provider, apiKey: config.apiKey, model: config.model })
      if (d.offer) setOffer(d.offer)
      if (d.pricePoint) setPrice(d.pricePoint)
      if (d.traffic) setTraffic(d.traffic)
      if (d.goal) setGoal(d.goal)
      notifySuccess('Read your notes — offer & inputs filled in')
    } catch (e) { notifyError(e.message || 'Could not read the notes') } finally { setAnalyzing(false) }
  }

  // Hand-off from the Analyzer: prefill notes and run notes → offer → options with
  // explicit values (avoids stale React state).
  async function runFromNotes(text) {
    setNotes(text)
    setAnalyzing(true)
    let derived = { offer: '', pricePoint: price, traffic, goal }
    try {
      const d = await api.architectFromNotes({ notes: text, provider: config.provider, apiKey: config.apiKey, model: config.model })
      derived = { offer: d.offer || '', pricePoint: d.pricePoint || price, traffic: d.traffic || traffic, goal: d.goal || goal }
      setOffer(derived.offer); setPrice(derived.pricePoint); setTraffic(derived.traffic); setGoal(derived.goal)
    } catch (e) { setAnalyzing(false); notifyError(e.message || 'Could not read the notes'); return }
    setAnalyzing(false)
    setLoading(true)
    try {
      const j = await api.architectOptions({ ...derived, notes: text, provider: config.provider, apiKey: config.apiKey, model: config.model })
      setOptions(j.options || []); setStage('options')
    } catch (e) { notifyError(e.message || 'Failed') } finally { setLoading(false) }
  }

  // When arriving from the Analyzer with material, prefill and (if auto) run once
  // the AI config is ready.
  useEffect(() => {
    const st = location.state
    if (!st?.notes || handoffDone.current) return
    if (st.auto && !config?.apiKey) return // wait for config to load
    handoffDone.current = true
    if (st.auto && config?.apiKey) runFromNotes(st.notes)
    else { setNotes(st.notes); setInputMode('notes') }
  }, [location.state, config?.apiKey])

  async function getOptions() {
    if (!offer.trim()) { notifyError('Tell me the offer first'); return }
    if (!config?.apiKey) { notifyError('Connect an AI provider in Settings first'); return }
    setLoading(true)
    try {
      const j = await api.architectOptions(aiArgs())
      setOptions(j.options || [])
      setStage('options')
    } catch (e) { notifyError(e.message || 'Failed') } finally { setLoading(false) }
  }

  function pickOption(opt) {
    setChosen(opt)
    const core = opt.corePages && opt.corePages.length ? opt.corePages : (opt.mvpFlow || [])
    // Keep the option's page order; pre-select the core pages.
    setSelPages((opt.pages && opt.pages.length ? opt.pages : (opt.mvpFlow || [])).filter(p => core.includes(p)))
    setStage('pages')
  }

  const orderedSelected = () => {
    const all = (chosen?.pages && chosen.pages.length ? chosen.pages : (chosen?.mvpFlow || []))
    return all.filter(p => selPages.includes(p))
  }

  async function mapFunnel() {
    const pages = orderedSelected()
    if (!pages.length) { notifyError('Select at least one page'); return }
    setLoading(true)
    try {
      const j = await api.architectBuild({ ...aiArgs(), funnelName: chosen.name, pages })
      setBuild(j)
      setCopyIdx(0)
      setFeedback(null)
      setStage('build')
      // Evolve the account playbook so the next build is sharper (background).
      api.architectLearn({ ...aiArgs(), funnelName: j.funnelName || chosen.name, flow: j.flow || pages.join(' → '), kept: false })
    } catch (e) { notifyError(e.message || 'Failed') } finally { setLoading(false) }
  }

  async function openPlaybook() {
    const next = !showPB
    setShowPB(next)
    if (next) {
      setPbBusy(true)
      try { const m = await api.getArchitectMemory(); setPb(m); setPbText(m.playbook || '') }
      catch { /* ignore */ } finally { setPbBusy(false) }
    }
  }
  async function savePlaybook() {
    setPbBusy(true)
    try { await api.setArchitectPlaybook(pbText); setPb(p => ({ ...(p || {}), playbook: pbText })); notifySuccess('Playbook saved') }
    catch (e) { notifyError(e.message || 'Save failed') } finally { setPbBusy(false) }
  }
  async function resetPlaybook() {
    if (!(await confirmToast('Reset everything the Architect has learned for this account? This clears the playbook and history.', { confirmText: 'Reset', danger: true }))) return
    setPbBusy(true)
    try { await api.resetArchitectMemory(); setPb({ playbook: '', count: 0, examples: [] }); setPbText(''); notifySuccess('Playbook reset') }
    catch (e) { notifyError(e.message || 'Reset failed') } finally { setPbBusy(false) }
  }

  function thumb(sentiment) {
    setFeedback(sentiment)
    api.architectLearn({ ...aiArgs(), funnelName: build.funnelName, flow: build.flow, sentiment })
    notifySuccess(sentiment === 'up' ? 'Thanks — reinforced for next time' : 'Noted — I’ll steer away from this')
  }

  async function rewriteCopy() {
    setRewriting(true)
    try {
      const pages = (build.pageCopy || []).map(p => p.page).filter(Boolean)
      const j = await api.architectPageCopy({ ...aiArgs(), funnelName: build.funnelName, pages: pages.length ? pages : orderedSelected() })
      if (Array.isArray(j.pageCopy) && j.pageCopy.length) {
        setBuild(b => ({ ...b, pageCopy: j.pageCopy }))
        setCopyIdx(i => Math.min(i, j.pageCopy.length - 1))
        notifySuccess('Page copy rewritten')
      }
    } catch (e) { notifyError(e.message || 'Rewrite failed') } finally { setRewriting(false) }
  }

  function copySheet() {
    navigator.clipboard?.writeText(buildToText(ctx, build)).then(() => notifySuccess('Build sheet copied')).catch(() => {})
  }
  async function saveToLibrary() {
    setSaving(true)
    try {
      const title = `Funnel Build — ${build.funnelName || offer.slice(0, 40)}`
      const copy = await api.saveCopy({
        customerId: '_unsorted', customerName: '', type: 'general', title,
        preview: (build.flow || '').slice(0, 120),
        messages: [
          { role: 'user', content: `Offer: ${offer}\nPrice: ${price} · Traffic: ${traffic} · Goal: ${goal}` },
          { role: 'assistant', content: buildToText(ctx, build) },
        ],
      })
      notifySuccess('Saved to Library')
      // A save is the strongest "this resonated" signal — reinforce the playbook.
      api.architectLearn({ ...aiArgs(), funnelName: build.funnelName, flow: build.flow, kept: true })
      if (copy?.id) {
        const u = new URL(`/library/_unsorted/${copy.id}`, window.location.origin)
        if (locationId) u.searchParams.set('locationId', locationId)
        navigate(u.pathname + u.search)
      }
    } catch (e) { notifyError(e.message || 'Could not save') } finally { setSaving(false) }
  }

  const Kicker = ({ children }) => <span style={{ fontSize: '.66rem', fontWeight: 700, letterSpacing: '.1em', color: 'var(--sub)', marginLeft: 10 }}>{children}</span>

  return (
    <>
      <div className="topnav">
        <div className="topnav-left"><span className="breadcrumb-current">Funnel Architect</span></div>
        <div className="topnav-right" style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm ${showPB ? 'btn-secondary' : 'btn-ghost'}`} onClick={openPlaybook} title="What the Architect has learned for this account">
            ✦ Playbook
          </button>
          {stage !== 'intake' && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setStage('intake'); setBuild(null); setChosen(null); setFeedback(null) }}>Start over</button>
          )}
        </div>
      </div>

      <div className="content" style={{ maxWidth: 980 }}>

        <Stepper stage={stage} />

        {/* ── Playbook panel ─────────────────────────────────────── */}
        {showPB && (
          <div className="card" style={{ padding: 18, marginBottom: 18, borderLeft: '3px solid var(--accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <div>
                <div className="fw-700">Account Playbook</div>
                <div style={{ fontSize: '.76rem', color: 'var(--sub)' }}>
                  What the Architect has learned for this account{pb?.count ? ` · ${pb.count} build${pb.count !== 1 ? 's' : ''} so far` : ''}. It gets applied to every generation and sharpens with 👍/👎 and saves.
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPB(false)}>Close</button>
            </div>
            {pbBusy && !pb ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--sub)', padding: '10px 0' }}><div className="spinner" /> Loading…</div>
            ) : (
              <>
                <textarea className="form-input" style={{ minHeight: 130, resize: 'vertical', fontFamily: 'inherit', fontSize: '.85rem', background: 'var(--surface)' }}
                  value={pbText} onChange={e => setPbText(e.target.value)}
                  placeholder="The playbook is still learning — run a few builds, or write your own notes here (funnel types that fit, tone, offers, what to avoid)…" />
                {(pb?.examples || []).length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--sub)', marginBottom: 6 }}>RECENT BUILDS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {pb.examples.map((e, i) => (
                        <div key={i} style={{ fontSize: '.78rem', color: 'var(--sub)', display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{e.funnelName}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.offer}</span>
                          {e.kept && <span style={{ color: 'var(--accent)' }}>★ saved</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" onClick={savePlaybook} disabled={pbBusy}>Save playbook</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={resetPlaybook} disabled={pbBusy}>Reset learning</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Intake ─────────────────────────────────────────────── */}
        {stage === 'intake' && (
          <>
            <div className="page-header">
              <div>
                <div className="page-title">Funnel Architect</div>
                <div className="page-sub">Start with your offer, or drop in a meeting transcript — one build sheet out.</div>
              </div>
            </div>

            {/* Mode chooser */}
            <div style={{ display: 'inline-flex', gap: 4, background: 'var(--surface)', borderRadius: 10, padding: 4, marginBottom: 14 }}>
              <button className={`btn btn-sm ${inputMode === 'offer' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setInputMode('offer')}>I have the offer</button>
              <button className={`btn btn-sm ${inputMode === 'notes' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setInputMode('notes')}>I have meeting notes / transcript</button>
            </div>

            {inputMode === 'offer' ? (
              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">The offer</label>
                  <textarea className="form-input" style={{ minHeight: 120, resize: 'vertical', fontFamily: 'inherit', background: 'var(--surface)' }}
                    value={offer} onChange={e => setOffer(e.target.value)}
                    placeholder='Example: 12-week 1-on-1 coaching for female founders who want to hit their first $10k month. Includes weekly calls, a template vault, and Slack access.' />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}><label className="form-label">Price point</label>
                    <select className="form-input form-select" value={price} onChange={e => setPrice(e.target.value)}>{PRICE_POINTS.map(p => <option key={p}>{p}</option>)}</select></div>
                  <div className="form-group" style={{ margin: 0 }}><label className="form-label">Main traffic</label>
                    <select className="form-input form-select" value={traffic} onChange={e => setTraffic(e.target.value)}>{TRAFFIC.map(t => <option key={t}>{t}</option>)}</select></div>
                  <div className="form-group" style={{ margin: 0 }}><label className="form-label">Primary goal</label>
                    <select className="form-input form-select" value={goal} onChange={e => setGoal(e.target.value)}>{GOALS.map(g => <option key={g}>{g}</option>)}</select></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={getOptions} disabled={loading || configLoading || !offer.trim()}>
                    {loading ? 'Thinking…' : 'Recommend funnels'}
                  </button>
                  <span style={{ fontSize: '.75rem', color: 'var(--sub)' }}>funnel type · page flow · customer journey · GHL workflows</span>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <label className="form-label" style={{ margin: 0 }}>Meeting transcript, notes, or summary</label>
                  <input ref={notesFileRef} type="file" accept=".pdf,.docx,.txt,.vtt,.srt,.md,.csv,.rtf,.json,.html,.htm,.log,application/pdf" onChange={onNotesFile} style={{ display: 'none' }} />
                  <button className="btn btn-ghost btn-sm" onClick={() => notesFileRef.current?.click()} disabled={extracting}>
                    {extracting ? 'Reading file…' : '📎 Upload PDF / Word / text'}
                  </button>
                </div>
                <textarea className="form-input" style={{ minHeight: 160, resize: 'vertical', fontFamily: 'inherit', background: 'var(--surface)' }}
                  value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Paste the Zoom/call transcript or your meeting notes here — or upload a file. I’ll read it, derive the offer, and recommend funnels." />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => runFromNotes(notes)} disabled={analyzing || loading || extracting || configLoading || !notes.trim()}>
                    {analyzing ? 'Reading your notes…' : loading ? 'Recommending funnels…' : 'Build from notes →'}
                  </button>
                  {notesFile && !extracting && <span style={{ fontSize: '.75rem', color: 'var(--sub)' }}>{notesFile}</span>}
                  <span style={{ fontSize: '.75rem', color: 'var(--sub)' }}>derives the offer → recommends funnels</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Options ────────────────────────────────────────────── */}
        {stage === 'options' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div className="page-title" style={{ display: 'inline' }}>Three ways to build this</div><Kicker>PICK ONE TO MAP IT</Kicker>
              <div className="page-sub" style={{ marginTop: 6 }}>Based on your offer, price point, traffic, and goal.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 14 }}>
              {options.map((o, i) => {
                const best = i === 0
                return (
                  <div key={o.id || i} className="card" style={{ position: 'relative', overflow: 'hidden', padding: 16, paddingTop: best ? 20 : 16, display: 'flex', flexDirection: 'column', gap: 8, border: best ? '1px solid var(--accent)' : '1px solid var(--border)', boxShadow: best ? '0 8px 28px color-mix(in srgb, var(--accent) 20%, transparent)' : undefined }}>
                    {best && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#14B8A6,var(--accent))' }} />}
                    <Chip color={best ? 'var(--accent)' : undefined}>{(o.badge || (best ? 'Best Fit' : `Option ${i + 1}`)).toUpperCase()}</Chip>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>{o.name}</div>
                    <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--sub)' }}>{o.tagline}</div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.66rem', color: 'var(--sub)', marginBottom: 3 }}><span>FIT</span><span>{o.fit ?? ''}</span></div>
                      <div style={{ height: 6, borderRadius: 99, background: 'var(--surface)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, o.fit || 0))}%`, height: '100%', background: 'linear-gradient(90deg,#14B8A6,var(--accent))' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '.84rem', color: 'var(--text)', lineHeight: 1.5 }}>{o.description}</div>
                    <div style={{ marginTop: 2 }}>
                      <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--sub)', marginBottom: 4 }}>MVP FLOW · {(o.mvpFlow || []).length} PAGES</div>
                      <Flow pages={o.mvpFlow} />
                    </div>
                    {o.watchOut && <div style={{ fontSize: '.76rem', color: 'var(--danger)', lineHeight: 1.4 }}>Watch out: {o.watchOut}</div>}
                    <button className="btn btn-primary btn-sm" style={{ marginTop: 'auto' }} onClick={() => pickOption(o)}>Pick this →</button>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Confirm pages ──────────────────────────────────────── */}
        {stage === 'pages' && chosen && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div className="page-title" style={{ display: 'inline' }}>Confirm the pages</div><Kicker>CORE PAGES ARE ON, ADD-ONS ARE OFF</Kicker>
              <div className="page-sub" style={{ marginTop: 6 }}>{chosen.name}</div>
            </div>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
                {(chosen.pages && chosen.pages.length ? chosen.pages : chosen.mvpFlow || []).map(p => {
                  const core = (chosen.corePages || chosen.mvpFlow || []).includes(p)
                  const on = selPages.includes(p)
                  return (
                    <label key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', background: on ? 'var(--accent-bg, rgba(99,102,241,.06))' : 'var(--card)' }}>
                      <input type="checkbox" checked={on} style={{ marginTop: 3 }}
                        onChange={() => setSelPages(s => s.includes(p) ? s.filter(x => x !== p) : [...s, p])} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '.86rem' }}>{p}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--sub)' }}>{core ? 'Core page' : 'Add-on'}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--sub)' }}>BUILDS</span>
                <Flow pages={orderedSelected()} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={mapFunnel} disabled={loading || !orderedSelected().length}>
                  {loading ? 'Mapping the funnel…' : 'Map this funnel'}
                </button>
                <button className="btn btn-secondary" onClick={() => setSelPages(chosen.corePages || chosen.mvpFlow || [])}>Reset to MVP</button>
                <button className="btn btn-ghost" onClick={() => setStage('options')}>← Back</button>
              </div>
            </div>
          </>
        )}

        {/* ── Build sheet ────────────────────────────────────────── */}
        {stage === 'build' && build && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div>
                <div className="page-title">{build.funnelName}</div>
                <div className="page-sub" style={{ marginTop: 4 }}>{build.flow}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 4, marginRight: 4 }} title="Teach the Architect whether this build resonated">
                  <button className="btn btn-ghost btn-sm" onClick={() => thumb('up')}
                    style={{ padding: '4px 8px', color: feedback === 'up' ? 'var(--accent)' : 'var(--sub)', background: feedback === 'up' ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : undefined }}>👍</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => thumb('down')}
                    style={{ padding: '4px 8px', color: feedback === 'down' ? 'var(--danger)' : 'var(--sub)', background: feedback === 'down' ? 'color-mix(in srgb, var(--danger) 12%, transparent)' : undefined }}>👎</button>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setStage('pages')}>← Pages</button>
                <button className="btn btn-secondary btn-sm" onClick={copySheet}>Copy as text</button>
                <button className="btn btn-secondary btn-sm" onClick={() => downloadPDF(ctx, build)}>Download PDF</button>
                <button className="btn btn-primary btn-sm" onClick={saveToLibrary} disabled={saving}>{saving ? 'Saving…' : 'Save to Library'}</button>
              </div>
            </div>

            {build.watchOut && (
              <div className="card" style={{ padding: '12px 16px', marginBottom: 16, borderLeft: '3px solid var(--danger)' }}>
                <span style={{ fontSize: '.66rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--danger)' }}>WATCH OUT</span>
                <div style={{ fontSize: '.86rem', marginTop: 2 }}>{build.watchOut}</div>
              </div>
            )}

            {/* Customer journey */}
            <div className="section-title" style={{ marginTop: 4 }}>Customer journey</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {(build.journey || []).map((j, i) => (
                <div key={i} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>{j.page}</div>
                  </div>
                  <JRow label="Mindset" value={j.mindset} />
                  <JRow label="Page job" value={j.pageJob} />
                  {(j.mustHave || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                      <div style={{ width: 92, flexShrink: 0, fontSize: '.64rem', fontWeight: 700, letterSpacing: '.05em', color: 'var(--sub)', paddingTop: 2 }}>MUST HAVE</div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: '.85rem', lineHeight: 1.5 }}>{j.mustHave.map((m, k) => <li key={k}>{m}</li>)}</ul>
                    </div>
                  )}
                  <JRow label="Button" value={j.button} strong />
                  <JRow label="Drop-off" value={j.dropOff} danger />
                </div>
              ))}
            </div>

            {/* Page copy — paged, one page at a time */}
            {(build.pageCopy || []).length > 0 && (() => {
              const total = build.pageCopy.length
              const idx = Math.min(copyIdx, total - 1)
              const p = build.pageCopy[idx]
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', margin: '4px 0 10px' }}>
                    <div className="section-title" style={{ margin: 0 }}>Page copy <span style={{ fontSize: '.66rem', color: 'var(--sub)', fontWeight: 600 }}>· {idx + 1} of {total}</span></div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className="btn btn-ghost btn-sm" disabled={idx === 0} onClick={() => setCopyIdx(idx - 1)}>‹ Prev</button>
                      <button className="btn btn-ghost btn-sm" disabled={idx >= total - 1} onClick={() => setCopyIdx(idx + 1)}>Next ›</button>
                      <button className="btn btn-secondary btn-sm" onClick={rewriteCopy} disabled={rewriting}>
                        {rewriting ? 'Rewriting…' : '↻ Rewrite copy'}
                      </button>
                    </div>
                  </div>

                  <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14, opacity: rewriting ? 0.55 : 1, transition: 'opacity .15s' }}>
                    {/* page preview header */}
                    <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--card)), var(--card))', borderBottom: '1px solid var(--border)' }}>
                      <Chip color="#0EA5E9">{p.badge || p.page}</Chip>
                      <div style={{ fontWeight: 800, fontSize: '1.35rem', margin: '12px 0 8px', lineHeight: 1.25, letterSpacing: '-.01em' }}>{p.headline}</div>
                      {p.subhead && <div style={{ color: 'var(--sub)', fontSize: '.95rem', lineHeight: 1.5, maxWidth: 640 }}>{p.subhead}</div>}
                    </div>
                    <div style={{ padding: '18px 24px' }}>
                      {(p.bullets || []).length > 0 && (
                        <ul style={{ margin: '0 0 16px', paddingLeft: 4, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {p.bullets.map((b, k) => (
                            <li key={k} style={{ display: 'flex', gap: 10, fontSize: '.9rem', lineHeight: 1.5 }}>
                              <span style={{ color: 'var(--accent)', fontWeight: 800, flexShrink: 0 }}>✓</span><span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {(p.formFields || []).length > 0 && (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                          {p.formFields.map((f, k) => (
                            <span key={k} style={{ fontSize: '.8rem', padding: '9px 14px', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--sub)', background: 'var(--surface)', minWidth: 140 }}>{f}</span>
                          ))}
                        </div>
                      )}
                      {p.button && <div><span className="btn btn-primary" style={{ pointerEvents: 'none', fontSize: '.95rem', padding: '11px 22px' }}>{p.button}</span></div>}
                      {p.testimonial && (
                        <div style={{ marginTop: 16, paddingLeft: 14, borderLeft: '3px solid var(--accent)', fontStyle: 'italic', color: 'var(--sub)', fontSize: '.86rem', lineHeight: 1.5 }}>{p.testimonial}</div>
                      )}
                    </div>
                  </div>

                  {/* page dots */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
                    {build.pageCopy.map((_, k) => (
                      <button key={k} onClick={() => setCopyIdx(k)} aria-label={`Page ${k + 1}`}
                        style={{ width: k === idx ? 22 : 8, height: 8, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 0, background: k === idx ? 'var(--accent)' : 'var(--border)', transition: 'width .15s, background .15s' }} />
                    ))}
                  </div>
                </>
              )
            })()}

            {/* GHL automation map */}
            <div className="section-title">GHL automation map <span style={{ fontSize: '.66rem', color: 'var(--sub)', fontWeight: 600 }}>· {(build.workflows || []).length} workflows</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
              {(build.workflows || []).map((w, i) => (
                <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ background: 'var(--text)', color: 'var(--card)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '.9rem' }}>{w.name}</span>
                    <span style={{ fontSize: '.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,.14)' }}>Trigger: {w.trigger}</span>
                  </div>
                  <div>
                    {(w.steps || []).map((s, k) => (
                      <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '9px 14px', borderTop: '1px solid var(--border)' }}>
                        <span style={{ width: 82, flexShrink: 0, textAlign: 'center', fontSize: '.62rem', fontWeight: 800, letterSpacing: '.04em', padding: '3px 0', borderRadius: 6, background: `${stepColor(s.type)}22`, color: stepColor(s.type) }}>{String(s.type).toUpperCase()}</span>
                        <span style={{ fontSize: '.85rem', lineHeight: 1.45 }}>{s.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Setup: tags / fields / stages */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12, marginBottom: 24 }}>
              <SetupCol title="TAGS TO CREATE" items={build.tagsToCreate} color="#8B5CF6" />
              <SetupCol title="CUSTOM FIELDS" items={build.customFields} color="#0EA5E9" />
              <SetupCol title="PIPELINE STAGES" items={build.pipelineStages} color="#6366F1" arrow />
            </div>

            <div className="card" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="fw-700">Take the whole build with you</div>
                <div style={{ fontSize: '.8rem', color: 'var(--sub)' }}>One sheet with the funnel build and the automation build, ready to send or work from.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={copySheet}>Copy as text</button>
                <button className="btn btn-primary" onClick={() => downloadPDF(ctx, build)}>Download the PDF</button>
              </div>
            </div>
          </>
        )}

        {/* Loading overlay for stage transitions that fetch */}
        {loading && (stage === 'options' || stage === 'pages') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--sub)', padding: '18px 0' }}>
            <div className="spinner" /> Working…
          </div>
        )}
      </div>
    </>
  )
}

function Stepper({ stage }) {
  const steps = ['Offer', 'Options', 'Pages', 'Build']
  const idx = ({ intake: 0, options: 1, pages: 2, build: 3 })[stage] ?? 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 22, flexWrap: 'wrap' }}>
      {steps.map((s, i) => (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 6px', borderRadius: 99,
            background: i <= idx ? 'var(--accent)' : 'var(--surface)', color: i <= idx ? '#fff' : 'var(--sub)',
            border: i <= idx ? '1px solid transparent' : '1px solid var(--border)', fontSize: '.76rem', fontWeight: 700, transition: 'all .15s',
          }}>
            <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i <= idx ? 'rgba(255,255,255,.22)' : 'var(--border)', fontSize: '.68rem' }}>{i < idx ? '✓' : i + 1}</span>
            {s}
          </span>
          {i < steps.length - 1 && <span style={{ width: 18, height: 2, borderRadius: 2, background: i < idx ? 'var(--accent)' : 'var(--border)' }} />}
        </span>
      ))}
    </div>
  )
}

function JRow({ label, value, strong, danger }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ width: 92, flexShrink: 0, fontSize: '.64rem', fontWeight: 700, letterSpacing: '.05em', color: 'var(--sub)', paddingTop: 2 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: '.85rem', lineHeight: 1.5, fontWeight: strong ? 700 : 400, color: danger ? 'var(--danger)' : 'var(--text)' }}>{value}</div>
    </div>
  )
}

function SetupCol({ title, items, color, arrow }) {
  if (!items || !items.length) return null
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--sub)', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {items.map((t, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '.72rem', fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: `${color}18`, color, border: `1px solid ${color}33` }}>{t}</span>
            {arrow && i < items.length - 1 && <span style={{ color: 'var(--sub)' }}>→</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
