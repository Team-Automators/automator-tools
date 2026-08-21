import { useState, useEffect, useRef } from 'react'
import { useAIConfig } from '../hooks/useAIConfig.js'
import { PROVIDERS } from '../lib/providers.js'
import { apiFetch, getLocationId, api } from '../lib/api.js'
import { confirmToast, notifySuccess } from '../lib/toast.jsx'

// ── ClickUp workspace browser ─────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (!status) return null
  const color = status.color || '#94A3B8'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99,
      background: color + '22', color,
      fontSize: '.7rem', fontWeight: 700,
    }}>
      {status.status}
    </span>
  )
}

function TaskRow({ task }) {
  const url = `https://app.clickup.com/t/${task.id}`
  return (
    <div className="cu-task-row">
      <div className="cu-task-main">
        <div className="cu-task-name">{task.name}</div>
        <div className="cu-task-meta">
          {task.list?.name && <span className="cu-task-list">{task.list.name}</span>}
          {task.due_date && (
            <span className="cu-task-due">
              Due {new Date(Number(task.due_date)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.assignees?.length > 0 && (
            <span className="cu-task-assignees">{task.assignees.map(a => a.username || a.email).join(', ')}</span>
          )}
        </div>
      </div>
      <div className="cu-task-right">
        <StatusBadge status={task.status} />
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm cu-open-btn">
          Open ↗
        </a>
      </div>
    </div>
  )
}

const LIST_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)

function ClickUpSection({ locationId }) {
  const [cuKey,         setCuKey]         = useState('')
  const [connected,     setConnected]     = useState(false)
  const [cuSaving,      setCuSaving]      = useState(false)
  const [cuError,       setCuError]       = useState('')

  // Workspace tree
  const [workspaces,    setWorkspaces]    = useState([])
  const [fetchingWs,    setFetchingWs]    = useState(false)
  const [wsExpanded,    setWsExpanded]    = useState({})
  const [spaces,        setSpaces]        = useState({})        // teamId → []
  const [loadingSpaces, setLoadingSpaces] = useState({})
  const [spaceExp,      setSpaceExp]      = useState({})        // spaceId → bool
  const [selectedSpace, setSelectedSpace] = useState(null)      // { id, name }
  const [spaceContent,  setSpaceContent]  = useState({})        // spaceId → { folders, lists }
  const [loadingSC,     setLoadingSC]     = useState({})
  const [folderExp,     setFolderExp]     = useState({})
  const [folderLists,   setFolderLists]   = useState({})
  const [loadingFL,     setLoadingFL]     = useState({})

  // Selected list → task panel
  const [selectedList,     setSelectedList]     = useState(null)  // { id, name }
  const [listTasks,        setListTasks]         = useState([])
  const [loadingListTasks, setLoadingListTasks]  = useState(false)

  // Search
  const [searchQ,       setSearchQ]       = useState('')
  const [searchTeamId,  setSearchTeamId]  = useState('')
  const [results,       setResults]       = useState(null)
  const [searching,     setSearching]     = useState(false)

  useEffect(() => {
    apiFetch('/api/settings').then(r => r.json()).then(d => {
      setConnected(!!d.hasClickupKey)
    }).catch(() => {})
  }, [locationId])

  async function cuFetch(path) {
    const url = new URL(path, window.location.origin)
    url.searchParams.set('locationId', locationId)
    const r = await fetch(url.toString())
    const d = await r.json()
    if (!r.ok) throw new Error(d.error || 'ClickUp API error')
    return d
  }

  async function saveKey(e) {
    e.preventDefault()
    const key = cuKey.trim()
    if (!key) return
    setCuSaving(true); setCuError('')
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, clickupApiKey: key }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setConnected(true); setCuKey('')
      fetchWorkspaces()
    } catch (e) { setCuError(e.message) }
    finally { setCuSaving(false) }
  }

  async function disconnect() {
    if (!(await confirmToast('Remove the saved ClickUp API key?', { confirmText: 'Remove' }))) return
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, removeClickupKey: true }),
    })
    setConnected(false); setWorkspaces([]); setResults(null)
    setSearchQ(''); setSearchTeamId(''); setSelectedSpace(null); setSelectedList(null)
  }

  async function fetchWorkspaces() {
    setFetchingWs(true); setCuError('')
    try {
      const data = await cuFetch('/api/clickup/workspaces')
      setWorkspaces(data)
      if (data.length > 0) {
        setSearchTeamId(data[0].id)
        toggleTeam(data[0].id, true)
      }
    } catch (e) { setCuError(e.message) }
    finally { setFetchingWs(false) }
  }

  async function toggleTeam(teamId, forceOpen) {
    const nowOpen = forceOpen ?? !wsExpanded[teamId]
    setWsExpanded(p => ({ ...p, [teamId]: nowOpen }))
    setSearchTeamId(teamId)
    if (!spaces[teamId]) {
      setLoadingSpaces(p => ({ ...p, [teamId]: true }))
      try {
        const data = await cuFetch(`/api/clickup/spaces/${teamId}`)
        setSpaces(p => ({ ...p, [teamId]: data }))
      } catch (e) { setCuError(e.message) }
      finally { setLoadingSpaces(p => ({ ...p, [teamId]: false })) }
    }
  }

  async function selectSpace(space) {
    // Toggle expand
    const nowOpen = !spaceExp[space.id]
    setSpaceExp(p => ({ ...p, [space.id]: nowOpen }))
    // Always mark as selected when clicking
    setSelectedSpace({ id: space.id, name: space.name })
    setSelectedList(null)
    setListTasks([])
    if (!spaceContent[space.id]) {
      setLoadingSC(p => ({ ...p, [space.id]: true }))
      try {
        const data = await cuFetch(`/api/clickup/space/${space.id}/content`)
        setSpaceContent(p => ({ ...p, [space.id]: data }))
      } catch (e) { setCuError(e.message) }
      finally { setLoadingSC(p => ({ ...p, [space.id]: false })) }
    }
  }

  async function toggleFolder(folderId) {
    setFolderExp(p => ({ ...p, [folderId]: !p[folderId] }))
    if (!folderLists[folderId]) {
      setLoadingFL(p => ({ ...p, [folderId]: true }))
      try {
        const data = await cuFetch(`/api/clickup/folder/${folderId}/lists`)
        setFolderLists(p => ({ ...p, [folderId]: data }))
      } catch (e) { setCuError(e.message) }
      finally { setLoadingFL(p => ({ ...p, [folderId]: false })) }
    }
  }

  async function openList(list) {
    setSelectedList({ id: list.id, name: list.name })
    setListTasks([])
    setLoadingListTasks(true)
    setResults(null)
    try {
      const data = await cuFetch(`/api/clickup/list/${list.id}/tasks`)
      setListTasks(data)
    } catch (e) { setCuError(e.message) }
    finally { setLoadingListTasks(false) }
  }

  async function search() {
    const q = searchQ.trim()
    if (!q || !searchTeamId) return
    setSearching(true); setCuError(''); setSelectedList(null); setListTasks([])
    try {
      const url = new URL('/api/clickup/search', window.location.origin)
      url.searchParams.set('locationId', locationId)
      url.searchParams.set('teamId', searchTeamId)
      url.searchParams.set('q', q)
      const r = await fetch(url.toString())
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setResults(d)
    } catch (e) { setCuError(e.message) }
    finally { setSearching(false) }
  }

  function ListRow({ list, indent = 0 }) {
    const isSelected = selectedList?.id === list.id
    return (
      <button
        className={`cu-tree-row list-btn ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: 50 + indent }}
        onClick={() => openList(list)}
      >
        {LIST_ICON}
        <span className="cu-tree-label">{list.name}</span>
        {list.task_count != null && (
          <span className="cu-tree-count">{list.task_count}</span>
        )}
        <span className="cu-list-view">View tasks →</span>
      </button>
    )
  }

  // Active task panel header
  const taskPanelTitle = selectedList
    ? `Tasks in "${selectedList.name}"`
    : results !== null
      ? `Search results for "${searchQ}"`
      : null

  const taskPanelItems = selectedList ? listTasks : (results || [])
  const taskPanelLoading = selectedList ? loadingListTasks : searching

  return (
    <div className="settings-section">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          ClickUp Integration
        </h2>
        {connected && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="chip chip-green">
              <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
              Connected
            </span>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={disconnect}>
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Connect form */}
      {!connected && (
        <form onSubmit={saveKey} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="form-input" type="password" value={cuKey}
            onChange={e => { setCuKey(e.target.value); setCuError('') }}
            placeholder="pk_••••••••  (ClickUp personal API token)"
            autoComplete="off" style={{ flex: 1, minWidth: 220 }} />
          <button className="btn btn-primary" type="submit" disabled={!cuKey.trim() || cuSaving}>
            {cuSaving ? 'Connecting…' : 'Connect'}
          </button>
        </form>
      )}

      {cuError && (
        <div style={{ fontSize: '.8125rem', color: 'var(--danger)', padding: '6px 10px', background: 'var(--danger-bg)', borderRadius: 6 }}>
          {cuError}
        </div>
      )}

      {connected && (
        <>
          {/* Search bar */}
          <div className="cu-search-row">
            <input className="form-input" type="text" value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder={selectedSpace ? `Search in "${selectedSpace.name}"…` : 'Search all ClickUp tasks by name…'}
              style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={search}
              disabled={!searchQ.trim() || !searchTeamId || searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>

          {!searchTeamId && (
            <div className="text-xs text-sub">Fetch workspace first to enable search.</div>
          )}

          {/* Workspace header + fetch button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="text-xs text-sub" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Workspace
              </span>
              {selectedSpace && (
                <span className="cu-selected-space-pill">
                  {selectedSpace.name}
                </span>
              )}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={fetchWorkspaces} disabled={fetchingWs}>
              {fetchingWs ? 'Loading…' : workspaces.length ? 'Refresh' : 'Fetch Workspace'}
            </button>
          </div>

          {/* Tree */}
          {workspaces.length > 0 && (
            <div className="cu-tree">
              {workspaces.map(team => (
                <div key={team.id}>
                  {/* Team row */}
                  <button className="cu-tree-row team" onClick={() => toggleTeam(team.id)}>
                    <span className="cu-tree-arrow">{wsExpanded[team.id] ? '▾' : '▸'}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    <span className="cu-tree-label">{team.name}</span>
                    {loadingSpaces[team.id] && <span className="cu-loading">…</span>}
                  </button>

                  {/* Spaces */}
                  {wsExpanded[team.id] && (spaces[team.id] || []).map(space => (
                    <div key={space.id}>
                      <button
                        className={`cu-tree-row space ${selectedSpace?.id === space.id ? 'space-selected' : ''}`}
                        onClick={() => selectSpace(space)}
                      >
                        <span className="cu-tree-arrow">{spaceExp[space.id] ? '▾' : '▸'}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                          <circle cx="12" cy="12" r="10"/>
                        </svg>
                        <span className="cu-tree-label">{space.name}</span>
                        {loadingSC[space.id] && <span className="cu-loading">…</span>}
                        {selectedSpace?.id === space.id && (
                          <span className="cu-active-badge">selected</span>
                        )}
                      </button>

                      {/* Space content: folders + folderless lists */}
                      {spaceExp[space.id] && spaceContent[space.id] && (
                        <div className="cu-tree-content">
                          {/* Folders */}
                          {spaceContent[space.id].folders.map(folder => (
                            <div key={folder.id}>
                              <button className="cu-tree-row folder" onClick={() => toggleFolder(folder.id)}>
                                <span className="cu-tree-arrow">{folderExp[folder.id] ? '▾' : '▸'}</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                                </svg>
                                <span className="cu-tree-label">{folder.name}</span>
                                {loadingFL[folder.id] && <span className="cu-loading">…</span>}
                              </button>
                              {folderExp[folder.id] && (folderLists[folder.id] || []).map(list => (
                                <ListRow key={list.id} list={list} indent={12} />
                              ))}
                            </div>
                          ))}
                          {/* Folderless lists */}
                          {spaceContent[space.id].lists.map(list => (
                            <ListRow key={list.id} list={list} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Task panel — list tasks OR search results */}
          {taskPanelTitle && (
            <div className="cu-results">
              <div className="cu-results-header">
                {taskPanelLoading
                  ? 'Loading tasks…'
                  : `${taskPanelTitle} (${taskPanelItems.length})`}
              </div>
              {taskPanelLoading ? (
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
                  <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                </div>
              ) : taskPanelItems.length === 0 ? (
                <div style={{ padding: '14px 12px', fontSize: '.8125rem', color: 'var(--sub)' }}>
                  No tasks found.
                </div>
              ) : (
                taskPanelItems.map(task => <TaskRow key={task.id} task={task} />)
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main Settings page ────────────────────────────────────────────────────────
export default function Settings() {
  const { config, loading, locationName: savedName, saveConfig, clearConfig } = useAIConfig()
  const locationId = getLocationId()

  const [provider, setProvider]         = useState('')
  const [apiKey, setApiKey]             = useState('')
  const [model, setModel]               = useState('')
  const [businessName, setBusinessName] = useState('')
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [error, setError]               = useState('')

  const activeProvider = provider || config?.provider || PROVIDERS[0].id
  const selectedProv   = PROVIDERS.find(p => p.id === activeProvider) || PROVIDERS[0]

  async function handleSave(e) {
    e.preventDefault()
    if (!apiKey.trim()) return
    setSaving(true); setError('')
    try {
      const chosenModel = model || selectedProv.defaultModel
      const result = await api.testAIKey({ provider: activeProvider, apiKey: apiKey.trim(), model: chosenModel })
      if (!result.ok) {
        setError(result.error || 'API key rejected. Check the key and try again.')
        return
      }
      await saveConfig({
        provider: activeProvider,
        apiKey: apiKey.trim(),
        model: chosenModel,
        businessName: businessName.trim(),
      })
      setApiKey('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message || 'Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!(await confirmToast('Disconnect and remove the saved API key?', { confirmText: 'Disconnect' }))) return
    await clearConfig()
    setApiKey(''); setModel(''); setProvider('')
    notifySuccess('API key removed')
  }

  if (loading) {
    return (
      <>
        <div className="topnav">
          <div className="topnav-left"><span className="breadcrumb-current">Settings</span></div>
        </div>
        <div className="content" style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
          <div className="spinner" />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="topnav">
        <div className="topnav-left">
          <span className="breadcrumb">Dashboard</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Settings</span>
        </div>
      </div>

      <div className="content" style={{ maxWidth: 720 }}>
        <div className="page-header">
          <div>
            <div className="page-title">Settings</div>
            <div className="page-sub">Configure your AI provider and integrations</div>
          </div>
        </div>

        {/* AI status */}
        {config && (
          <div className="settings-section" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="fw-700" style={{ fontSize: '.9375rem' }}>
                  {PROVIDERS.find(p => p.id === config.provider)?.name || config.provider}
                </div>
                <div className="text-sub text-sm mt-1">Model: {config.model}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="chip chip-green">
                  <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
                  Connected
                </span>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={handleClear}>
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI config form */}
        <form className="settings-section" onSubmit={handleSave}>
          <h2>{config ? 'Update Settings' : 'Connect AI Provider'}</h2>

          <div className="form-group">
            <label className="form-label">Business Name</label>
            <input className="form-input" type="text" value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder={savedName || 'Your business name'} />
            <div className="text-xs text-sub mt-1">
              Shown in the sidebar. Current: <strong>{savedName || 'not set'}</strong>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Provider</label>
            <select className="form-input form-select" value={activeProvider}
              onChange={e => { setProvider(e.target.value); setModel('') }}>
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: -8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedProv.color, flexShrink: 0 }} />
            <span className="text-xs text-sub">{selectedProv.name}</span>
          </div>

          <div className="form-group">
            <label className="form-label">API Key</label>
            <input className="form-input" type="password" value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={config ? '••••••••  (enter new key to update)' : selectedProv.placeholder}
              autoComplete="off" required />
            <div className="text-xs text-sub mt-1">Stored on this device only.</div>
          </div>

          <div className="form-group">
            <label className="form-label">Model</label>
            <select className="form-input form-select"
              value={model || (config?.provider === activeProvider ? config?.model : '') || selectedProv.defaultModel}
              onChange={e => setModel(e.target.value)}>
              {selectedProv.models.map(m => (
                <option key={m} value={m}>{m}{m === selectedProv.defaultModel ? ' (default)' : ''}</option>
              ))}
            </select>
          </div>

          {error && <div className="text-sm" style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}

          <div>
            <button type="submit" className={`btn ${saved ? 'btn-secondary' : 'btn-primary'}`}
              disabled={!apiKey.trim() || saving}>
              {saved ? '✓ Connected!' : saving ? 'Verifying…' : config ? 'Update Key' : 'Connect Provider'}
            </button>
          </div>
        </form>

        {/* ClickUp integration */}
        <ClickUpSection locationId={locationId} />

        {/* GHL connection */}
        <div className="settings-section">
          <h2>GHL Connection</h2>
          <div className="text-sub text-sm" style={{ lineHeight: 1.6 }}>
            {locationId
              ? <>Location ID: <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, fontSize: '.8125rem' }}>{locationId}</code></>
              : 'No GHL location connected.'}
          </div>
          {!locationId && (
            <a href="/auth" className="btn btn-primary" style={{ marginTop: 4, display: 'inline-flex' }}>
              Install with GHL
            </a>
          )}
        </div>

        {/* Legacy data migration */}
        <div className="settings-section">
          <h2>Claim Existing Data</h2>
          <div className="text-sub text-sm" style={{ lineHeight: 1.6, marginBottom: 10 }}>
            One-time: assign all pre-existing conversations, tasks, and hooks on this
            location that don’t yet have an owner <strong>to you</strong>. After this,
            only you will see them. This can’t be undone.
          </div>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              if (!(await confirmToast('Claim all currently-shared conversations, tasks, and hooks on this location as yours?', { confirmText: 'Claim', danger: false }))) return
              const r = await api.claimLegacyData().catch(() => null)
              if (r?.ok) {
                const { copies = 0, tasks = 0, hooks = 0 } = r.claimed || {}
                notifySuccess(`Claimed ${copies} conversations, ${tasks} tasks, ${hooks} hooks`)
              } else {
                notifySuccess('Nothing to claim (or you must sign in with your email first)')
              }
            }}
          >
            Claim existing data
          </button>
        </div>
      </div>
    </>
  )
}
