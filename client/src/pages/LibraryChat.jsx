import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, getLocationId } from '../lib/api.js'
import { TYPES } from '../lib/types.js'
import { PROVIDERS } from '../lib/providers.js'
import { useAIConfig } from '../hooks/useAIConfig.js'
import { confirmToast, notifySuccess } from '../lib/toast.jsx'

const STATUS_OPTS = [
  { value: 'draft',       label: 'Draft',       color: '#64748B', bg: 'rgba(100,116,139,.14)' },
  { value: 'in-progress', label: 'In Progress', color: '#2563EB', bg: 'rgba(37,99,235,.14)' },
  { value: 'completed',   label: 'Completed',   color: '#16A34A', bg: 'rgba(22,163,74,.14)' },
]
const STATUS_META = Object.fromEntries(STATUS_OPTS.map(s => [s.value, s]))

function mockupEstimate(mode, type, copyLength) {
  if (mode !== 'ai') return null
  let base = type === 'webinar' ? 45 : 30
  if (copyLength === 'short') base = Math.round(base * 0.65)
  return { low: Math.max(8, Math.round(base * 0.6)), high: Math.round(base * 1.6) }
}
function mockupTargetChars(type, copyLength) {
  if (copyLength === 'short') return 8000
  return 14000
}

// The landing-page reply in a webinar conversation (not the intake/emails/pitch/offer).
function webinarLandingContent(messages) {
  const assistants = (messages || []).filter(m => m.role === 'assistant' && m.content)
  const re = /reserve|what\s*you'?ll\s*learn|free to attend|save (my|your) (seat|spot)|register (now|free)|100% free/i
  const landing = [...assistants].reverse().find(m => re.test(m.content)) // latest landing-page reply
  return landing?.content || assistants[assistants.length >= 2 ? 1 : 0]?.content || ''
}

function useAutoResize(ref) {
  return function resize() {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = Math.min(ref.current.scrollHeight, 160) + 'px'
  }
}

