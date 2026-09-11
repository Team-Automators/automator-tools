import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { a as api, g as getLocationId } from "../entry-server.mjs";
import { S as STAGES, T as TaskModal, a as TaskDetail, s as stageOf, g as getNotes, b as SVC } from "./TaskModals-CJ215kkH.js";
import "node:async_hooks";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-toastify";
function ProgressBar({ tasks }) {
  const total = tasks.length;
  if (total === 0) return null;
  const counts = Object.fromEntries(STAGES.map((s) => [s.id, 0]));
  tasks.forEach((t) => {
    if (counts[t.stage] !== void 0) counts[t.stage]++;
  });
  const donePct = Math.round(counts["done"] / total * 100);
  return /* @__PURE__ */ jsxs("div", { className: "kanban-progress", children: [
    /* @__PURE__ */ jsxs("div", { className: "kanban-progress-header", children: [
      /* @__PURE__ */ jsx("span", { className: "kanban-progress-label", children: "Overall Progress" }),
      /* @__PURE__ */ jsxs("span", { className: "kanban-progress-pct", children: [
        donePct,
        "% complete"
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "kanban-progress-bar", children: STAGES.map((stage) => {
      const pct = counts[stage.id] / total * 100;
      if (pct === 0) return null;
      return /* @__PURE__ */ jsx(
        "div",
        {
          className: "kanban-progress-segment",
          style: { width: `${pct}%`, background: stage.color },
          title: `${stage.label}: ${counts[stage.id]}`
        },
        stage.id
      );
    }) }),
    /* @__PURE__ */ jsx("div", { className: "kanban-progress-stages", children: STAGES.map((stage) => /* @__PURE__ */ jsxs("div", { className: "kanban-progress-stage", children: [
      /* @__PURE__ */ jsx("span", { className: "kanban-progress-stage-dot", style: { background: stage.color } }),
      /* @__PURE__ */ jsx("span", { className: "kanban-progress-stage-name", children: stage.label }),
      /* @__PURE__ */ jsx("span", { className: "kanban-progress-stage-count", children: counts[stage.id] })
    ] }, stage.id)) })
  ] });
}
function TaskCard({ task, onDragStart, onOpenDetail, onEdit, onDelete }) {
  const navigate = useNavigate();
  const locationId = getLocationId();
  const stage = stageOf(task.stage);
  const notes = getNotes(task);
  const lastNote = notes[notes.length - 1];
  function goToLibrary(e) {
    e.stopPropagation();
    if (!task.customerId) return;
    navigate(`/library/${task.customerId}${locationId ? `?locationId=${locationId}` : ""}`);
  }
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "task-card",
      draggable: true,
      onDragStart: (e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(task.id);
      },
      onClick: () => onOpenDetail(task),
      children: [
        /* @__PURE__ */ jsxs("div", { className: "task-card-header", children: [
          /* @__PURE__ */ jsx("span", { className: "task-stage-dot", style: { background: stage.color } }),
          /* @__PURE__ */ jsxs("div", { className: "task-card-actions", onClick: (e) => e.stopPropagation(), children: [
            /* @__PURE__ */ jsx("button", { className: "task-icon-btn", onClick: () => onEdit(task), title: "Edit", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "13", height: "13", children: [
              /* @__PURE__ */ jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
              /* @__PURE__ */ jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })
            ] }) }),
            /* @__PURE__ */ jsx("button", { className: "task-icon-btn danger", onClick: () => onDelete(task.id), title: "Delete", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "13", height: "13", children: [
              /* @__PURE__ */ jsx("polyline", { points: "3 6 5 6 21 6" }),
              /* @__PURE__ */ jsx("path", { d: "M19 6l-1 14H6L5 6" }),
              /* @__PURE__ */ jsx("path", { d: "M10 11v6M14 11v6M9 6V4h6v2" })
            ] }) })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "task-card-title", children: task.title }),
        lastNote && /* @__PURE__ */ jsx("div", { className: "task-card-notes", children: lastNote.text }),
        /* @__PURE__ */ jsxs("div", { className: "task-card-footer", children: [
          task.service && SVC[task.service] && /* @__PURE__ */ jsxs("span", { className: "task-customer-chip", style: { cursor: "default", background: `${SVC[task.service].color}18`, color: SVC[task.service].color, borderColor: `${SVC[task.service].color}44` }, children: [
            /* @__PURE__ */ jsx("span", { style: { width: 7, height: 7, borderRadius: "50%", background: SVC[task.service].color, display: "inline-block" } }),
            SVC[task.service].label
          ] }),
          task.customerName && /* @__PURE__ */ jsxs("button", { className: "task-customer-chip", onClick: goToLibrary, children: [
            /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "11", height: "11", children: [
              /* @__PURE__ */ jsx("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
              /* @__PURE__ */ jsx("circle", { cx: "12", cy: "7", r: "4" })
            ] }),
            task.customerName
          ] }),
          task.clickupTaskId && /* @__PURE__ */ jsxs("span", { className: "task-cu-badge", title: task.clickupTaskName || task.clickupTaskId, children: [
            /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "10", height: "10", children: [
              /* @__PURE__ */ jsx("path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }),
              /* @__PURE__ */ jsx("path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" })
            ] }),
            "CU"
          ] }),
          notes.length > 0 && /* @__PURE__ */ jsxs("span", { className: "task-note-count", children: [
            /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "11", height: "11", children: /* @__PURE__ */ jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }) }),
            notes.length
          ] })
        ] })
      ]
    }
  );
}
function Column({ stage, tasks, onDragStart, onDragOver, onDrop, isDragOver, onAdd, onOpenDetail, onEdit, onDelete }) {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: `kanban-col ${isDragOver ? "drag-over" : ""}`,
      onDragOver: (e) => {
        e.preventDefault();
        onDragOver(stage.id);
      },
      onDrop: (e) => {
        e.preventDefault();
        onDrop(stage.id);
      },
      children: [
        /* @__PURE__ */ jsxs("div", { className: "kanban-col-header", children: [
          /* @__PURE__ */ jsxs("div", { className: "kanban-col-title", children: [
            /* @__PURE__ */ jsx("span", { className: "kanban-col-badge", style: { background: stage.bg, color: stage.color }, children: stage.label }),
            /* @__PURE__ */ jsx("span", { className: "kanban-col-count", children: tasks.length })
          ] }),
          /* @__PURE__ */ jsx("button", { className: "kanban-add-btn", onClick: () => onAdd(stage.id), children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", width: "14", height: "14", children: [
            /* @__PURE__ */ jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
            /* @__PURE__ */ jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })
          ] }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "kanban-col-body", children: [
          tasks.map((t) => /* @__PURE__ */ jsx(
            TaskCard,
            {
              task: t,
              onDragStart,
              onOpenDetail,
              onEdit,
              onDelete
            },
            t.id
          )),
          tasks.length === 0 && /* @__PURE__ */ jsx("div", { className: "kanban-empty", children: "Drop cards here" })
        ] })
      ]
    }
  );
}
function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  useEffect(() => {
    Promise.all([api.getTasks(), api.getCustomers()]).then(([t, c]) => {
      setTasks(Array.isArray(t) ? t : []);
      setCustomers(Array.isArray(c) ? c : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  function handleDragStart(id) {
    setDragId(id);
  }
  function handleDragOver(sid) {
    setDragOver(sid);
  }
  async function handleDrop(targetStage) {
    setDragOver(null);
    if (!dragId) return;
    const task = tasks.find((t) => t.id === dragId);
    if (!task || task.stage === targetStage) {
      setDragId(null);
      return;
    }
    setTasks((prev) => prev.map((t) => t.id === dragId ? { ...t, stage: targetStage } : t));
    setDragId(null);
    await api.updateTask(dragId, { stage: targetStage }).catch(() => {
      setTasks((prev) => prev.map((t) => t.id === dragId ? { ...t, stage: task.stage } : t));
    });
  }
  async function handleSave(fields) {
    if (modal.mode === "new") {
      const created = await api.createTask({ ...fields, stage: modal.stage });
      setTasks((prev) => [...prev, created]);
    } else {
      const updated = await api.updateTask(modal.task.id, fields);
      setTasks((prev) => prev.map((t) => t.id === modal.task.id ? updated : t));
    }
    setModal(null);
  }
  async function handleDelete(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if ((detail == null ? void 0 : detail.id) === id) setDetail(null);
    await api.deleteTask(id).catch(() => {
    });
  }
  function handleTaskUpdate(updated) {
    setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    if ((detail == null ? void 0 : detail.id) === updated.id) setDetail(updated);
  }
  const byStage = (id) => tasks.filter((t) => t.stage === id);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "topnav", children: [
      /* @__PURE__ */ jsx("div", { className: "topnav-left", children: /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Tasks" }) }),
      /* @__PURE__ */ jsx("div", { className: "topnav-right", children: /* @__PURE__ */ jsx("button", { className: "btn btn-primary btn-sm", onClick: () => setModal({ mode: "new", stage: "urgent" }), children: "+ New Task" }) })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { style: { padding: 32, display: "flex", justifyContent: "center" }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(ProgressBar, { tasks }),
      /* @__PURE__ */ jsx("div", { className: "kanban-board", children: STAGES.map((stage) => /* @__PURE__ */ jsx(
        Column,
        {
          stage,
          tasks: byStage(stage.id),
          onDragStart: handleDragStart,
          onDragOver: handleDragOver,
          onDrop: handleDrop,
          isDragOver: dragOver === stage.id,
          onAdd: (stage2) => setModal({ mode: "new", stage: stage2 }),
          onOpenDetail: (task) => setDetail(task),
          onEdit: (task) => setModal({ mode: "edit", task }),
          onDelete: handleDelete
        },
        stage.id
      )) })
    ] }),
    modal && /* @__PURE__ */ jsx(
      TaskModal,
      {
        initial: modal.mode === "edit" ? modal.task : { stage: modal.stage },
        customers,
        onSave: handleSave,
        onClose: () => setModal(null)
      }
    ),
    detail && /* @__PURE__ */ jsx(
      TaskDetail,
      {
        task: detail,
        customers,
        onClose: () => setDetail(null),
        onTaskUpdate: handleTaskUpdate
      }
    )
  ] });
}
export {
  Tasks as default
};
