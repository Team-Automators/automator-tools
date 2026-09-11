import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { a as api, g as getLocationId } from "../entry-server.mjs";
const SERVICES = [
  { key: "setup-calls", label: "Setup Calls", color: "#6366F1" },
  { key: "funnels", label: "Funnels", color: "#EC4899" },
  { key: "automations", label: "Automations & Workflows", color: "#F59E0B" },
  { key: "testing-call", label: "Testing Call", color: "#10B981" },
  { key: "voice-ai", label: "Voice AI", color: "#06B6D4" }
];
const SVC = Object.fromEntries(SERVICES.map((s) => [s.key, s]));
const STAGES = [
  { id: "urgent", label: "Urgent", color: "#EF4444", bg: "rgba(239,68,68,.12)" },
  { id: "in-progress", label: "In Progress", color: "#3B82F6", bg: "rgba(59,130,246,.12)" },
  { id: "blocked", label: "Blocked", color: "#F97316", bg: "rgba(249,115,22,.12)" },
  { id: "for-later", label: "For Later", color: "#8B5CF6", bg: "rgba(139,92,246,.12)" },
  { id: "done", label: "Done", color: "#22C55E", bg: "rgba(34,197,94,.12)" }
];
const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.id, s]));
function stageOf(id) {
  return STAGE_MAP[id] || STAGES[0];
}
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(void 0, { month: "short", day: "numeric", year: "numeric" }) + " · " + d.toLocaleTimeString(void 0, { hour: "2-digit", minute: "2-digit" });
}
function getNotes(task) {
  return Array.isArray(task.notes) ? task.notes : [];
}
function TaskDetail({ task: initialTask, onClose, onTaskUpdate }) {
  const [task, setTask] = useState(initialTask);
  const [noteText, setNoteText] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const notesEndRef = useRef(null);
  const notes = getNotes(task);
  const stage = stageOf(task.stage);
  useEffect(() => {
    var _a;
    (_a = notesEndRef.current) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth" });
  }, [notes.length]);
  async function handleAddNote(e) {
    e.preventDefault();
    const text = noteText.trim();
    if (!text) return;
    setAdding(true);
    const updated = await api.addNote(task.id, text).catch(() => null);
    setAdding(false);
    if (updated && updated.id) {
      setTask(updated);
      onTaskUpdate(updated);
      setNoteText("");
    }
  }
  async function handleDeleteNote(noteId) {
    setDeleting(noteId);
    const updated = await api.deleteNote(task.id, noteId).catch(() => null);
    setDeleting(null);
    if (updated && updated.id) {
      setTask(updated);
      onTaskUpdate(updated);
    }
  }
  function handleKey(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNote(e);
  }
  return /* @__PURE__ */ jsx("div", { className: "modal-backdrop", onClick: onClose, children: /* @__PURE__ */ jsxs("div", { className: "task-detail-panel", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxs("div", { className: "task-detail-header", children: [
      /* @__PURE__ */ jsxs("div", { className: "task-detail-title-row", children: [
        /* @__PURE__ */ jsx("span", { className: "task-stage-dot", style: { background: stage.color, width: 9, height: 9 } }),
        /* @__PURE__ */ jsx("div", { className: "task-detail-title", children: task.title })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "task-detail-meta", children: [
        /* @__PURE__ */ jsx("span", { className: "kanban-col-badge", style: { background: stage.bg, color: stage.color, fontSize: ".7rem" }, children: stage.label }),
        task.customerName && /* @__PURE__ */ jsxs("span", { className: "task-customer-chip", style: { cursor: "default" }, children: [
          /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "11", height: "11", children: [
            /* @__PURE__ */ jsx("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
            /* @__PURE__ */ jsx("circle", { cx: "12", cy: "7", r: "4" })
          ] }),
          task.customerName
        ] }),
        task.service && SVC[task.service] && /* @__PURE__ */ jsx("span", { className: "kanban-col-badge", style: { background: `${SVC[task.service].color}22`, color: SVC[task.service].color, fontSize: ".7rem" }, children: SVC[task.service].label }),
        task.clickupTaskId && /* @__PURE__ */ jsxs(
          "a",
          {
            href: `https://app.clickup.com/t/${task.clickupTaskId}`,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "task-cu-detail-link",
            children: [
              /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "11", height: "11", children: [
                /* @__PURE__ */ jsx("path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }),
                /* @__PURE__ */ jsx("path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" })
              ] }),
              task.clickupTaskName || "Open in ClickUp",
              " ↗"
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsx("button", { className: "task-detail-close", onClick: onClose, "aria-label": "Close", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", width: "18", height: "18", children: [
        /* @__PURE__ */ jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
        /* @__PURE__ */ jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "task-detail-notes", children: [
      notes.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "task-notes-empty", children: [
        /* @__PURE__ */ jsx(
          "svg",
          {
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "1.5",
            width: "32",
            height: "32",
            style: { color: "var(--border)", marginBottom: 8 },
            children: /* @__PURE__ */ jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" })
          }
        ),
        /* @__PURE__ */ jsx("div", { style: { fontSize: ".8125rem", color: "var(--sub)" }, children: "No notes yet — add the first one below" })
      ] }) : notes.map((note) => /* @__PURE__ */ jsx("div", { className: "task-note-item", children: /* @__PURE__ */ jsxs("div", { className: "task-note-bubble", children: [
        /* @__PURE__ */ jsx("div", { className: "task-note-text", children: note.text }),
        /* @__PURE__ */ jsxs("div", { className: "task-note-footer", children: [
          /* @__PURE__ */ jsx("span", { className: "task-note-date", children: formatDate(note.createdAt) }),
          note.clickupPushed === true && /* @__PURE__ */ jsxs("span", { className: "note-cu-pill note-cu-ok", children: [
            /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", width: "10", height: "10", children: /* @__PURE__ */ jsx("polyline", { points: "20 6 9 17 4 12" }) }),
            "ClickUp"
          ] }),
          note.clickupPushed === false && /* @__PURE__ */ jsxs("span", { className: "note-cu-pill note-cu-fail", title: "Failed to push to ClickUp", children: [
            /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", width: "10", height: "10", children: [
              /* @__PURE__ */ jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
              /* @__PURE__ */ jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
            ] }),
            "ClickUp"
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              className: "task-note-delete",
              onClick: () => handleDeleteNote(note.id),
              disabled: deleting === note.id,
              title: "Delete note",
              children: deleting === note.id ? "…" : /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "12", height: "12", children: [
                /* @__PURE__ */ jsx("polyline", { points: "3 6 5 6 21 6" }),
                /* @__PURE__ */ jsx("path", { d: "M19 6l-1 14H6L5 6" }),
                /* @__PURE__ */ jsx("path", { d: "M10 11v6M14 11v6M9 6V4h6v2" })
              ] })
            }
          )
        ] })
      ] }) }, note.id)),
      /* @__PURE__ */ jsx("div", { ref: notesEndRef })
    ] }),
    /* @__PURE__ */ jsxs("form", { className: "task-detail-add", onSubmit: handleAddNote, children: [
      /* @__PURE__ */ jsx(
        "textarea",
        {
          className: "task-note-input",
          placeholder: "Add a note… (Ctrl+Enter to submit)",
          value: noteText,
          onChange: (e) => setNoteText(e.target.value),
          onKeyDown: handleKey,
          rows: 3,
          disabled: adding
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          className: "btn btn-primary",
          type: "submit",
          disabled: !noteText.trim() || adding,
          style: { alignSelf: "flex-end" },
          children: adding ? "Adding…" : "Add Note"
        }
      )
    ] })
  ] }) });
}
function TaskModal({ initial, customers, onSave, onClose }) {
  const [title, setTitle] = useState((initial == null ? void 0 : initial.title) || "");
  const [stage, setStage] = useState((initial == null ? void 0 : initial.stage) || "urgent");
  const [customerId, setCustomerId] = useState((initial == null ? void 0 : initial.customerId) || "");
  const [customerName, setCustomerName] = useState((initial == null ? void 0 : initial.customerName) || "");
  const [service, setService] = useState((initial == null ? void 0 : initial.service) || "");
  const [dueDate, setDueDate] = useState((initial == null ? void 0 : initial.dueDate) || "");
  const [saving, setSaving] = useState(false);
  const [cuTaskId, setCuTaskId] = useState((initial == null ? void 0 : initial.clickupTaskId) || "");
  const [cuTaskName, setCuTaskName] = useState((initial == null ? void 0 : initial.clickupTaskName) || "");
  const [cuSpaces, setCuSpaces] = useState([]);
  const [cuSpaceId, setCuSpaceId] = useState("");
  const [cuLists, setCuLists] = useState([]);
  const [cuListId, setCuListId] = useState("");
  const [cuTasks, setCuTasks] = useState([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [cuError, setCuError] = useState("");
  const [cuDebug, setCuDebug] = useState(null);
  const isEdit = !!(initial == null ? void 0 : initial.id);
  useEffect(() => {
    setLoadingSpaces(true);
    api.getClickupWorkspaces().then((ws) => {
      if (Array.isArray(ws) && ws.length) return api.getClickupSpaces(ws[0].id);
    }).then((spaces) => {
      if (spaces) setCuSpaces(spaces);
    }).catch(() => setCuError("Could not load ClickUp spaces")).finally(() => setLoadingSpaces(false));
  }, []);
  async function handleSpaceChange(e) {
    const spaceId = e.target.value;
    setCuSpaceId(spaceId);
    setCuLists([]);
    setCuListId("");
    setCuTasks([]);
    setCuTaskId("");
    setCuTaskName("");
    setCuError("");
    if (!spaceId) return;
    setLoadingLists(true);
    try {
      const content = await api.getClickupSpaceContent(spaceId);
      const folderless = content.lists || [];
      const folderListArrays = await Promise.all(
        (content.folders || []).map(
          (f) => api.getClickupFolderLists(f.id).then((ls) => ls.map((l) => ({ ...l, folderName: f.name }))).catch(() => [])
        )
      );
      setCuLists([...folderless, ...folderListArrays.flat()]);
    } catch {
      setCuError("Could not load lists");
    } finally {
      setLoadingLists(false);
    }
  }
  async function handleListChange(e) {
    const listId = e.target.value;
    setCuListId(listId);
    setCuTasks([]);
    setCuTaskId("");
    setCuTaskName("");
    setCuError("");
    setCuDebug(null);
    if (!listId) return;
    setLoadingTasks(true);
    try {
      const tasks = await api.getClickupListTasks(listId);
      setCuTasks(Array.isArray(tasks) ? tasks : []);
    } catch (err) {
      setCuError(err.message || "Could not load tasks");
    } finally {
      setLoadingTasks(false);
    }
  }
  async function runDebug() {
    if (!cuListId) return;
    setCuDebug("loading");
    try {
      const url = new URL(`/api/clickup/debug/list/${cuListId}`, window.location.origin);
      url.searchParams.set("locationId", getLocationId());
      const r = await fetch(url.toString());
      setCuDebug(await r.json());
    } catch (e) {
      setCuDebug({ error: e.message });
    }
  }
  function handleTaskChange(e) {
    const id = e.target.value;
    if (!id) {
      setCuTaskId("");
      setCuTaskName("");
      return;
    }
    const t = cuTasks.find((r) => r.id === id);
    if (t) {
      setCuTaskId(t.id);
      setCuTaskName(t.name);
    }
  }
  function unlinkClickup() {
    setCuTaskId("");
    setCuTaskName("");
  }
  async function handleSave(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSave({ title: title.trim(), stage, customerId, customerName, service, dueDate, clickupTaskId: cuTaskId, clickupTaskName: cuTaskName });
    setSaving(false);
  }
  function handleCustomerChange(e) {
    const id = e.target.value;
    setCustomerId(id);
    const found = customers.find((c) => c.id === id);
    setCustomerName(found ? found.name : "");
  }
  return /* @__PURE__ */ jsx("div", { className: "modal-backdrop", onClick: onClose, children: /* @__PURE__ */ jsxs("div", { className: "modal", style: { maxWidth: 460 }, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsx("div", { className: "modal-title", children: isEdit ? "Edit Task" : "New Task" }),
    /* @__PURE__ */ jsxs("form", { onSubmit: handleSave, children: [
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Title" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-input",
            value: title,
            onChange: (e) => setTitle(e.target.value),
            placeholder: "Describe the task…",
            autoFocus: true
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Stage" }),
        /* @__PURE__ */ jsx("select", { className: "form-input form-select", value: stage, onChange: (e) => setStage(e.target.value), children: STAGES.map((s) => /* @__PURE__ */ jsx("option", { value: s.id, children: s.label }, s.id)) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Customer (optional)" }),
        /* @__PURE__ */ jsxs("select", { className: "form-input form-select", value: customerId, onChange: handleCustomerChange, children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "— No customer —" }),
          customers.map((c) => /* @__PURE__ */ jsx("option", { value: c.id, children: c.name }, c.id))
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsxs("label", { className: "form-label", children: [
          "Service ",
          /* @__PURE__ */ jsx("span", { style: { color: "var(--sub)", fontWeight: 400 }, children: "— shows this task on the Pipeline" })
        ] }),
        /* @__PURE__ */ jsxs("select", { className: "form-input form-select", value: service, onChange: (e) => setService(e.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "— No service (Tasks only) —" }),
          SERVICES.map((s) => /* @__PURE__ */ jsx("option", { value: s.key, children: s.label }, s.key))
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Due date (optional)" }),
        /* @__PURE__ */ jsx("input", { type: "date", className: "form-input", value: dueDate, onChange: (e) => setDueDate(e.target.value) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "ClickUp Task (optional)" }),
        cuTaskId ? /* @__PURE__ */ jsxs("div", { className: "cu-linked-row", children: [
          /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "#7B68EE", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "14", height: "14", children: /* @__PURE__ */ jsx("polyline", { points: "20 6 9 17 4 12" }) }),
          /* @__PURE__ */ jsx("span", { className: "cu-linked-name", children: cuTaskName || cuTaskId }),
          /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-ghost btn-sm", onClick: unlinkClickup, children: "Unlink" })
        ] }) : loadingSpaces ? /* @__PURE__ */ jsx("div", { className: "cu-cascade-loading", children: "Loading ClickUp…" }) : /* @__PURE__ */ jsxs("div", { className: "cu-cascade", children: [
          /* @__PURE__ */ jsxs("select", { className: "form-input form-select", value: cuSpaceId, onChange: handleSpaceChange, children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "— Select space —" }),
            cuSpaces.map((s) => /* @__PURE__ */ jsx("option", { value: s.id, children: s.name }, s.id))
          ] }),
          cuSpaceId && (loadingLists ? /* @__PURE__ */ jsx("div", { className: "cu-cascade-loading", children: "Loading lists…" }) : /* @__PURE__ */ jsxs("select", { className: "form-input form-select", value: cuListId, onChange: handleListChange, children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "— Select list —" }),
            cuLists.map((l) => /* @__PURE__ */ jsx("option", { value: l.id, children: l.folderName ? `${l.folderName} / ${l.name}` : l.name }, l.id))
          ] })),
          cuListId && (loadingTasks ? /* @__PURE__ */ jsx("div", { className: "cu-cascade-loading", children: "Loading tasks…" }) : cuTasks.length > 0 ? /* @__PURE__ */ jsxs("select", { className: "form-input form-select", value: cuTaskId, onChange: handleTaskChange, children: [
            /* @__PURE__ */ jsxs("option", { value: "", children: [
              "— Select task (",
              cuTasks.length,
              ") —"
            ] }),
            cuTasks.map((t) => {
              var _a;
              return /* @__PURE__ */ jsxs("option", { value: t.id, children: [
                t.parent ? `  ↳ ${t.name}` : t.name,
                ((_a = t.status) == null ? void 0 : _a.status) ? ` (${t.status.status})` : ""
              ] }, t.id);
            })
          ] }) : !cuError ? /* @__PURE__ */ jsx("div", { style: { fontSize: ".8125rem", color: "var(--sub)", padding: "4px 0" }, children: "No tasks found in this list" }) : null)
        ] }),
        cuError && /* @__PURE__ */ jsx("div", { style: { fontSize: ".75rem", color: "var(--danger)", marginTop: 6, padding: "6px 10px", background: "var(--danger-bg)", borderRadius: 6 }, children: cuError }),
        cuListId && !loadingTasks && /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-ghost btn-sm", style: { fontSize: ".7rem", marginTop: 6 }, onClick: runDebug, children: cuDebug === "loading" ? "Checking…" : "🔍 Debug: inspect list response" }),
        cuDebug && cuDebug !== "loading" && /* @__PURE__ */ jsx("pre", { style: { fontSize: ".65rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: 8, marginTop: 4, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflowY: "auto" }, children: JSON.stringify(cuDebug, null, 2) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "modal-actions", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary flex-1", type: "submit", disabled: !title.trim() || saving, children: saving ? "Saving…" : isEdit ? "Save changes" : "Create task" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", type: "button", onClick: onClose, children: "Cancel" })
      ] })
    ] })
  ] }) });
}
export {
  STAGES as S,
  TaskModal as T,
  TaskDetail as a,
  SVC as b,
  SERVICES as c,
  getNotes as g,
  stageOf as s
};