function cleanDisplayText(text) {
  const JUNK_LINE = [
    /\[ON[\s-]?SCREEN/i,
    /\bon[\s-]?screen\s*text\b/i,
    /^\(?visual\s*:/i,
    /^\(?(?:pause|beat|hold|cut to|fade in|fade out)\)?\.?$/i,
    /^segment\s*\d*\s*[:\-—]/i,
    /^target\s*(?:length|duration|runtime)\s*:/i,
    /^format\s*:\s*(?:talking|video|slideshow|b[\s-]roll)/i,
    /\btalking[\s-]head\b/i,
    /\bb[\s-]roll\b/i,
    /\bword[\s-]for[\s-]word script\b/i,
    /^vsl\s*script\b/i,
  ]

  return text
    .split('\n')
    .map(line =>
      line
        .replace(/\*{0,3}\s*\[ON[\s-]?SCREEN[^\]\n]*\]\s*\*{0,3}/gi, '')
        .replace(/\*{0,3}\s*\(?Visual:[^*\n]*?\)?\s*\*{0,3}/gi, '')
        .replace(/\*{0,3}\s*\((?:Pause|Beat|Hold)\)\s*\*{0,3}/gi, '')
    )
    .filter(line => {
      const raw = line.trim()
      if (raw === '---' || /^-{3,}$/.test(raw)) return false
      if (!raw) return true  // preserve blank lines for paragraph spacing
      const plain = raw
        .replace(/^#+\s+/, '')
        .replace(/^\*{1,3}|\*{1,3}$/g, '')
        .replace(/^\[|\]$/g, '')
        .trim()
      return !JUNK_LINE.some(re => re.test(plain))
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function ThumbUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
    </svg>
  )
}

function ThumbDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
      <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
    </svg>
  )
}

function MsgBubble({ msg, isLast, onFeedback, feedback, onMockup, onGeneratePrompt, showPreview }) {
  const [copied, setCopied] = useState(false)
  const isAI = msg.role === 'assistant'
  const hasContent = msg.content.length > 60

  const displayContent = isAI ? cleanDisplayText(msg.content) : msg.content

  function copy() {
    navigator.clipboard.writeText(displayContent).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={`msg-row ${msg.role === 'user' ? 'user' : ''}`}>
      <div className={`msg-avatar ${isAI ? 'ai' : 'user-av'}`}>
        {isAI ? '✦' : 'Y'}
      </div>
      <div>
        <div className={`msg-bubble ${isAI ? 'ai' : 'user'}`}>
          {displayContent}
        </div>
        {isAI && hasContent && (
          <div className="msg-actions">
            {isLast && (
              <>
                <button className="action-btn" onClick={copy}>
                  {copied ? 'Copied!' : 'Copy to clipboard'}
                </button>
                {showPreview && (
                  <>
                    <button className="action-btn mockup-btn" onClick={onMockup}>
                      Preview Mockup
                    </button>
                    <button className="action-btn ghl-prompt-btn" onClick={() => onGeneratePrompt(msg.content)}>
                      Generate Prompt
                    </button>
                  </>
                )}
              </>
            )}
            <button
              className={`action-btn thumb-btn ${feedback === 'up' ? 'thumb-up-active' : ''}`}
              onClick={() => onFeedback('up')}
              title="Good copy — trains brand voice"
            >
              <ThumbUpIcon />
            </button>
            <button
              className={`action-btn thumb-btn ${feedback === 'down' ? 'thumb-down-active' : ''}`}
              onClick={() => onFeedback('down')}
              title="Not right — avoid this style"
            >
              <ThumbDownIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LibraryChat() {
  const { customerId, copyId } = useParams()
  const navigate = useNavigate()
  const locationId = getLocationId()
  const { config, loading: configLoading } = useAIConfig()
  const isUnsorted = customerId === '_unsorted'

  const [copy, setCopy] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [showDots, setShowDots] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [feedbackMap, setFeedbackMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`lib_fb_${copyId}`) || '{}') } catch { return {} }
  })

  // Mockup state
  const [mockup, setMockup] = useState(null)
  const [mockupMode, setMockupMode] = useState('ai')
  const [mockupChars, setMockupChars] = useState(0)
  const [mockupElapsed, setMockupElapsed] = useState(0)
  const [copyLength, setCopyLength] = useState('long')
  const [autoCycle, setAutoCycle] = useState(false)
  const [cycleCountdown, setCycleCountdown] = useState(0)
  const cycleTimerRef = useRef(null)
  const countdownRef = useRef(null)

  // GHL Prompt modal state
  const [ghlPrompt, setGhlPrompt] = useState(null)
  const [ghlPromptCopied, setGhlPromptCopied] = useState(false)

  // Brand voice state
  const [voiceInfo, setVoiceInfo] = useState(null)
  const [showVoiceDetail, setShowVoiceDetail] = useState(false)

  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const readerRef = useRef(null)
  const stoppedRef = useRef(false)

  function stopStreaming() {
    stoppedRef.current = true
    try { readerRef.current?.cancel() } catch {}
  }
  const resize = useAutoResize(textareaRef)

  useEffect(() => {
    setLoading(true)
    setLoadError(false)
    api.getCopy(copyId).then(c => {
      if (!c) { setLoadError(true); setLoading(false); return }
      setCopy(c)
      setMessages(c.messages || [])
      setLoading(false)
    }).catch(() => {
      setLoadError(true)
      setLoading(false)
    })
  }, [copyId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText, showDots])

  // Auto-cycle: when a design finishes loading and autoCycle is on, countdown then regenerate
  useEffect(() => {
    if (autoCycle && mockup && !mockup.loading && mockup.html && !mockup.error) {
      const DELAY = 20
      setCycleCountdown(DELAY)
      countdownRef.current = setInterval(() => {
        setCycleCountdown(c => {
          if (c <= 1) { clearInterval(countdownRef.current); return 0 }
          return c - 1
        })
      }, 1000)
      cycleTimerRef.current = setTimeout(() => {
        const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant')
        if (lastAiMsg) handleMockup(cleanDisplayText(lastAiMsg.content), 'ai')
      }, DELAY * 1000)
    }
    return () => {
      clearTimeout(cycleTimerRef.current)
      clearInterval(countdownRef.current)
    }
  }, [autoCycle, mockup?.html, mockup?.loading])

  useEffect(() => {
    if (!mockup?.loading) return
    setMockupElapsed(0)
    const started = Date.now()
    const iv = setInterval(() => setMockupElapsed(Math.floor((Date.now() - started) / 1000)), 500)
    return () => clearInterval(iv)
  }, [mockup?.loading])

  useEffect(() => {
    if (!mockup) {
      setAutoCycle(false)
      clearTimeout(cycleTimerRef.current)
      clearInterval(countdownRef.current)
    }
  }, [mockup])

  // Persist feedback across refreshes/navigation
  useEffect(() => {
    try { localStorage.setItem(`lib_fb_${copyId}`, JSON.stringify(feedbackMap)) } catch {}
  }, [feedbackMap, copyId])

  // Load brand voice status
  useEffect(() => {
    if (!locationId) return
    api.getBrandVoice().then(data => {
      if (data?.voice?.profile) setVoiceInfo(data.voice)
      else setVoiceInfo(false)
    }).catch(() => setVoiceInfo(false))
  }, [locationId])

  function goBack() {
    const u = new URL(`/library/${customerId}`, window.location.origin)
    if (locationId) u.searchParams.set('locationId', locationId)
    navigate(u.pathname + u.search)
  }

  async function autoSave(msgs) {
    if (!copy) return
    setSaveStatus('saving')
    await api.updateCopy(copyId, { messages: msgs })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus(''), 2000)
  }

  async function handleMockup(content, mode) {
    if ((copy?.type || '') === 'webinar') {
      const landing = webinarLandingContent(messages)
      if (landing) content = landing
    }
    setMockupMode(mode)
    setMockupChars(0)
    setMockup({ loading: true, mode, html: null, error: null })
    try {
      if (mode === 'ai') {
        const result = await api.generateMockupStream(
          { copy: content, type: copy?.type || 'general', mode, copyLength, provider: config?.provider, apiKey: config?.apiKey, model: config?.model },
          { onChunk: (chunk) => setMockupChars(n => n + chunk.length) }
        )
        if (result?.html) {
          setMockup({ html: result.html, mode, loading: false, error: null })
        } else {
          setMockup({ html: null, mode, loading: false, error: 'No HTML returned' })
        }
      } else {
        const result = await api.generateMockup({
          copy: content, type: copy?.type || 'general', mode, copyLength,
          provider: config?.provider, apiKey: config?.apiKey, model: config?.model,
        })
        if (result.html) {
          setMockup({ html: result.html, mode, loading: false, error: null })
        } else {
          setMockup({ html: null, mode, loading: false, error: result.error || 'No HTML returned' })
        }
      }
    } catch (e) {
      setMockup({ html: null, mode, loading: false, error: e.message || 'Request failed' })
    }
  }

  async function handleGeneratePrompt(content, html) {
    setGhlPromptCopied(false)
    setGhlPrompt({ loading: true, text: null, error: null })
    try {
      const result = await api.generateGhlPrompt({
        copy: cleanDisplayText(content),
        html: html || null,
        provider: config?.provider,
        apiKey:   config?.apiKey,
        model:    config?.model,
      })
      if (result.prompt) {
        setGhlPrompt({ loading: false, text: result.prompt, error: null })
      } else {
        setGhlPrompt({ loading: false, text: null, error: result.error || 'Failed to generate prompt' })
      }
    } catch (e) {
      setGhlPrompt({ loading: false, text: null, error: e.message || 'Request failed' })
    }
  }

  function handleFeedback(msgIndex, sentiment) {
    const prev = feedbackMap[msgIndex]
    if (prev === sentiment) return
    setFeedbackMap(m => ({ ...m, [msgIndex]: sentiment }))
    const text = messages[msgIndex]?.content || ''
    const type = copy?.type || 'general'
    api.addCopyFeedback({ type, text, sentiment }).catch(() => {})
  }

  async function send() {
    const text = input.trim()
    if (!text || streaming || !copy) return
    if (!configLoading && !config) {
      const u = new URL('/settings', window.location.origin)
      if (locationId) u.searchParams.set('locationId', locationId)
      navigate(u.pathname + u.search)
      return
    }

    const userMsg = { role: 'user', content: text }
    const allMsgs = [...messages, userMsg]
    setMessages(allMsgs)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setStreaming(true)
    setShowDots(true)
    setStreamText('')
    stoppedRef.current = false

    let accumulated = ''
    let committed = false
    const commit = async (content) => {
      if (committed || !content) return
      committed = true
      const finalMsgs = [...allMsgs, { role: 'assistant', content }]
      setMessages(finalMsgs)
      await autoSave(finalMsgs)
    }

    function sanitize(msgs) {
      const cleaned = msgs
        .filter(m => m.content && !m.content.startsWith('Sorry, something went wrong') && !m.content.startsWith('Error:'))
        .reduce((acc, m) => {
          if (acc.length && acc[acc.length - 1].role === m.role) {
            acc[acc.length - 1] = { ...acc[acc.length - 1], content: acc[acc.length - 1].content + '\n' + m.content }
          } else {
            acc.push(m)
          }
          return acc
        }, [])
      while (cleaned.length && cleaned[0].role === 'assistant') cleaned.shift()
      return cleaned
    }

    try {
      const resp = await fetch('/copywrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: copy.type,
          locationId,
          messages: sanitize(allMsgs).map(m => ({ role: m.role, content: m.content })),
          provider: config?.provider,
          apiKey:   config?.apiKey,
          model:    config?.model,
        }),
      })

      if (!resp.ok) {
        let errMsg = 'Request failed'
        try { const j = await resp.json(); errMsg = j.error || errMsg } catch {}
        throw new Error(errMsg)
      }

      const reader = resp.body.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()
      let errorText = ''
      let firstToken = true

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          if (raw === '[DONE]') break
          try {
            const parsed = JSON.parse(raw)
            if (parsed.error) {
              errorText = parsed.error
            } else if (parsed.text) {
              if (firstToken) { setShowDots(false); firstToken = false }
              accumulated += parsed.text
              setStreamText(accumulated)
            }
          } catch {}
        }
      }

      if (errorText && !accumulated) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorText}` }])
        return
      }

      await commit(accumulated)
    } catch (e) {
      if (stoppedRef.current) {
        await commit(accumulated)              // keep partial output on stop
        if (!accumulated) setMessages(prev => prev.slice(0, -1))
      } else {
        setSaveStatus(e?.message || 'Something went wrong. Check your AI settings.')
        setTimeout(() => setSaveStatus(''), 6000)
        setMessages(prev => prev.slice(0, -1))
      }
    } finally {
      readerRef.current = null
      setStreamText('')
      setShowDots(false)
      setStreaming(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const typeInfo = copy ? (TYPES[copy.type] || TYPES.general) : TYPES.general

  if (loading) return (
    <>
      <div className="topnav">
        <div className="topnav-left">
          <button className="btn btn-ghost btn-sm" onClick={goBack} style={{ padding: '6px 8px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <span className="breadcrumb-current">Loading…</span>
        </div>
      </div>
      <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><div className="spinner"/></div>
    </>
  )

  if (loadError) return (
    <>
      <div className="topnav">
        <div className="topnav-left">
          <button className="btn btn-ghost btn-sm" onClick={goBack} style={{ padding: '6px 8px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <span className="breadcrumb-current">Error</span>
        </div>
      </div>
      <div className="empty-state" style={{ padding: 32 }}>
        <div className="empty-title">Could not load this copy</div>
        <div className="empty-sub">It may have been deleted, or there was a network error.</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={() => {
            setLoading(true)
            setLoadError(false)
            api.getCopy(copyId).then(c => {
              if (!c) { setLoadError(true); setLoading(false); return }
              setCopy(c)
              setMessages(c.messages || [])
              setLoading(false)
            }).catch(() => { setLoadError(true); setLoading(false) })
          }}>
            Retry
          </button>
          <button className="btn btn-secondary" onClick={goBack}>Go back</button>
        </div>
      </div>
    </>
  )

  return (
    <>
      <div className="topnav">
        <div className="topnav-left">
          <button className="btn btn-ghost btn-sm" onClick={goBack} style={{ padding: '6px 8px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <span className="breadcrumb">{isUnsorted ? 'Unsorted' : (copy?.customerName || customerId)}</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current truncate" style={{ maxWidth: '30vw' }}>
            {copy?.title || 'Untitled'}
          </span>
        </div>
        <div className="topnav-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

          {/* Status picker */}
          <select
            className="form-input form-select"
            value={STATUS_META[copy?.status] ? copy.status : 'in-progress'}
            onChange={e => {
              const status = e.target.value
              setCopy(c => c ? { ...c, status } : c)
              api.setCopyStatus(copyId, status).catch(() => {})
            }}
            title="Status"
            style={{
              width: 'auto', minHeight: 'auto', padding: '4px 24px 4px 10px',
              fontSize: '.72rem', fontWeight: 700,
              color: (STATUS_META[copy?.status] || STATUS_META['in-progress']).color,
              background: (STATUS_META[copy?.status] || STATUS_META['in-progress']).bg,
              border: 'none', borderRadius: 99,
            }}
          >
            {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {/* Short / Long copy toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '.72rem', fontWeight: copyLength === 'short' ? 700 : 400, color: copyLength === 'short' ? 'var(--accent)' : 'var(--sub)', transition: 'color .15s' }}>Short</span>
            <button
              onClick={() => setCopyLength(l => l === 'short' ? 'long' : 'short')}
              title={copyLength === 'long' ? 'Switch to short copy' : 'Switch to long copy'}
              style={{
                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', padding: 0,
                background: copyLength === 'long' ? 'var(--accent)' : 'var(--border)',
                position: 'relative', transition: 'background .2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 2,
                left: copyLength === 'long' ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left .2s', display: 'block',
                boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }} />
            </button>
            <span style={{ fontSize: '.72rem', fontWeight: copyLength === 'long' ? 700 : 400, color: copyLength === 'long' ? 'var(--accent)' : 'var(--sub)', transition: 'color .15s' }}>Long</span>
          </div>

          {saveStatus && (
            <span className={`save-status ${saveStatus}`}>
              {saveStatus === 'saving' ? 'Saving…' : '✓ Saved'}
            </span>
          )}
          {voiceInfo && (
            <button
              className="voice-chip"
              onClick={() => setShowVoiceDetail(v => !v)}
              title="Brand voice is trained — click to view"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
              </svg>
              Voice trained
            </button>
          )}
          <span
            className="badge"
            style={{ background: typeInfo.colorBg, color: typeInfo.color }}
          >
            {copy?.type}
          </span>
        </div>
      </div>

      {/* Brand voice detail panel */}
      {showVoiceDetail && voiceInfo && (
        <div className="voice-panel">
          <div className="voice-panel-header">
            <span className="voice-panel-title">Brand Voice Profile</span>
            <span className="voice-panel-meta">{voiceInfo.sampleCount} copies analyzed</span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 'auto', fontSize: '.75rem' }}
              onClick={async () => {
                if (!(await confirmToast('Clear the trained brand voice?', { confirmText: 'Clear' }))) return
                api.clearBrandVoice().then(() => { setVoiceInfo(false); setShowVoiceDetail(false); notifySuccess('Brand voice cleared') }).catch(() => {})
              }}
            >
              Clear
            </button>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: '.75rem' }} onClick={() => setShowVoiceDetail(false)}>
              Close
            </button>
          </div>
          <p className="voice-panel-body">{voiceInfo.profile}</p>
        </div>
      )}

      <div className="chat-shell">
        <div className="chat-messages">
          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1
            return (
              <MsgBubble
                key={i}
                msg={msg}
                isLast={isLast}
                onFeedback={sentiment => handleFeedback(i, sentiment)}
                feedback={feedbackMap[i] || null}
                onMockup={() => handleMockup(cleanDisplayText(msg.content), 'ai')}
                onGeneratePrompt={() => handleGeneratePrompt(msg.content)}
                showPreview={!!(TYPES[copy?.type]?.preview)}
              />
            )
          })}

          {showDots && (
            <div className="msg-row">
              <div className="msg-avatar ai">✦</div>
              <div className="msg-bubble ai">
                <div className="typing-dots"><span/><span/><span/></div>
              </div>
            </div>
          )}

          {streamText && !showDots && (
            <div className="msg-row">
              <div className="msg-avatar ai">✦</div>
              <div className="msg-bubble ai">{cleanDisplayText(streamText)}</div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="chat-input-bar">
          <div className="chat-input-row">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder="Continue the conversation…"
              value={input}
              rows={1}
              onChange={e => { setInput(e.target.value); resize() }}
              onKeyDown={handleKey}
              disabled={streaming}
            />
            {streaming ? (
              <button className="send-btn" onClick={stopStreaming} title="Stop generating" aria-label="Stop">
                <svg viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>
              </button>
            ) : (
              <button className="send-btn" onClick={send} disabled={!input.trim()} aria-label="Send">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            )}
          </div>
          <div className="chat-provider-bar">
            {config ? (
              <>
                <span>{PROVIDERS.find(p => p.id === config.provider)?.name || config.provider} · {config.model}</span>
                <button className="chat-provider-link" onClick={() => {
                  const u = new URL('/settings', window.location.origin)
                  if (locationId) u.searchParams.set('locationId', locationId)
                  navigate(u.pathname + u.search)
                }}>Change</button>
              </>
            ) : (
              <>
                <span>No AI provider configured</span>
                <button className="chat-provider-link" onClick={() => {
                  const u = new URL('/settings', window.location.origin)
                  if (locationId) u.searchParams.set('locationId', locationId)
                  navigate(u.pathname + u.search)
                }}>Connect →</button>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Mockup modal */}
      {mockup && (
        <div className="mockup-overlay">
          <div className="mockup-modal">
            <div className="mockup-header">
              <span className="mockup-title">AI Generated Design</span>
              <div className="mockup-tabs">
                {!mockup?.loading && mockup?.html && (
                  <>
                    <button
                      className="mockup-tab active"
                      onClick={() => {
                        setAutoCycle(false)
                        clearTimeout(cycleTimerRef.current)
                        clearInterval(countdownRef.current)
                        const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant')
                        handleMockup(lastAiMsg?.content || '', 'ai')
                      }}
                    >
                      ↺ New Design
                    </button>
                    <button
                      className={`mockup-tab ${autoCycle ? 'auto-cycle-on' : ''}`}
                      onClick={() => setAutoCycle(v => !v)}
                      title="Auto-cycle through different designs every 20 seconds"
                    >
                      {autoCycle
                        ? (cycleCountdown > 0 ? `⏸ Next in ${cycleCountdown}s` : '⏸ Auto')
                        : '▶ Auto'}
                    </button>
                  </>
                )}
              </div>
              <button className="mockup-close" onClick={() => setMockup(null)}>✕</button>
            </div>
            <div className="mockup-body">
              {mockup.loading ? (
                <div className="mockup-loading">
                  <div className="typing-dots"><span/><span/><span/></div>
                  <p>Generating {mockup.mode === 'ai' ? 'AI design' : 'design'}…</p>
                  {(() => {
                    const t = copy?.type || 'general'
                    const est = mockupEstimate(mockup.mode, t, copyLength)
                    if (!est) return null
                    const target = mockupTargetChars(t, copyLength)
                    const pct = Math.min(96, Math.max(mockupChars > 0 ? 5 : 0, Math.round((mockupChars / target) * 100)))
                    return (
                      <div style={{ width: 260, marginTop: 8 }}>
                        <p style={{ fontSize: '.78rem', color: 'var(--sub)', textAlign: 'center', marginBottom: 8 }}>
                          Usually ~{est.low}–{est.high}s · <strong style={{ color: 'var(--text)' }}>{mockupElapsed}s</strong> elapsed
                        </p>
                        <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width .4s ease' }} />
                        </div>
                        {mockupChars > 0 && (
                          <p style={{ fontSize: '.72rem', color: 'var(--sub)', textAlign: 'center', marginTop: 6 }}>
                            {mockupChars.toLocaleString()} characters
                          </p>
                        )}
                        {mockupElapsed > est.high && (
                          <p style={{ fontSize: '.72rem', color: 'var(--sub)', textAlign: 'center', marginTop: 4 }}>
                            Taking longer than usual — almost there…
                          </p>
                        )}
                      </div>
                    )
                  })()}
                </div>
              ) : mockup.error ? (
                <div className="mockup-loading">
                  <p style={{ color: 'var(--danger)', fontWeight: 600 }}>Generation failed</p>
                  <p style={{ color: 'var(--sub)', fontSize: '.875rem', maxWidth: 400, textAlign: 'center' }}>{mockup.error}</p>
                  <button className="btn btn-secondary" onClick={() => { const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant'); handleMockup(lastAiMsg?.content || '', mockupMode) }}>Retry</button>
                </div>
              ) : (
                <>
                  <iframe
                    className="mockup-frame"
                    srcDoc={mockup.html}
                    title="Page Mockup"
                    sandbox="allow-scripts"
                  />
                  <div className="mockup-footer">
                    <button
                      className="btn btn-primary mockup-gen-prompt-btn"
                      onClick={() => {
                        const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant')
                        handleGeneratePrompt(lastAiMsg?.content || '', mockup.html)
                      }}
                    >
                      Generate Prompt from This Design
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GHL Prompt modal */}
      {ghlPrompt && (
        <div className="modal-backdrop" onClick={() => setGhlPrompt(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>AI Builder Funnel Prompt</span>
              <button className="mockup-close" style={{ position: 'static' }} onClick={() => setGhlPrompt(null)}>✕</button>
            </div>

            {ghlPrompt.loading ? (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <div className="typing-dots"><span/><span/><span/></div>
                <p style={{ color: 'var(--sub)', marginTop: 12, fontSize: '.9rem' }}>Analyzing funnel copy…</p>
              </div>
            ) : ghlPrompt.error ? (
              <p style={{ color: 'var(--danger)', padding: '16px 0' }}>{ghlPrompt.error}</p>
            ) : (
              <>
                <p style={{ color: 'var(--sub)', fontSize: '.85rem', marginBottom: 12 }}>
                  Copy this prompt and paste it into any AI website or funnel builder — <strong>Framer AI, Durable, Wix AI, Webflow AI</strong>, or similar — to recreate this exact funnel from scratch.
                </p>
                <textarea
                  readOnly
                  value={ghlPrompt.text}
                  style={{
                    width: '100%', minHeight: 320, padding: '12px 14px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, color: 'var(--text)', fontSize: '.85rem',
                    lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.select()}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      navigator.clipboard.writeText(ghlPrompt.text).then(() => {
                        setGhlPromptCopied(true)
                        setTimeout(() => setGhlPromptCopied(false), 2500)
                      })
                    }}
                  >
                    {ghlPromptCopied ? '✓ Copied!' : 'Copy Prompt'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setGhlPrompt(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
