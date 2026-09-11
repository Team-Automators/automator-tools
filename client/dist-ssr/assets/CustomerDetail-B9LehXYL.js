import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { g as getLocationId, a as api } from "../entry-server.mjs";
import { T as TYPE_ORDER, a as TYPES } from "./types-nNhWZ2i7.js";
import { s as stageOf, T as TaskModal, a as TaskDetail } from "./TaskModals-CJ215kkH.js";
import { c as confirmToast, n as notifySuccess } from "./toast-DrUOosTv.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-toastify";
function relTime(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 6e4);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
const STATUS_OPTS = [
  { value: "draft", label: "Draft", color: "#64748B", bg: "rgba(100,116,139,.14)" },
  { value: "in-progress", label: "In Progress", color: "#2563EB", bg: "rgba(37,99,235,.14)" },
  { value: "completed", label: "Completed", color: "#16A34A", bg: "rgba(22,163,74,.14)" }
];
const STATUS_META = Object.fromEntries(STATUS_OPTS.map((s) => [s.value, s]));
function CustomerDetail() {
  var _a;
  const { customerId } = useParams();
  const navigate = useNavigate();
  const locationId = getLocationId();
  const isUnsorted = customerId === "_unsorted";
  const [customer, setCustomer] = useState(null);
  const [copies, setCopies] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [movingCopyId, setMovingCopyId] = useState(null);
  const [moveToCustId, setMoveToCustId] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  async function load() {
    if (isUnsorted) {
      const [allCopies2, custs3] = await Promise.all([api.getCopies(), api.getCustomers()]);
      const unsorted = (Array.isArray(allCopies2) ? allCopies2 : []).filter(
        (c) => !c.customerId || c.customerId === "_unsorted"
      );
      setCopies(unsorted);
      setCustomers(Array.isArray(custs3) ? custs3 : []);
      setLoading(false);
      return;
    }
    const [allCopies, custs, allTasks] = await Promise.all([
      api.getCopies(customerId),
      api.getCustomers(),
      api.getTasks()
    ]);
    setCopies(Array.isArray(allCopies) ? allCopies : []);
    setTasks((Array.isArray(allTasks) ? allTasks : []).filter((t) => t.customerId === customerId));
    const custs2 = Array.isArray(custs) ? custs : [];
    setCustomers(custs2);
    const found = custs2.find((c) => c.id === customerId);
    if (!found && !isUnsorted) {
      goLibrary();
      return;
    }
    setCustomer(found || null);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [customerId]);
  function goLibrary() {
    const u = new URL("/library", window.location.origin);
    if (locationId) u.searchParams.set("locationId", locationId);
    navigate(u.pathname + u.search);
  }
  function goCopy(copyId) {
    const u = new URL(`/library/${customerId}/${copyId}`, window.location.origin);
    if (locationId) u.searchParams.set("locationId", locationId);
    navigate(u.pathname + u.search);
  }
  function goCopywriters(type) {
    const u = new URL(`/copywriters/${type}`, window.location.origin);
    if (locationId) u.searchParams.set("locationId", locationId);
    navigate(u.pathname + u.search);
  }
  async function deleteCopy(e, copyId) {
    e.stopPropagation();
    if (!await confirmToast("Move this conversation to Archive? You can restore it later.", { confirmText: "Archive", danger: false })) return;
    setCopies((prev) => prev.filter((c) => c.id !== copyId));
    await api.deleteCopy(copyId).catch(() => load());
    notifySuccess("Moved to Archive");
  }
  async function changeStatus(e, copyId, status) {
    e.stopPropagation();
    setCopies((prev) => prev.map((c) => c.id === copyId ? { ...c, status } : c));
    await api.setCopyStatus(copyId, status).catch(() => load());
  }
  function startRename() {
    setRenameVal((customer == null ? void 0 : customer.name) || "");
    setRenaming(true);
  }
  async function saveRename() {
    const name = renameVal.trim();
    if (!name || name === (customer == null ? void 0 : customer.name)) {
      setRenaming(false);
      return;
    }
    setCustomer((c) => c ? { ...c, name } : c);
    setRenaming(false);
    const res = await api.updateCustomer(customerId, { name }).catch(() => null);
    if (!res || res.error) load();
  }
  async function handleTaskSave(fields) {
    if (!(editingTask == null ? void 0 : editingTask.id)) return;
    const updated = await api.updateTask(editingTask.id, fields).catch(() => null);
    if (updated) {
      setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      if ((detailTask == null ? void 0 : detailTask.id) === updated.id) setDetailTask(updated);
    }
    setEditingTask(null);
  }
  function handleTaskUpdate(updated) {
    setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    if ((detailTask == null ? void 0 : detailTask.id) === updated.id) setDetailTask(updated);
  }
  async function doMove() {
    if (!moveToCustId || !movingCopyId) return;
    const cust = customers.find((c) => c.id === moveToCustId);
    const full = await api.getCopy(movingCopyId);
    if (!full) return;
    await api.updateCopy(movingCopyId, {
      messages: full.messages || [],
      customerId: moveToCustId,
      customerName: (cust == null ? void 0 : cust.name) || ""
    });
    setMovingCopyId(null);
    load();
  }
  const visibleCopies = statusFilter === "all" ? copies : copies.filter((c) => (c.status || "in-progress") === statusFilter);
  const statusCounts = copies.reduce((m, c) => {
    const s = STATUS_META[c.status] ? c.status : "in-progress";
    m[s] = (m[s] || 0) + 1;
    return m;
  }, {});
  const grouped = {};
  visibleCopies.forEach((c) => {
    const t = c.type || "general";
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(c);
  });
  const customerName = isUnsorted ? "Unsorted" : (customer == null ? void 0 : customer.name) || customerId;
  if (loading) return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "topnav", children: /* @__PURE__ */ jsxs("div", { className: "topnav-left", children: [
      /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: goLibrary, style: { padding: "6px 8px" }, children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "16", height: "16", children: /* @__PURE__ */ jsx("path", { d: "M19 12H5M12 19l-7-7 7-7" }) }) }),
      /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Loading…" })
    ] }) }),
    /* @__PURE__ */ jsx("div", { style: { padding: 32, display: "flex", justifyContent: "center" }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) })
  ] });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "topnav", children: /* @__PURE__ */ jsxs("div", { className: "topnav-left", children: [
      /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: goLibrary, style: { padding: "6px 8px" }, children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "16", height: "16", children: /* @__PURE__ */ jsx("path", { d: "M19 12H5M12 19l-7-7 7-7" }) }) }),
      /* @__PURE__ */ jsx("span", { className: "breadcrumb", children: "Library" }),
      /* @__PURE__ */ jsx("span", { className: "breadcrumb-sep", children: "/" }),
      /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: customerName })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "content", children: [
      /* @__PURE__ */ jsx("div", { className: "page-header", children: /* @__PURE__ */ jsxs("div", { children: [
        renaming ? /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-input",
            style: { fontSize: "1.1rem", fontWeight: 700, maxWidth: 380 },
            value: renameVal,
            autoFocus: true,
            onChange: (e) => setRenameVal(e.target.value),
            onKeyDown: (e) => {
              if (e.key === "Enter") saveRename();
              else if (e.key === "Escape") setRenaming(false);
            },
            onBlur: saveRename
          }
        ) : /* @__PURE__ */ jsxs("div", { className: "page-title", style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          customerName,
          !isUnsorted && /* @__PURE__ */ jsx(
            "button",
            {
              className: "btn btn-ghost btn-sm",
              style: { padding: "4px 6px", minHeight: "auto", color: "var(--sub)" },
              onClick: startRename,
              title: "Rename folder",
              children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "16", height: "16", children: [
                /* @__PURE__ */ jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
                /* @__PURE__ */ jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })
              ] })
            }
          )
        ] }),
        (customer == null ? void 0 : customer.email) && /* @__PURE__ */ jsx("div", { className: "page-sub", children: customer.email }),
        /* @__PURE__ */ jsxs("div", { className: "page-sub", children: [
          copies.length,
          " saved copy piece",
          copies.length !== 1 ? "s" : ""
        ] })
      ] }) }),
      copies.length > 0 && /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }, children: [{ value: "all", label: "All", color: "var(--text)", bg: "var(--surface)" }, ...STATUS_OPTS].map((f) => {
        const active = statusFilter === f.value;
        const count = f.value === "all" ? copies.length : statusCounts[f.value] || 0;
        return /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setStatusFilter(f.value),
            style: {
              fontSize: ".75rem",
              fontWeight: 700,
              padding: "5px 12px",
              borderRadius: 99,
              cursor: "pointer",
              border: active ? `1px solid ${f.color}` : "1px solid var(--border)",
              color: active ? f.color : "var(--sub)",
              background: active ? f.bg : "transparent"
            },
            children: [
              f.label,
              " ",
              count > 0 && /* @__PURE__ */ jsxs("span", { style: { opacity: 0.7 }, children: [
                "(",
                count,
                ")"
              ] })
            ]
          },
          f.value
        );
      }) }),
      tasks.length > 0 && /* @__PURE__ */ jsxs("div", { className: "type-group", style: { marginBottom: 24 }, children: [
        /* @__PURE__ */ jsx("div", { className: "type-group-header", children: /* @__PURE__ */ jsxs("div", { className: "type-group-title", children: [
          /* @__PURE__ */ jsx("div", { className: "type-group-icon", style: { background: "rgba(139,92,246,.12)", color: "#8B5CF6" }, children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "14", height: "14", children: [
            /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
            /* @__PURE__ */ jsx("path", { d: "M9 12l2 2 4-4" })
          ] }) }),
          "Tasks",
          /* @__PURE__ */ jsx("span", { style: { background: "rgba(139,92,246,.12)", color: "#8B5CF6", fontSize: ".6875rem", fontWeight: 700, padding: "2px 7px", borderRadius: 99 }, children: tasks.length })
        ] }) }),
        /* @__PURE__ */ jsx("div", { className: "copy-list", children: tasks.map((task) => {
          const stage = stageOf(task.stage);
          const notes = Array.isArray(task.notes) ? task.notes : [];
          const lastNote = notes[notes.length - 1];
          return /* @__PURE__ */ jsxs("div", { className: "copy-row", onClick: () => setDetailTask(task), style: { cursor: "pointer" }, children: [
            /* @__PURE__ */ jsxs("div", { className: "copy-row-info", children: [
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: ".7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: stage.bg, color: stage.color }, children: [
                  /* @__PURE__ */ jsx("span", { style: { width: 6, height: 6, borderRadius: "50%", background: stage.color, display: "inline-block" } }),
                  stage.label
                ] }),
                /* @__PURE__ */ jsx("div", { className: "copy-row-title", children: task.title })
              ] }),
              lastNote && /* @__PURE__ */ jsx("div", { className: "copy-row-meta truncate", style: { maxWidth: "60vw" }, children: lastNote.text }),
              /* @__PURE__ */ jsxs("div", { className: "copy-row-meta", style: { display: "flex", gap: 10 }, children: [
                notes.length > 0 && /* @__PURE__ */ jsxs("span", { children: [
                  notes.length,
                  " note",
                  notes.length !== 1 ? "s" : ""
                ] }),
                task.clickupTaskId && /* @__PURE__ */ jsxs(
                  "a",
                  {
                    href: `https://app.clickup.com/t/${task.clickupTaskId}`,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "task-cu-detail-link",
                    onClick: (e) => e.stopPropagation(),
                    style: { fontSize: ".75rem" },
                    children: [
                      task.clickupTaskName || "ClickUp",
                      " ↗"
                    ]
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "copy-row-actions", onClick: (e) => e.stopPropagation(), children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  className: "btn btn-ghost btn-sm",
                  title: "Edit task",
                  onClick: (e) => {
                    e.stopPropagation();
                    setEditingTask(task);
                  },
                  children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "14", height: "14", children: [
                    /* @__PURE__ */ jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
                    /* @__PURE__ */ jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })
                  ] })
                }
              ),
              /* @__PURE__ */ jsxs(
                "button",
                {
                  className: "btn btn-ghost btn-sm",
                  title: "View notes",
                  onClick: (e) => {
                    e.stopPropagation();
                    setDetailTask(task);
                  },
                  children: [
                    /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "14", height: "14", children: /* @__PURE__ */ jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 0 2 2z" }) }),
                    notes.length > 0 && /* @__PURE__ */ jsx("span", { style: { fontSize: ".65rem", marginLeft: 2 }, children: notes.length })
                  ]
                }
              )
            ] })
          ] }, task.id);
        }) })
      ] }),
      copies.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "empty-icon", children: "📝" }),
        /* @__PURE__ */ jsx("div", { className: "empty-title", children: "No copy yet" }),
        /* @__PURE__ */ jsx("div", { className: "empty-sub", children: "Save from a Copywriter session to build this folder" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary mt-2", onClick: () => goCopywriters("email"), children: "Open Copywriters" })
      ] }) : visibleCopies.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsxs("div", { className: "empty-sub", children: [
          "No conversations with “",
          ((_a = STATUS_META[statusFilter]) == null ? void 0 : _a.label) || statusFilter,
          "” status."
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary mt-2", onClick: () => setStatusFilter("all"), children: "Show all" })
      ] }) : TYPE_ORDER.filter((t) => grouped[t]).map((typeKey) => {
        const typeInfo = TYPES[typeKey] || TYPES.general;
        return /* @__PURE__ */ jsxs("div", { className: "type-group", children: [
          /* @__PURE__ */ jsxs("div", { className: "type-group-header", children: [
            /* @__PURE__ */ jsxs("div", { className: "type-group-title", children: [
              /* @__PURE__ */ jsx(
                "div",
                {
                  className: "type-group-icon",
                  style: { background: typeInfo.colorBg, color: typeInfo.color },
                  dangerouslySetInnerHTML: { __html: typeInfo.icon.replace('width="18"', 'width="14"').replace('height="18"', 'height="14"') }
                }
              ),
              typeInfo.title,
              /* @__PURE__ */ jsx("span", { style: { background: typeInfo.colorBg, color: typeInfo.color, fontSize: ".6875rem", fontWeight: 700, padding: "2px 7px", borderRadius: 99 }, children: grouped[typeKey].length })
            ] }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => goCopywriters(typeKey), children: "+ New" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "copy-list", children: grouped[typeKey].map((copy) => /* @__PURE__ */ jsxs("div", { className: "copy-row", onClick: () => goCopy(copy.id), children: [
            /* @__PURE__ */ jsxs("div", { className: "copy-row-info", children: [
              /* @__PURE__ */ jsx("div", { className: "copy-row-title", children: copy.title || "Untitled" }),
              copy.preview && /* @__PURE__ */ jsx("div", { className: "copy-row-meta truncate", style: { maxWidth: "60vw" }, children: copy.preview }),
              /* @__PURE__ */ jsx("div", { className: "copy-row-meta", children: relTime(copy.updatedAt) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "copy-row-actions", onClick: (e) => e.stopPropagation(), children: [
              /* @__PURE__ */ jsx(
                "select",
                {
                  className: "form-input form-select",
                  value: STATUS_META[copy.status] ? copy.status : "in-progress",
                  onClick: (e) => e.stopPropagation(),
                  onChange: (e) => changeStatus(e, copy.id, e.target.value),
                  title: "Status",
                  style: {
                    width: "auto",
                    minHeight: "auto",
                    padding: "4px 24px 4px 10px",
                    fontSize: ".72rem",
                    fontWeight: 700,
                    color: (STATUS_META[copy.status] || STATUS_META["in-progress"]).color,
                    background: (STATUS_META[copy.status] || STATUS_META["in-progress"]).bg,
                    border: "none",
                    borderRadius: 99
                  },
                  children: STATUS_OPTS.map((s) => /* @__PURE__ */ jsx("option", { value: s.value, children: s.label }, s.value))
                }
              ),
              isUnsorted && /* @__PURE__ */ jsx(
                "button",
                {
                  className: "btn btn-secondary btn-sm",
                  onClick: (e) => {
                    e.stopPropagation();
                    setMovingCopyId(copy.id);
                    setMoveToCustId("");
                  },
                  children: "Move"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  className: "btn btn-ghost btn-sm",
                  style: { color: "var(--danger)" },
                  onClick: (e) => deleteCopy(e, copy.id),
                  title: "Archive",
                  children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "14", height: "14", children: [
                    /* @__PURE__ */ jsx("polyline", { points: "3 6 5 6 21 6" }),
                    /* @__PURE__ */ jsx("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" })
                  ] })
                }
              )
            ] })
          ] }, copy.id)) })
        ] }, typeKey);
      })
    ] }),
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
    ),
    movingCopyId && /* @__PURE__ */ jsx("div", { className: "modal-backdrop", onClick: () => setMovingCopyId(null), children: /* @__PURE__ */ jsxs("div", { className: "modal", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsx("div", { className: "modal-title", children: "Move to Customer" }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Select customer" }),
        /* @__PURE__ */ jsxs(
          "select",
          {
            className: "form-input form-select",
            value: moveToCustId,
            onChange: (e) => setMoveToCustId(e.target.value),
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "Choose…" }),
              customers.map((c) => /* @__PURE__ */ jsx("option", { value: c.id, children: c.name }, c.id))
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "modal-actions", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary flex-1", onClick: doMove, disabled: !moveToCustId, children: "Move" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: () => setMovingCopyId(null), children: "Cancel" })
      ] })
    ] }) })
  ] });
}
export {
  CustomerDetail as default
};
