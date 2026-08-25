import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAIConfig } from '../hooks/useAIConfig.js'
import { api, getLocationId } from '../lib/api.js'
import { notifySuccess, notifyError } from '../lib/toast.jsx'

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
  const locationId = getLocationId()
  const { config, loading: configLoading } = useAIConfig()

  const [stage, setStage]     = useState('intake') // intake | options | pages | build
  const [offer, setOffer]     = useState('')
  const [price, setPrice]     = useState(PRICE_POINTS[1])
  const [traffic, setTraffic] = useState(TRAFFIC[0])
  const [goal, setGoal]       = useState(GOALS[0])

  const [options, setOptions] = useState([])
  const [chosen, setChosen]   = useState(null)
  const [selPages, setSelPages] = useState([])
  const [build, setBuild]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)

  const ctx = { offer, price, traffic, goal }
  const aiArgs = () => ({ offer, pricePoint: price, traffic, goal, provider: config.provider, apiKey: config.apiKey, model: config.model })

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
      setStage('build')
    } catch (e) { notifyError(e.message || 'Failed') } finally { setLoading(false) }
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
        {stage !== 'intake' && (
          <div className="topnav-right">
            <button className="btn btn-ghost btn-sm" onClick={() => { setStage('intake'); setBuild(null); setChosen(null) }}>Start over</button>
          </div>
        )}
      </div>

      <div className="content" style={{ maxWidth: 980 }}>

        {/* ── Intake ─────────────────────────────────────────────── */}
        {stage === 'intake' && (
          <>
            <div className="page-header">
              <div>
                <div className="page-title">Funnel Architect</div>
                <div className="page-sub">Tell me the offer — I’ll draw the whole build. One offer in, one build sheet out.</div>
              </div>
            </div>
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
                  <div key={o.id || i} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, border: best ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

            {/* Page copy */}
            {(build.pageCopy || []).length > 0 && (
              <>
                <div className="section-title">Page copy</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  {build.pageCopy.map((p, i) => (
                    <div key={i} className="card" style={{ padding: 18 }}>
                      <Chip color="#0EA5E9">{p.badge || p.page}</Chip>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', margin: '10px 0 6px', lineHeight: 1.3 }}>{p.headline}</div>
                      {p.subhead && <div style={{ color: 'var(--sub)', fontSize: '.9rem', marginBottom: 10 }}>{p.subhead}</div>}
                      {(p.bullets || []).length > 0 && (
                        <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: '.88rem', lineHeight: 1.55 }}>{p.bullets.map((b, k) => <li key={k}>{b}</li>)}</ul>
                      )}
                      {(p.formFields || []).length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                          {p.formFields.map((f, k) => <span key={k} style={{ fontSize: '.72rem', padding: '4px 10px', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--sub)' }}>{f}</span>)}
                        </div>
                      )}
                      {p.button && <div><span className="btn btn-primary btn-sm" style={{ pointerEvents: 'none' }}>{p.button}</span></div>}
                      {p.testimonial && <div style={{ fontStyle: 'italic', color: 'var(--sub)', fontSize: '.82rem', marginTop: 10 }}>{p.testimonial}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}

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
