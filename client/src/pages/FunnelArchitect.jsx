import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAIConfig } from '../hooks/useAIConfig.js'
import { api, getLocationId } from '../lib/api.js'
import { notifySuccess, notifyError } from '../lib/toast.jsx'

// Minimal Markdown renderer (headings, bullets, numbered, bold).
function renderMarkdown(text) {
  const lines = (text || '').split('\n')
  const out = []
  let list = []
  const flush = (key) => { if (list.length) { out.push(<ul key={`ul-${key}`} style={{ margin: '4px 0 12px', paddingLeft: 20 }}>{list}</ul>); list = [] } }
  const inline = (s) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => /^\*\*[^*]+\*\*$/.test(p)
    ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '')
    if (/^##\s+/.test(line)) { flush(i); out.push(<h3 key={i} style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: '22px 0 8px', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>{line.replace(/^##\s+/, '')}</h3>) }
    else if (/^#\s+/.test(line)) { flush(i); out.push(<h2 key={i} style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)', margin: '22px 0 8px' }}>{line.replace(/^#\s+/, '')}</h2>) }
    else if (/^\s*[-*]\s+/.test(line)) { list.push(<li key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>{inline(line.replace(/^\s*[-*]\s+/, ''))}</li>) }
    else if (/^\s*\d+\.\s+/.test(line)) { list.push(<li key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>{inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>) }
    else if (line.trim() === '') { flush(i) }
    else { flush(i); out.push(<p key={i} style={{ margin: '0 0 10px', lineHeight: 1.6 }}>{inline(line)}</p>) }
  })
  flush('end')
  return out
}

const PRICE_POINTS = ['Free / Lead magnet', '$100 to $1k', '$1k to $5k', '$5k to $25k', '$25k+']
const TRAFFIC      = ['Paid ads', 'Organic / Social', 'Email list', 'SEO', 'Referrals', 'Cold outreach']
const GOALS        = ['Book calls', 'Sell a product', 'Collect leads', 'Webinar registrations', 'Applications']

export default function FunnelArchitect() {
  const navigate = useNavigate()
  const locationId = getLocationId()
  const { config, loading: configLoading } = useAIConfig()

  const [offer, setOffer]       = useState('')
  const [price, setPrice]       = useState(PRICE_POINTS[1])
  const [traffic, setTraffic]   = useState(TRAFFIC[0])
  const [goal, setGoal]         = useState(GOALS[0])
  const [result, setResult]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)

  async function build() {
    if (!offer.trim()) { notifyError('Tell me the offer first'); return }
    if (!config?.apiKey) { notifyError('Connect an AI provider in Settings first'); return }
    setLoading(true); setResult('')
    try {
      await api.architectFunnelStream(
        { offer, pricePoint: price, traffic, goal, provider: config.provider, apiKey: config.apiKey, model: config.model },
        { onChunk: (_c, full) => setResult(full) }
      )
    } catch (e) {
      notifyError(e.message || 'Build failed')
    } finally {
      setLoading(false)
    }
  }

  function copyResult() {
    navigator.clipboard?.writeText(result).then(() => notifySuccess('Build sheet copied')).catch(() => {})
  }

  async function saveToLibrary() {
    if (!result.trim()) return
    setSaving(true)
    try {
      const title = `Funnel Build Sheet — ${offer.trim().slice(0, 48) || new Date().toLocaleDateString()}`
      const copy = await api.saveCopy({
        customerId: '_unsorted', customerName: '',
        type: 'general', title,
        preview: result.replace(/[#*]/g, '').slice(0, 120),
        messages: [
          { role: 'user', content: `Offer: ${offer}\nPrice: ${price} · Traffic: ${traffic} · Goal: ${goal}` },
          { role: 'assistant', content: result },
        ],
      })
      notifySuccess('Build sheet saved to Library')
      if (copy?.id) {
        const u = new URL(`/library/_unsorted/${copy.id}`, window.location.origin)
        if (locationId) u.searchParams.set('locationId', locationId)
        navigate(u.pathname + u.search)
      }
    } catch (e) {
      notifyError(e.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const selectStyle = { }

  return (
    <>
      <div className="topnav">
        <div className="topnav-left"><span className="breadcrumb-current">Funnel Architect</span></div>
      </div>

      <div className="content" style={{ maxWidth: 920 }}>
        <div className="page-header">
          <div>
            <div className="page-title">Funnel Architect</div>
            <div className="page-sub">Tell me the offer — I’ll draw the whole build. One offer in, one build sheet out.</div>
          </div>
        </div>

        {/* Intake */}
        <div className="card" style={{ padding: 20, marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">The offer</label>
            <textarea
              className="form-input"
              style={{ minHeight: 120, resize: 'vertical', fontFamily: 'inherit', background: 'var(--surface)' }}
              value={offer}
              onChange={e => setOffer(e.target.value)}
              placeholder='Example: 12-week 1-on-1 coaching for female founders who want to hit their first $10k month. Includes weekly calls, a template vault, and Slack access.'
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Price point</label>
              <select className="form-input form-select" value={price} onChange={e => setPrice(e.target.value)} style={selectStyle}>
                {PRICE_POINTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Main traffic</label>
              <select className="form-input form-select" value={traffic} onChange={e => setTraffic(e.target.value)} style={selectStyle}>
                {TRAFFIC.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Primary goal</label>
              <select className="form-input form-select" value={goal} onChange={e => setGoal(e.target.value)} style={selectStyle}>
                {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={build} disabled={loading || configLoading || !offer.trim()}>
              {loading ? 'Drawing the build…' : 'Draw my funnel'}
            </button>
            <span style={{ fontSize: '.75rem', color: 'var(--sub)' }}>Funnel type · page flow · customer journey · GHL workflows</span>
          </div>
        </div>

        {/* Build sheet */}
        {(loading || result) && (
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
              <div className="fw-700" style={{ fontSize: '.95rem' }}>Build Sheet</div>
              {result && !loading && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={copyResult}>Copy</button>
                  <button className="btn btn-primary btn-sm" onClick={saveToLibrary} disabled={saving}>
                    {saving ? 'Saving…' : 'Save to Library'}
                  </button>
                </div>
              )}
            </div>
            {loading && !result ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--sub)', padding: '12px 0' }}>
                <div className="spinner" /> Architecting the funnel and workflows…
              </div>
            ) : (
              <div style={{ fontSize: '.9rem', color: 'var(--text)' }}>{renderMarkdown(result)}</div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
