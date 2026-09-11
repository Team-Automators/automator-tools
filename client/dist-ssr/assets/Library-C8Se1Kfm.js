import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { g as getLocationId, a as api } from "../entry-server.mjs";
import { s as stageOf, T as TaskModal, a as TaskDetail } from "./TaskModals-CJ215kkH.js";
import { c as confirmToast, n as notifySuccess } from "./toast-DrUOosTv.js";
import "node:async_hooks";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-toastify";
function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}
const STATUS_META = {
  "draft": { label: "Draft", color: "#64748B", bg: "rgba(100,116,139,.14)" },
  "in-progress": { label: "In Progress", color: "#2563EB", bg: "rgba(37,99,235,.14)" },
  "completed": { label: "Completed", color: "#16A34A", bg: "rgba(22,163,74,.14)" }
};
const STATUS_ORDER = ["in-progress", "completed", "draft"];
function StatusPills({ counts }) {
  const entries = STATUS_ORDER.filter((s) => counts == null ? void 0 : counts[s]);
  if (!entries.length) return null;
  return /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }, children: entries.map((s) => /* @__PURE__ */ jsxs("span", { style: {
    fontSize: ".65rem",
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 99,
    color: STATUS_META[s].color,
    background: STATUS_META[s].bg
  }, children: [
    counts[s],
    " ",
    STATUS_META[s].label
  ] }, s)) });
}
function Library() {
  const navigate = useNavigate();
  const locationId = getLocationId();
  const [customers, setCustomers] = useState([]);
  const [counts, setCounts] = useState({});
  const [statusMap, setStatusMap] = useState({});
  const [unsortedCount, setUnsortedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [allTasks, setAllTasks] = useState([]);
  const [taskCounts, setTaskCounts] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [panelCustomer, setPanelCustomer] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  async function load() {
    const [custs, copies, tasks] = await Promise.all([
      api.getCustomers(),
      api.getCopies(),
      api.getTasks()
    ]);
    setCustomers(Array.isArray(custs) ? custs : []);
    const cmap = {};
    const smap = {};
    let unsorted = 0;
    (Array.isArray(copies) ? copies : []).forEach((c) => {
      const cid = !c.customerId || c.customerId === "_unsorted" ? "_unsorted" : c.customerId;
      if (cid === "_unsorted") unsorted++;
      else cmap[cid] = (cmap[cid] || 0) + 1;
      const s = STATUS_META[c.status] ? c.status : "in-progress";
      smap[cid] = smap[cid] || {};
      smap[cid][s] = (smap[cid][s] || 0) + 1;
    });
    setCounts(cmap);
    setStatusMap(smap);
    setUnsortedCount(unsorted);
    const taskList = Array.isArray(tasks) ? tasks : [];
    setAllTasks(taskList);
    const tmap = {};
    taskList.forEach((t) => {
      if (t.customerId) tmap[t.customerId] = (tmap[t.customerId] || 0) + 1;
    });
    setTaskCounts(tmap);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  function goCustomer(id) {
    const u = new URL(`/library/${id}`, window.location.origin);
    if (locationId) u.searchParams.set("locationId", locationId);
    navigate(u.pathname + u.search);
  }
  async function createCustomer() {
    if (!newName.trim()) return;
    setCreating(true);
    const cust = await api.createCustomer(newName.trim(), newEmail.trim());
    setCreating(false);
    setShowForm(false);
    setNewName("");
    setNewEmail("");
    await load();
    goCustomer(cust.id);
  }
  async function deleteCustomer(e, id) {
    e.stopPropagation();
    if (!await confirmToast("Delete this customer and remove them from all copies?", { confirmText: "Delete" })) return;
    await api.deleteCustomer(id);
    load();
    notifySuccess("Customer deleted");
  }
  function startRename(e, c) {
    e.stopPropagation();
    setEditingId(c.id);
    setEditName(c.name);
  }
  function cancelRename(e) {
    if (e) e.stopPropagation();
    setEditingId(null);
    setEditName("");
  }
  async function saveRename(e, id) {
    if (e) e.stopPropagation();
    const name = editName.trim();
    const current = customers.find((c) => c.id === id);
    if (!name || name === (current == null ? void 0 : current.name)) {
      cancelRename();
      return;
    }
    setCustomers((prev) => prev.map((c) => c.id === id ? { ...c, name } : c));
    setEditingId(null);
    const res = await api.updateCustomer(id, { name }).catch(() => null);
    if (!res || res.error) load();
  }
  function openTaskPanel(e, customer) {
    e.stopPropagation();
    setPanelCustomer(customer);
  }
  async function handleTaskSave(fields) {
    if (!(editingTask == null ? void 0 : editingTask.id)) return;
    const updated = await api.updateTask(editingTask.id, fields).catch(() => null);
    if (updated) {
      setAllTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      if ((detailTask == null ? void 0 : detailTask.id) === updated.id) setDetailTask(updated);
    }
    setEditingTask(null);
  }
  function handleTaskUpdate(updated) {
    setAllTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    if ((detailTask == null ? void 0 : detailTask.id) === updated.id) setDetailTask(updated);
  }
  const panelTasks = panelCustomer ? allTasks.filter((t) => t.customerId === panelCustomer.id) : [];
  if (loading) return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "topnav", children: /* @__PURE__ */ jsx("div", { className: "topnav-left", children: /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Library" }) }) }),
    /* @__PURE__ */ jsx("div", { style: { padding: 32, display: "flex", justifyContent: "center" }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) })
  ] });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "topnav", children: [
      /* @__PURE__ */ jsxs("div", { className: "topnav-left", children: [
        /* @__PURE__ */ jsx("span", { className: "breadcrumb", children: "Dashboard" }),
        /* @__PURE__ */ jsx("span", { className: "breadcrumb-sep", children: "/" }),
        /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Library" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "topnav-right", children: /* @__PURE__ */ jsxs("button", { className: "btn btn-primary btn-sm", onClick: () => setShowForm((v) => !v), children: [
        /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", width: "14", height: "14", children: [
          /* @__PURE__ */ jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
          /* @__PURE__ */ jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })
        ] }),
        "New Customer"
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "content", children: [
      /* @__PURE__ */ jsx("div", { className: "page-header", children: /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "page-title", children: "Copy Library" }),
        /* @__PURE__ */ jsx("div", { className: "page-sub", children: "Organize generated copy by customer" })
      ] }) }),
      showForm && /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 20, marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }, children: [
        /* @__PURE__ */ jsx("div", { className: "fw-700", style: { fontSize: ".9375rem" }, children: "New Customer" }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ jsxs("div", { className: "form-group", style: { flex: 1, minWidth: 180 }, children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Name *" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                className: "form-input",
                value: newName,
                onChange: (e) => setNewName(e.target.value),
                placeholder: "Acme Corp",
                onKeyDown: (e) => e.key === "Enter" && createCustomer(),
                autoFocus: true
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "form-group", style: { flex: 1, minWidth: 180 }, children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "Email (optional)" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                className: "form-input",
                type: "email",
                value: newEmail,
                onChange: (e) => setNewEmail(e.target.value),
                placeholder: "name@company.com",
                onKeyDown: (e) => e.key === "Enter" && createCustomer()
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 10 }, children: [
          /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: createCustomer, disabled: creating || !newName.trim(), children: creating ? "Creating…" : "Create" }),
          /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: () => setShowForm(false), children: "Cancel" })
        ] })
      ] }),
      customers.length === 0 && unsortedCount === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "empty-icon", children: "📁" }),
        /* @__PURE__ */ jsx("div", { className: "empty-title", children: "No copy saved yet" }),
        /* @__PURE__ */ jsx("div", { className: "empty-sub", children: "Save copy from a Copywriter session to build your library" })
      ] }) : /* @__PURE__ */ jsxs("div", { className: "customer-grid", children: [
        unsortedCount > 0 && /* @__PURE__ */ jsxs("div", { className: "customer-card unsorted", onClick: () => goCustomer("_unsorted"), children: [
          /* @__PURE__ */ jsx("div", { className: "customer-avatar", style: { fontSize: "1.25rem" }, children: "📂" }),
          /* @__PURE__ */ jsx("div", { className: "customer-name", children: "Unsorted" }),
          /* @__PURE__ */ jsxs("div", { className: "customer-meta", children: [
            unsortedCount,
            " saved copy piece",
            unsortedCount !== 1 ? "s" : ""
          ] }),
          /* @__PURE__ */ jsx(StatusPills, { counts: statusMap["_unsorted"] })
        ] }),
        customers.map((c) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: "customer-card",
            onClick: () => editingId === c.id ? null : goCustomer(c.id),
            children: [
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between" }, children: [
                /* @__PURE__ */ jsx("div", { className: "customer-avatar", children: initials(c.name) }),
                /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 2 }, children: [
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      className: "btn btn-ghost btn-sm",
                      style: { color: "var(--sub)", padding: "4px 6px", minHeight: "auto" },
                      onClick: (e) => startRename(e, c),
                      title: "Rename folder",
                      children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "14", height: "14", children: [
                        /* @__PURE__ */ jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
                        /* @__PURE__ */ jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })
                      ] })
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      className: "btn btn-ghost btn-sm",
                      style: { color: "var(--danger)", padding: "4px 6px", minHeight: "auto" },
                      onClick: (e) => deleteCustomer(e, c.id),
                      title: "Delete customer",
                      children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "14", height: "14", children: [
                        /* @__PURE__ */ jsx("polyline", { points: "3 6 5 6 21 6" }),
                        /* @__PURE__ */ jsx("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }),
                        /* @__PURE__ */ jsx("path", { d: "M10 11v6M14 11v6" })
                      ] })
                    }
                  )
                ] })
              ] }),
              editingId === c.id ? /* @__PURE__ */ jsx(
                "input",
                {
                  className: "form-input",
                  style: { marginTop: 8, fontSize: ".9375rem", fontWeight: 700 },
                  value: editName,
                  autoFocus: true,
                  onClick: (e) => e.stopPropagation(),
                  onChange: (e) => setEditName(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === "Enter") saveRename(e, c.id);
                    else if (e.key === "Escape") cancelRename(e);
                  },
                  onBlur: (e) => saveRename(e, c.id)
                }
              ) : /* @__PURE__ */ jsx("div", { className: "customer-name", children: c.name }),
              c.email && /* @__PURE__ */ jsx("div", { className: "customer-meta", children: c.email }),
              /* @__PURE__ */ jsxs("div", { className: "customer-meta", children: [
                counts[c.id] || 0,
                " copy piece",
                counts[c.id] !== 1 ? "s" : ""
              ] }),
              /* @__PURE__ */ jsx(StatusPills, { counts: statusMap[c.id] }),
              taskCounts[c.id] > 0 && /* @__PURE__ */ jsxs(
                "button",
                {
                  className: "lib-task-badge",
                  onClick: (e) => openTaskPanel(e, c),
                  title: "View & edit tasks",
                  children: [
                    /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "11", height: "11", children: [
                      /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
                      /* @__PURE__ */ jsx("path", { d: "M9 12l2 2 4-4" })
                    ] }),
                    taskCounts[c.id],
                    " task",
                    taskCounts[c.id] !== 1 ? "s" : ""
                  ]
                }
              )
            ]
          },
          c.id
        ))
      ] })
    ] }),
    panelCustomer && /* @__PURE__ */ jsx("div", { className: "modal-backdrop", onClick: () => setPanelCustomer(null), children: /* @__PURE__ */ jsxs("div", { className: "lib-task-panel", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxs("div", { className: "lib-task-panel-header", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "lib-task-panel-title", children: panelCustomer.name }),
          /* @__PURE__ */ jsxs("div", { style: { fontSize: ".75rem", color: "var(--sub)", marginTop: 2 }, children: [
            panelTasks.length,
            " task",
            panelTasks.length !== 1 ? "s" : ""
          ] })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "task-detail-close", onClick: () => setPanelCustomer(null), children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", width: "18", height: "18", children: [
          /* @__PURE__ */ jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
          /* @__PURE__ */ jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
        ] }) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "lib-task-panel-body", children: panelTasks.map((task) => {
        const stage = stageOf(task.stage);
        const notes = Array.isArray(task.notes) ? task.notes : [];
        const lastNote = notes[notes.length - 1];
        return /* @__PURE__ */ jsxs("div", { className: "lib-task-row", children: [
          /* @__PURE__ */ jsxs("div", { className: "lib-task-row-info", children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 7 }, children: [
              /* @__PURE__ */ jsxs("span", { style: {
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: ".68rem",
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 99,
                background: stage.bg,
                color: stage.color,
                flexShrink: 0
              }, children: [
                /* @__PURE__ */ jsx("span", { style: { width: 5, height: 5, borderRadius: "50%", background: stage.color, display: "inline-block" } }),
                stage.label
              ] }),
              /* @__PURE__ */ jsx("div", { style: { fontSize: ".875rem", fontWeight: 600 }, children: task.title })
            ] }),
            lastNote && /* @__PURE__ */ jsx("div", { style: { fontSize: ".75rem", color: "var(--sub)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: lastNote.text }),
            notes.length > 0 && /* @__PURE__ */ jsxs("div", { style: { fontSize: ".7rem", color: "var(--sub)", marginTop: 2 }, children: [
              notes.length,
              " note",
              notes.length !== 1 ? "s" : ""
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 4, flexShrink: 0 }, children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                className: "task-icon-btn",
                title: "Edit task",
                onClick: () => setEditingTask(task),
                children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "13", height: "13", children: [
                  /* @__PURE__ */ jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
                  /* @__PURE__ */ jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })
                ] })
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                className: "task-icon-btn",
                title: "View notes",
                onClick: () => setDetailTask(task),
                children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "13", height: "13", children: /* @__PURE__ */ jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }) })
              }
            )
          ] })
        ] }, task.id);
      }) })
    ] }) }),
    editingTask && /* @__PURE__ */ jsx(
      TaskModal,
      {
        initial: editingTask,
        customers,
        onSave: handleTaskSave,
        onClose: () => setEditingTask(null)
      }
    ),
    detailTask && /* @__PURE__ */ jsx(
      TaskDetail,
      {
        task: detailTask,
        onClose: () => setDetailTask(null),
        onTaskUpdate: handleTaskUpdate
      }
    )
  ] });
}
export {
  Library as default
};
