import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getLocationId } from '../lib/api.js'
import { STAGES, stageOf, getNotes, TaskModal, TaskDetail } from '../components/TaskModals.jsx'

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ tasks }) {
  const total = tasks.length
  if (total === 0) return null
  const counts = Object.fromEntries(STAGES.map(s => [s.id, 0]))
  tasks.forEach(t => { if (counts[t.stage] !== undefined) counts[t.stage]++ })
  const donePct = Math.round((counts['done'] / total) * 100)

  return (
    <div className="kanban-progress">
      <div className="kanban-progress-header">
        <span className="kanban-progress-label">Overall Progress</span>
        <span className="kanban-progress-pct">{donePct}% complete</span>
      </div>
      <div className="kanban-progress-bar">
        {STAGES.map(stage => {
          const pct = (counts[stage.id] / total) * 100
          if (pct === 0) return null
          return (
            <div key={stage.id} className="kanban-progress-segment"
              style={{ width: `${pct}%`, background: stage.color }}
              title={`${stage.label}: ${counts[stage.id]}`}
            />
          )
        })}
      </div>
      <div className="kanban-progress-stages">
        {STAGES.map(stage => (
          <div key={stage.id} className="kanban-progress-stage">
            <span className="kanban-progress-stage-dot" style={{ background: stage.color }} />
            <span className="kanban-progress-stage-name">{stage.label}</span>
            <span className="kanban-progress-stage-count">{counts[stage.id]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onDragStart, onOpenDetail, onEdit, onDelete }) {
  const navigate   = useNavigate()
  const locationId = getLocationId()
  const stage      = stageOf(task.stage)
  const notes      = getNotes(task)
  const lastNote   = notes[notes.length - 1]

  function goToLibrary(e) {
    e.stopPropagation()
    if (!task.customerId) return
    navigate(`/library/${task.customerId}${locationId ? `?locationId=${locationId}` : ''}`)
  }

  return (
    <div
      className="task-card"
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(task.id) }}
      onClick={() => onOpenDetail(task)}
    >
      <div className="task-card-header">
        <span className="task-stage-dot" style={{ background: stage.color }} />
        <div className="task-card-actions" onClick={e => e.stopPropagation()}>
          <button className="task-icon-btn" onClick={() => onEdit(task)} title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button className="task-icon-btn danger" onClick={() => onDelete(task.id)} title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="task-card-title">{task.title}</div>

      {lastNote && (
        <div className="task-card-notes">{lastNote.text}</div>
      )}

      <div className="task-card-footer">
        {task.customerName && (
          <button className="task-customer-chip" onClick={goToLibrary}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            {task.customerName}
          </button>
        )}
        {task.clickupTaskId && (
          <span className="task-cu-badge" title={task.clickupTaskName || task.clickupTaskId}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            CU
          </span>
        )}
        {notes.length > 0 && (
          <span className="task-note-count">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {notes.length}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────
function Column({ stage, tasks, onDragStart, onDragOver, onDrop, isDragOver, onAdd, onOpenDetail, onEdit, onDelete }) {
  return (
    <div
      className={`kanban-col ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); onDragOver(stage.id) }}
      onDrop={e => { e.preventDefault(); onDrop(stage.id) }}
    >
      <div className="kanban-col-header">
        <div className="kanban-col-title">
          <span className="kanban-col-badge" style={{ background: stage.bg, color: stage.color }}>{stage.label}</span>
          <span className="kanban-col-count">{tasks.length}</span>
        </div>
        <button className="kanban-add-btn" onClick={() => onAdd(stage.id)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="14" height="14">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
      <div className="kanban-col-body">
        {tasks.map(t => (
          <TaskCard key={t.id} task={t}
            onDragStart={onDragStart}
            onOpenDetail={onOpenDetail}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {tasks.length === 0 && <div className="kanban-empty">Drop cards here</div>}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Tasks() {
  const [tasks,     setTasks]     = useState([])
  const [customers, setCustomers] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null)   // { mode: 'new'|'edit', stage?, task? }
  const [detail,    setDetail]    = useState(null)   // task being viewed in detail panel
  const [dragId,    setDragId]    = useState(null)
  const [dragOver,  setDragOver]  = useState(null)

  useEffect(() => {
    Promise.all([api.getTasks(), api.getCustomers()]).then(([t, c]) => {
      setTasks(Array.isArray(t) ? t : [])
      setCustomers(Array.isArray(c) ? c : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function handleDragStart(id) { setDragId(id) }
  function handleDragOver(sid) { setDragOver(sid) }

  async function handleDrop(targetStage) {
    setDragOver(null)
    if (!dragId) return
    const task = tasks.find(t => t.id === dragId)
    if (!task || task.stage === targetStage) { setDragId(null); return }
    setTasks(prev => prev.map(t => t.id === dragId ? { ...t, stage: targetStage } : t))
    setDragId(null)
    await api.updateTask(dragId, { stage: targetStage }).catch(() => {
      setTasks(prev => prev.map(t => t.id === dragId ? { ...t, stage: task.stage } : t))
    })
  }

  async function handleSave(fields) {
    if (modal.mode === 'new') {
      const created = await api.createTask({ ...fields, stage: modal.stage })
      setTasks(prev => [...prev, created])
    } else {
      const updated = await api.updateTask(modal.task.id, fields)
      setTasks(prev => prev.map(t => t.id === modal.task.id ? updated : t))
    }
    setModal(null)
  }

  async function handleDelete(id) {
    setTasks(prev => prev.filter(t => t.id !== id))
    if (detail?.id === id) setDetail(null)
    await api.deleteTask(id).catch(() => {})
  }

  function handleTaskUpdate(updated) {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    // Keep detail panel in sync
    if (detail?.id === updated.id) setDetail(updated)
  }

  const byStage = id => tasks.filter(t => t.stage === id)

  return (
    <>
      <div className="topnav">
        <div className="topnav-left">
          <span className="breadcrumb-current">Tasks</span>
        </div>
        <div className="topnav-right">
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ mode: 'new', stage: 'urgent' })}>
            + New Task
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
      ) : (
        <>
          <ProgressBar tasks={tasks} />
          <div className="kanban-board">
            {STAGES.map(stage => (
              <Column
                key={stage.id}
                stage={stage}
                tasks={byStage(stage.id)}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragOver={dragOver === stage.id}
                onAdd={stage => setModal({ mode: 'new', stage })}
                onOpenDetail={task => setDetail(task)}
                onEdit={task => setModal({ mode: 'edit', task })}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}

      {modal && (
        <TaskModal
          initial={modal.mode === 'edit' ? modal.task : { stage: modal.stage }}
          customers={customers}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {detail && (
        <TaskDetail
          task={detail}
          customers={customers}
          onClose={() => setDetail(null)}
          onTaskUpdate={handleTaskUpdate}
        />
      )}
    </>
  )
}
