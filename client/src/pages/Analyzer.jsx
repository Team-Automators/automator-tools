import { useState, useRef } from 'react'
import { useAIConfig } from '../hooks/useAIConfig.js'
import { api } from '../lib/api.js'
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
  const { config, loading: configLoading } = useAIConfig()
  const [transcript, setTranscript] = useState('')
  const [clientName, setClientName] = useState('')
  const [result, setResult]   = useState('')
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileRef = useRef(null)

  function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setTranscript(String(reader.result || ''))
    reader.readAsText(file)
  }

  async function analyze() {
    if (!transcript.trim()) { notifyError('Paste or upload a transcript first'); return }
    if (!config?.apiKey) { notifyError('Connect an AI provider in Settings first'); return }
    setLoading(true)
    setResult('')
    try {
      await api.analyzeTranscriptStream(
        { transcript, clientName, provider: config.provider, apiKey: config.apiKey, model: config.model },
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
            <label className="form-label">Transcript</label>
            <textarea
              className="form-input"
              style={{ minHeight: 180, resize: 'vertical', fontFamily: 'inherit' }}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Paste the Zoom/call transcript here…"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept=".txt,.vtt,.srt,.md,text/plain" onChange={onFile} style={{ display: 'none' }} />
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>Upload transcript file</button>
            {fileName && <span style={{ fontSize: '.8rem', color: 'var(--sub)' }}>{fileName}</span>}
            <button
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
              onClick={analyze}
              disabled={loading || configLoading || !transcript.trim()}
            >
              {loading ? 'Analyzing…' : 'Analyze Transcript'}
            </button>
          </div>
        </div>

        {/* Result */}
        {(loading || result) && (
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="fw-700" style={{ fontSize: '.95rem' }}>Project Brief</div>
              {result && !loading && <button className="btn btn-ghost btn-sm" onClick={copyResult}>Copy</button>}
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
