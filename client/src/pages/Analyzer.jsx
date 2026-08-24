import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAIConfig } from '../hooks/useAIConfig.js'
import { api, getLocationId } from '../lib/api.js'
import { notifySuccess, notifyError } from '../lib/toast.jsx'

// Minimal Markdown renderer for the brief (headings, bullets, bold).
function renderMarkdown(text) {
  const lines = (text || '').split('\n')
  const out = []
  let list = []
  const flush = (key) => {
    if (list.length) {
      out.push(<ul key={`ul-${key}`} style={{ margin: '4px 0 12px', paddingLeft: 20 }}>{list}</ul>)
      list = []
    }
  }
  const inline = (s) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((p, i) => /^\*\*[^*]+\*\*$/.test(p)
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>)
  }
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '')
    if (/^##\s+/.test(line)) {
      flush(i)
      out.push(<h3 key={i} style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: '20px 0 8px' }}>{line.replace(/^##\s+/, '')}</h3>)
    } else if (/^#\s+/.test(line)) {
      flush(i)
      out.push(<h2 key={i} style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)', margin: '22px 0 8px' }}>{line.replace(/^#\s+/, '')}</h2>)
    } else if (/^[-*]\s+/.test(line)) {
      list.push(<li key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>{inline(line.replace(/^[-*]\s+/, ''))}</li>)
    } else if (line.trim() === '') {
      flush(i)
    } else {
      flush(i)
      out.push(<p key={i} style={{ margin: '0 0 10px', lineHeight: 1.6 }}>{inline(line)}</p>)
    }
  })
  flush('end')
  return out
}

export default function Analyzer() {
  const navigate = useNavigate()
  const locationId = getLocationId()
  const { config, loading: configLoading } = useAIConfig()
  const [transcript, setTranscript] = useState('')
  const [clientName, setClientName] = useState('')
  const [videoLink, setVideoLink]   = useState('')
  const [result, setResult]   = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [fileName, setFileName] = useState('')
  const [extracting, setExtracting] = useState(false)
  const fileRef = useRef(null)

  const TEXT_EXTS = ['txt', 'vtt', 'srt', 'md', 'csv', 'rtf', 'json', 'html', 'htm', 'log']

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    // Plain-text formats parse instantly in the browser; PDFs/Word docs go to
    // the server extractor.
    if (TEXT_EXTS.includes(ext)) {
      const reader = new FileReader()
      reader.onload = () => setTranscript(prev => appendText(prev, String(reader.result || '')))
      reader.readAsText(file)
      return
    }
    setExtracting(true)
    try {
      const { text, chars } = await api.extractFile(file)
      setTranscript(prev => appendText(prev, text))
      notifySuccess(`Extracted ${chars.toLocaleString()} characters from ${file.name}`)
    } catch (err) {
      notifyError(err.message || 'Could not read that file')
      setFileName('')
    } finally {
      setExtracting(false)
      e.target.value = ''
    }
  }

  function appendText(prev, next) {
    const a = (prev || '').trim()
    return a ? `${a}\n\n${next}` : next
  }

  async function analyze() {
    if (!transcript.trim()) { notifyError('Add a transcript, notes, summary, or a file first'); return }
    if (!config?.apiKey) { notifyError('Connect an AI provider in Settings first'); return }
    setLoading(true)
    setResult('')
    try {
      await api.analyzeTranscriptStream(
        { transcript, clientName, videoLink, provider: config.provider, apiKey: config.apiKey, model: config.model },
        { onChunk: (_c, full) => setResult(full) }
      )
    } catch (e) {
      notifyError(e.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  function copyResult() {
    navigator.clipboard?.writeText(result).then(() => notifySuccess('Brief copied')).catch(() => {})
  }

  // Save the brief to the Library — grouped under the client (created if needed).
  async function saveToLibrary() {
    if (!result.trim()) return
    setSaving(true)
    try {
      let customerId = '_unsorted', customerName = ''
      const name = clientName.trim()
      if (name) {
        const custs = await api.getCustomers().catch(() => [])
        const existing = (Array.isArray(custs) ? custs : []).find(c => (c.name || '').toLowerCase() === name.toLowerCase())
        const cust = existing || await api.createCustomer(name)
        if (cust?.id) { customerId = cust.id; customerName = cust.name }
      }
      const title = `Project Brief — ${name || new Date().toLocaleDateString()}`
      const copy = await api.saveCopy({
        customerId, customerName,
        type: 'general',
        title,
        preview: result.replace(/[#*]/g, '').slice(0, 120),
        messages: [
          { role: 'user', content: `Analyze this into a project brief.${videoLink ? `\n\nRecording: ${videoLink}` : ''}` },
          { role: 'assistant', content: result },
        ],
      })
      notifySuccess('Brief saved to Library')
      if (copy?.id) {
        const u = new URL(`/library/${customerId}/${copy.id}`, window.location.origin)
        if (locationId) u.searchParams.set('locationId', locationId)
        navigate(u.pathname + u.search)
      }
    } catch (e) {
      notifyError(e.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="topnav">
        <div className="topnav-left"><span className="breadcrumb-current">Analyzer</span></div>
      </div>

      <div className="content" style={{ maxWidth: 900 }}>
        <div className="page-header">
          <div>
            <div className="page-title">Transcript Analyzer</div>
            <div className="page-sub">Turn a call/Zoom transcript into a build-ready project brief</div>
          </div>
        </div>

        {/* Input */}
        <div className="card" style={{ padding: 18, marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Client name (optional)</label>
            <input className="form-input" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Trevor Brooks" />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Recording / video link (optional)</label>
            <input className="form-input" value={videoLink} onChange={e => setVideoLink(e.target.value)}
              placeholder="Zoom / Loom / Drive / YouTube link — for the build team's reference" />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Transcript, notes, or summary</label>
            <textarea
              className="form-input"
              style={{ minHeight: 180, resize: 'vertical', fontFamily: 'inherit' }}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Paste the Zoom/call transcript, your meeting notes, or a summary — or upload a file below…"
            />
            <div style={{ fontSize: '.72rem', color: 'var(--sub)', marginTop: 4 }}>
              Tip: a link alone can't be analyzed — paste notes/transcript or upload a file. The link is saved as reference.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file"
              accept=".pdf,.docx,.txt,.vtt,.srt,.md,.csv,.rtf,.json,.html,.htm,.log,application/pdf"
              onChange={onFile} style={{ display: 'none' }} />
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={extracting}>
              {extracting ? 'Reading file…' : 'Upload file (PDF, Word, text)'}
            </button>
            {fileName && !extracting && <span style={{ fontSize: '.8rem', color: 'var(--sub)' }}>{fileName}</span>}
            <button
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
              onClick={analyze}
              disabled={loading || extracting || configLoading || !transcript.trim()}
            >
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>
        </div>

        {/* Result */}
        {(loading || result) && (
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="fw-700" style={{ fontSize: '.95rem' }}>Project Brief</div>
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
                <div className="spinner" /> Reading the transcript and building the brief…
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
