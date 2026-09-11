import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useState, useRef, useEffect, useMemo, Fragment as Fragment$1 } from "react";
import { g as getLocationId, a as api } from "../entry-server.mjs";
import { g as getCached, s as setCached } from "./useCachedResource-la3fKty1.js";
import { n as notifySuccess, c as confirmToast, a as notifyError } from "./toast-DrUOosTv.js";
import { b as SVC, c as SERVICES, s as stageOf, T as TaskModal } from "./TaskModals-CJ215kkH.js";
import "node:async_hooks";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
import "react-toastify";
const DAY = 864e5;
const today = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const toDateStr = (ts) => new Date(ts).toISOString().slice(0, 10);
function daysBetween(dateStr) {
  if (!dateStr) return 0;
  const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00");
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY));
}
function fmtDate(v) {
  if (!v) return "";
  const d = typeof v === "number" ? new Date(v) : /* @__PURE__ */ new Date(v + "T00:00:00");
  return isNaN(d) ? "" : d.toLocaleDateString(void 0, { month: "numeric", day: "numeric", year: "numeric" });
}
function monthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  const [y, m] = key.split("-");
  return new Date(y, m - 1, 1).toLocaleDateString(void 0, { month: "short", year: "numeric" });
}
function toEng(t) {
  const completed = t.stage === "done";
  return {
    id: t.id,
    title: t.title,
    clientName: t.customerName || "Unassigned",
    customerId: t.customerId || "",
    service: t.service,
    stage: t.stage,
    assignedDate: toDateStr(t.createdAt),
    dueDate: t.dueDate || "",
    waitingOn: t.waitingOn || "",
    status: completed ? "completed" : "active",
    finishedAt: completed ? t.updatedAt || t.createdAt : null,
    createdAt: t.createdAt
  };
}
function isOverdue(e) {
  return e.status === "active" && e.dueDate && (/* @__PURE__ */ new Date(e.dueDate + "T23:59:59")).getTime() < Date.now();
}
function Pipeline() {
  const cacheKey = `pipeline:${getLocationId()}`;
  const cached0 = getCached(cacheKey);
  const [tasks, setTasks] = useState(() => (cached0 == null ? void 0 : cached0.tasks) || []);
  const [customers, setCustomers] = useState(() => (cached0 == null ? void 0 : cached0.customers) || []);
  const [loading, setLoading] = useState(() => !cached0);
  const [view, setView] = useState("board");
  const [search, setSearch] = useState("");
  const [addCol, setAddCol] = useState(null);
  const [addTitle, setAddTitle] = useState("");
  const [addClient, setAddClient] = useState("");
  const [addDue, setAddDue] = useState("");
  const [analytics, setAnalytics] = useState("monthly");
  const [selMonth, setSelMonth] = useState(null);
  const [editId, setEditId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const fileRef = useRef(null);
  async function load() {
    if (!getCached(cacheKey)) setLoading(true);
    const [t, c] = await Promise.all([api.getTasks(), api.getCustomers()]);
    const tArr = Array.isArray(t) ? t : [], cArr = Array.isArray(c) ? c : [];
    setTasks(tArr);
    setCustomers(cArr);
    setCached(cacheKey, { tasks: tArr, customers: cArr });
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  const items = useMemo(() => tasks.filter((t) => t.service && SVC[t.service]).map(toEng), [tasks]);
  const q = search.trim().toLowerCase();
  const visible = q ? items.filter((e) => (e.clientName || "").toLowerCase().includes(q) || (e.title || "").toLowerCase().includes(q)) : items;
  const active = visible.filter((e) => e.status === "active");
  const completed = visible.filter((e) => e.status === "completed");
  const svcByClient = useMemo(() => {
    const m = {};
    active.forEach((e) => {
      var _a;
      (m[_a = e.clientName] || (m[_a] = /* @__PURE__ */ new Set())).add(e.service);
    });
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]]));
  }, [active]);
  const stats = {
    total: items.length,
    active: items.filter((e) => e.status === "active").length,
    overdue: items.filter(isOverdue).length,
    completed: items.filter((e) => e.status === "completed").length
  };
  function patchTask(id, fields) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...fields, updatedAt: Date.now() } : t));
  }
  async function addTask(serviceKey) {
    const title = addTitle.trim();
    if (!title) return;
    const cust = customers.find((c) => c.id === addClient);
    const created = await api.createTask({
      title,
      service: serviceKey,
      stage: "urgent",
      customerId: addClient || "",
      customerName: (cust == null ? void 0 : cust.name) || "",
      dueDate: addDue || ""
    }).catch(() => null);
    if (created == null ? void 0 : created.id) setTasks((prev) => [...prev, created]);
    setAddCol(null);
    setAddTitle("");
    setAddClient("");
    setAddDue("");
  }
  async function complete(e) {
    patchTask(e.id, { stage: "done" });
    await api.updateTask(e.id, { stage: "done" }).catch(() => load());
    notifySuccess("Marked complete");
  }
  async function reopen(e) {
    patchTask(e.id, { stage: "in-progress" });
    await api.updateTask(e.id, { stage: "in-progress" }).catch(() => load());
  }
  async function setWaiting(e, waitingOn) {
    patchTask(e.id, { waitingOn });
    await api.updateTask(e.id, { waitingOn }).catch(() => load());
  }
  async function setDue(e, dueDate) {
    patchTask(e.id, { dueDate });
    await api.updateTask(e.id, { dueDate }).catch(() => load());
  }
  async function moveToService(taskId, serviceKey) {
    const t = tasks.find((x) => x.id === taskId);
    if (!t || t.service === serviceKey) return;
    patchTask(taskId, { service: serviceKey });
    await api.updateTask(taskId, { service: serviceKey }).catch(() => load());
  }
  const editTask = editId ? tasks.find((t) => t.id === editId) : null;
  async function saveEdit(fields) {
    const updated = await api.updateTask(editId, fields).catch(() => null);
    if (updated == null ? void 0 : updated.id) setTasks((prev) => prev.map((t) => t.id === editId ? updated : t));
    else await load();
    setEditId(null);
  }
  async function removeEng(e) {
    if (!await confirmToast(`Delete task "${e.title}"? This removes it from Tasks and Pipeline.`, { confirmText: "Delete" })) return;
    setTasks((prev) => prev.filter((t) => t.id !== e.id));
    await api.deleteTask(e.id).catch(() => load());
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-backup-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function onImport(ev) {
    var _a;
    const file = (_a = ev.target.files) == null ? void 0 : _a[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || "[]"));
        const arr = Array.isArray(parsed) ? parsed : parsed.items;
        if (!Array.isArray(arr)) throw new Error("Invalid backup file");
        const valid = arr.filter((e) => e.service && SVC[e.service]);
        if (!valid.length) throw new Error("No valid pipeline items in file");
        if (!await confirmToast(`Import ${valid.length} item(s) as new tasks?`, { confirmText: "Import" })) return;
        const created = [];
        for (const e of valid) {
          const t = await api.createTask({
            title: e.title || e.clientName || "Imported",
            service: e.service,
            customerName: e.clientName === "Unassigned" ? "" : e.clientName || "",
            dueDate: e.dueDate || "",
            waitingOn: e.waitingOn || "",
            stage: e.status === "completed" ? "done" : "urgent"
          }).catch(() => null);
          if (t == null ? void 0 : t.id) created.push(t);
        }
        setTasks((prev) => [...prev, ...created]);
        notifySuccess(`Imported ${created.length}`);
      } catch (e) {
        notifyError(e.message || "Import failed");
      }
    };
    reader.readAsText(file);
    ev.target.value = "";
  }
  const buckets = useMemo(() => {
    const done = items.filter((e) => e.status === "completed" && e.finishedAt);
    if (analytics === "monthly") {
      const keys = [];
      const now = /* @__PURE__ */ new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      return keys.map((k) => ({ key: k, label: monthLabel(k), rows: done.filter((e) => monthKey(e.finishedAt) === k) }));
    }
    const years = {};
    done.forEach((e) => {
      const y = String(new Date(e.finishedAt).getFullYear());
      (years[y] || (years[y] = [])).push(e);
    });
    return Object.keys(years).sort().map((y) => ({ key: y, label: y, rows: years[y] }));
  }, [items, analytics]);
  const maxCount = Math.max(1, ...buckets.map((b) => b.rows.length));
  const sel = buckets.find((b) => b.key === selMonth) || [...buckets].reverse().find((b) => b.rows.length) || buckets[buckets.length - 1];
  const stat = (n, label, color) => /* @__PURE__ */ jsxs("div", { style: { flex: "1 1 68px", minWidth: 0, textAlign: "center", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)" }, children: [
    /* @__PURE__ */ jsx("div", { style: { fontSize: "1.1rem", fontWeight: 800, color: color || "var(--text)" }, children: n }),
    /* @__PURE__ */ jsx("div", { style: { fontSize: ".62rem", fontWeight: 700, letterSpacing: ".08em", color: "var(--sub)" }, children: label })
  ] });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "topnav", children: [
      /* @__PURE__ */ jsx("div", { className: "topnav-left", children: /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Pipeline" }) }),
      /* @__PURE__ */ jsxs("div", { className: "topnav-right", style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 4, background: "var(--surface)", borderRadius: 8, padding: 3 }, children: [
          /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${view === "board" ? "btn-primary" : "btn-ghost"}`, onClick: () => setView("board"), children: "Board" }),
          /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${view === "clients" ? "btn-primary" : "btn-ghost"}`, onClick: () => setView("clients"), children: "By Client" }),
          /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${view === "completed" ? "btn-primary" : "btn-ghost"}`, onClick: () => setView("completed"), children: "Completed Clients" })
        ] }),
        /* @__PURE__ */ jsx("input", { className: "form-input", style: { flex: "1 1 150px", minWidth: 0, maxWidth: 240, height: 34 }, placeholder: "Search client or task…", value: search, onChange: (e) => setSearch(e.target.value) }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: exportBackup, children: "Export Backup" }),
        /* @__PURE__ */ jsx("input", { ref: fileRef, type: "file", accept: ".json,application/json", onChange: onImport, style: { display: "none" } }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: () => {
          var _a;
          return (_a = fileRef.current) == null ? void 0 : _a.click();
        }, children: "Import Backup" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "content", children: [
      /* @__PURE__ */ jsx("div", { className: "page-title", style: { marginBottom: 12 }, children: "Client Pipeline Tracker" }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }, children: [
        stat(stats.total, "TOTAL"),
        stat(stats.active, "ACTIVE", "#D97706"),
        stat(stats.overdue, "OVERDUE", stats.overdue ? "var(--danger)" : "var(--sub)"),
        stat(stats.completed, "COMPLETED", "#16A34A")
      ] }),
      /* @__PURE__ */ jsxs("div", { style: { fontSize: ".78rem", color: "var(--sub)", marginBottom: 18 }, children: [
        "Synced with ",
        /* @__PURE__ */ jsx("b", { children: "Tasks" }),
        " — every task tagged with a service appears here. Set a task's Service in the Tasks tab or via ",
        /* @__PURE__ */ jsx("b", { children: "+ Add Task" }),
        " below."
      ] }),
      loading ? /* @__PURE__ */ jsx("div", { style: { padding: 32, display: "flex", justifyContent: "center" }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) }) : view === "board" ? /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }, children: SERVICES.map((svc) => {
        const colItems = active.filter((e) => e.service === svc.key);
        const overdueN = colItems.filter(isOverdue).length;
        const doneN = items.filter((e) => e.service === svc.key && e.status === "completed").length;
        return /* @__PURE__ */ jsxs(
          "div",
          {
            onDragOver: (ev) => {
              if (dragId) {
                ev.preventDefault();
                if (dragOver !== svc.key) setDragOver(svc.key);
              }
            },
            onDragLeave: (ev) => {
              if (!ev.currentTarget.contains(ev.relatedTarget)) setDragOver((o) => o === svc.key ? null : o);
            },
            onDrop: (ev) => {
              ev.preventDefault();
              if (dragId) moveToService(dragId, svc.key);
              setDragId(null);
              setDragOver(null);
            },
            style: { minWidth: 260, width: 260, flexShrink: 0, background: "var(--surface)", borderRadius: 12, borderTop: `3px solid ${svc.color}`, display: "flex", flexDirection: "column", outline: dragOver === svc.key ? `2px dashed ${svc.color}` : "none", outlineOffset: -2, transition: "outline-color .1s" },
            children: [
              /* @__PURE__ */ jsxs("div", { style: { padding: "12px 14px" }, children: [
                /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: ".9rem", color: "var(--text)" }, children: svc.label }),
                /* @__PURE__ */ jsxs("div", { style: { fontSize: ".72rem", color: "var(--sub)", marginTop: 2 }, children: [
                  colItems.length,
                  " active · ",
                  overdueN,
                  " overdue · ",
                  doneN,
                  " completed"
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { style: { padding: "0 10px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 460, overflowY: "auto" }, children: [
                colItems.map((e) => {
                  const wait = e.waitingOn;
                  const bg = wait === "client" ? "rgba(245,158,11,.10)" : wait === "consultant" ? "rgba(124,58,237,.10)" : "var(--card)";
                  const bd = isOverdue(e) ? "var(--danger)" : wait === "client" ? "rgba(245,158,11,.4)" : wait === "consultant" ? "rgba(124,58,237,.4)" : "var(--border)";
                  const clientSvcs = svcByClient[e.clientName] || [];
                  const st = stageOf(e.stage);
                  return /* @__PURE__ */ jsxs(
                    "div",
                    {
                      draggable: true,
                      onDragStart: (ev) => {
                        ev.dataTransfer.effectAllowed = "move";
                        ev.dataTransfer.setData("text/plain", e.id);
                        setDragId(e.id);
                      },
                      onDragEnd: () => {
                        setDragId(null);
                        setDragOver(null);
                      },
                      onClick: () => setEditId(e.id),
                      title: "Drag to another column · click to edit",
                      style: { background: bg, border: `1px solid ${bd}`, borderRadius: 10, padding: 12, cursor: "grab", opacity: dragId === e.id ? 0.5 : 1 },
                      children: [
                        /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }, children: [
                          /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: ".85rem", color: "var(--text)", lineHeight: 1.3, paddingRight: 4 }, children: e.title }),
                          /* @__PURE__ */ jsx("input", { type: "checkbox", title: "Mark complete", onClick: (ev) => ev.stopPropagation(), onChange: () => complete(e), style: { cursor: "pointer", marginTop: 2 } })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, margin: "5px 0" }, children: [
                          /* @__PURE__ */ jsx("span", { style: { fontSize: ".68rem", fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: st.bg, color: st.color }, children: st.label }),
                          /* @__PURE__ */ jsx("span", { style: { fontSize: ".74rem", color: "var(--sub)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: e.clientName })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { style: { fontSize: ".72rem", color: isOverdue(e) ? "var(--danger)" : "var(--sub)", marginBottom: 4 }, children: [
                          "Assigned ",
                          fmtDate(e.assignedDate),
                          " · ",
                          daysBetween(e.assignedDate),
                          "d"
                        ] }),
                        clientSvcs.length > 1 && /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }, children: [
                          /* @__PURE__ */ jsxs("span", { style: { fontSize: ".7rem", color: "var(--sub)" }, children: [
                            clientSvcs.length,
                            " svc"
                          ] }),
                          clientSvcs.map((s, i) => {
                            var _a;
                            return /* @__PURE__ */ jsx("span", { style: { width: 8, height: 8, borderRadius: "50%", background: ((_a = SVC[s]) == null ? void 0 : _a.color) || "#999", display: "inline-block" } }, i);
                          })
                        ] }),
                        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [
                          /* @__PURE__ */ jsx(
                            "input",
                            {
                              type: "date",
                              value: e.dueDate || "",
                              onClick: (ev) => ev.stopPropagation(),
                              onChange: (ev) => setDue(e, ev.target.value),
                              title: "Due date — click to edit",
                              style: {
                                fontSize: ".66rem",
                                border: "1px solid transparent",
                                borderRadius: 6,
                                cursor: "pointer",
                                padding: "1px 4px",
                                background: "var(--surface)",
                                color: isOverdue(e) ? "var(--danger)" : "var(--sub)",
                                flex: "0 0 auto",
                                width: 112,
                                minWidth: 0
                              }
                            }
                          ),
                          /* @__PURE__ */ jsxs(
                            "select",
                            {
                              value: wait || "",
                              onClick: (ev) => ev.stopPropagation(),
                              onChange: (ev) => setWaiting(e, ev.target.value),
                              style: {
                                fontSize: ".66rem",
                                fontWeight: 700,
                                border: "none",
                                borderRadius: 99,
                                cursor: "pointer",
                                padding: "2px 6px",
                                flex: "1 1 auto",
                                minWidth: 0,
                                background: wait === "client" ? "rgba(245,158,11,.18)" : wait === "consultant" ? "rgba(124,58,237,.18)" : "var(--surface)",
                                color: wait === "client" ? "#B45309" : wait === "consultant" ? "#6D28D9" : "var(--sub)"
                              },
                              children: [
                                /* @__PURE__ */ jsx("option", { value: "", children: "Set status" }),
                                /* @__PURE__ */ jsx("option", { value: "client", children: "Waiting on Client" }),
                                /* @__PURE__ */ jsx("option", { value: "consultant", children: "Waiting for Consultant" })
                              ]
                            }
                          ),
                          /* @__PURE__ */ jsx(
                            "button",
                            {
                              onClick: (ev) => {
                                ev.stopPropagation();
                                removeEng(e);
                              },
                              title: "Delete task",
                              style: { flex: "0 0 auto", background: "none", border: "none", color: "var(--sub)", cursor: "pointer", fontSize: ".8rem", padding: "2px 4px", lineHeight: 1 },
                              children: "✕"
                            }
                          )
                        ] })
                      ]
                    },
                    e.id
                  );
                }),
                colItems.length === 0 && /* @__PURE__ */ jsx("div", { style: { fontSize: ".75rem", color: "var(--sub)", textAlign: "center", padding: "14px 0" }, children: "No tasks" })
              ] }),
              /* @__PURE__ */ jsx("div", { style: { padding: 10 }, children: addCol === svc.key ? /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
                /* @__PURE__ */ jsx("input", { className: "form-input", style: { height: 32 }, autoFocus: true, placeholder: "Task title", value: addTitle, onChange: (e) => setAddTitle(e.target.value), onKeyDown: (e) => e.key === "Enter" && addTask(svc.key) }),
                /* @__PURE__ */ jsxs("select", { className: "form-input form-select", style: { height: 32 }, value: addClient, onChange: (e) => setAddClient(e.target.value), children: [
                  /* @__PURE__ */ jsx("option", { value: "", children: "— No client —" }),
                  customers.map((c) => /* @__PURE__ */ jsx("option", { value: c.id, children: c.name }, c.id))
                ] }),
                /* @__PURE__ */ jsx("input", { className: "form-input", style: { height: 32 }, type: "date", value: addDue, onChange: (e) => setAddDue(e.target.value), title: "Due date (optional)" }),
                /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 6 }, children: [
                  /* @__PURE__ */ jsx("button", { className: "btn btn-primary btn-sm", style: { flex: 1 }, onClick: () => addTask(svc.key), disabled: !addTitle.trim(), children: "Add" }),
                  /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => {
                    setAddCol(null);
                    setAddTitle("");
                    setAddClient("");
                    setAddDue("");
                  }, children: "Cancel" })
                ] })
              ] }) : /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", style: { width: "100%", color: "var(--sub)" }, onClick: () => {
                setAddCol(svc.key);
                setAddTitle("");
                setAddClient("");
                setAddDue("");
              }, children: "+ Add Task" }) })
            ]
          },
          svc.key
        );
      }) }) : view === "clients" ? /* @__PURE__ */ jsx(ClientRollup, { visible, onComplete: complete, onReopen: reopen, onSetWaiting: setWaiting }) : /* @__PURE__ */ jsx(CompletedTable, { completed, onReopen: reopen, onEdit: setEditId }),
      (view === "board" || view === "clients") && /* @__PURE__ */ jsxs("div", { className: "card", style: { marginTop: 24, padding: 20 }, children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }, children: [
          /* @__PURE__ */ jsx("div", { className: "fw-700", style: { fontSize: ".95rem" }, children: "Completed Work Analytics" }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 4, background: "var(--surface)", borderRadius: 8, padding: 3 }, children: [
            /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${analytics === "monthly" ? "btn-primary" : "btn-ghost"}`, onClick: () => {
              setAnalytics("monthly");
              setSelMonth(null);
            }, children: "Monthly" }),
            /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${analytics === "yearly" ? "btn-primary" : "btn-ghost"}`, onClick: () => {
              setAnalytics("yearly");
              setSelMonth(null);
            }, children: "Yearly" })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12 }, children: SERVICES.map((s) => /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: ".72rem", color: "var(--sub)" }, children: [
          /* @__PURE__ */ jsx("span", { style: { width: 9, height: 9, borderRadius: 2, background: s.color } }),
          " ",
          s.label
        ] }, s.key)) }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 24, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ jsx("div", { style: { flex: "1 1 280px", minWidth: 0, display: "flex", alignItems: "flex-end", gap: 8, height: 172, overflowX: "auto", overflowY: "hidden" }, children: buckets.map((b) => {
            const h = Math.round(b.rows.length / maxCount * 130);
            return /* @__PURE__ */ jsxs("div", { onClick: () => setSelMonth(b.key), style: { flex: "0 0 34px", width: 34, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }, children: [
              /* @__PURE__ */ jsx("div", { style: { fontSize: ".7rem", color: "var(--sub)", marginBottom: 4 }, children: b.rows.length || 0 }),
              /* @__PURE__ */ jsxs("div", { style: { width: "70%", height: Math.max(2, h), display: "flex", flexDirection: "column", justifyContent: "flex-end", borderRadius: 4, overflow: "hidden", outline: sel && sel.key === b.key ? "2px solid var(--accent)" : "none" }, children: [
                SERVICES.map((s) => {
                  const c = b.rows.filter((r) => r.service === s.key).length;
                  if (!c) return null;
                  return /* @__PURE__ */ jsx("div", { style: { background: s.color, height: `${c / (b.rows.length || 1) * 100}%` } }, s.key);
                }),
                b.rows.length === 0 && /* @__PURE__ */ jsx("div", { style: { background: "var(--border)", height: 2 } })
              ] }),
              /* @__PURE__ */ jsx("div", { style: { fontSize: ".6rem", color: "var(--sub)", marginTop: 6, transform: "rotate(-35deg)", whiteSpace: "nowrap", transformOrigin: "center" }, children: b.label })
            ] }, b.key);
          }) }),
          sel && /* @__PURE__ */ jsxs("div", { style: { flex: "1 1 300px", minWidth: 260 }, children: [
            /* @__PURE__ */ jsxs("div", { className: "fw-700", style: { fontSize: ".9rem", marginBottom: 10 }, children: [
              sel.label,
              " — ",
              sel.rows.length,
              " completed"
            ] }),
            /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }, children: SERVICES.map((s) => /* @__PURE__ */ jsxs("span", { style: { fontSize: ".7rem", fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: `${s.color}22`, color: s.color }, children: [
              s.label,
              " ",
              sel.rows.filter((r) => r.service === s.key).length
            ] }, s.key)) }),
            /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }, children: [...new Set(sel.rows.map((r) => r.clientName))].map((n) => /* @__PURE__ */ jsx("div", { style: { fontSize: ".8rem", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8 }, children: n }, n)) })
          ] })
        ] })
      ] })
    ] }),
    editTask && /* @__PURE__ */ jsx(
      TaskModal,
      {
        initial: editTask,
        customers,
        onSave: saveEdit,
        onClose: () => setEditId(null)
      }
    )
  ] });
}
function ClientRollup({ visible, onComplete, onReopen, onSetWaiting }) {
  const [sort, setSort] = useState("remaining");
  const clients = useMemo(() => {
    const m = {};
    visible.forEach((e) => {
      var _a;
      const c = m[_a = e.clientName] || (m[_a] = { name: e.clientName, all: [] });
      c.all.push(e);
    });
    const list = Object.values(m).map((c) => {
      const total = c.all.length;
      const done = c.all.filter((e) => e.status === "completed").length;
      const remaining = c.all.filter((e) => e.status === "active");
      const overdue = remaining.filter(isOverdue).length;
      const services = {};
      c.all.forEach((e) => {
        var _a;
        const s = services[_a = e.service] || (services[_a] = { key: e.service, total: 0, done: 0 });
        s.total++;
        if (e.status === "completed") s.done++;
      });
      return { ...c, total, done, remaining, overdue, pct: total ? Math.round(done / total * 100) : 0, services: Object.values(services) };
    });
    list.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "progress" ? b.pct - a.pct : b.remaining.length - a.remaining.length || a.name.localeCompare(b.name));
    return list;
  }, [visible, sort]);
  if (clients.length === 0) {
    return /* @__PURE__ */ jsx("div", { className: "card empty-state", style: { padding: 32 }, children: /* @__PURE__ */ jsx("div", { className: "empty-sub", children: "No clients yet — tag a task with a Customer and a Service." }) });
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 12 }, children: /* @__PURE__ */ jsxs("select", { className: "form-input", style: { width: "auto", height: 32, fontSize: ".8rem" }, value: sort, onChange: (e) => setSort(e.target.value), children: [
      /* @__PURE__ */ jsx("option", { value: "remaining", children: "Most remaining first" }),
      /* @__PURE__ */ jsx("option", { value: "progress", children: "Most complete first" }),
      /* @__PURE__ */ jsx("option", { value: "name", children: "Client name" })
    ] }) }),
    /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))", gap: 14 }, children: clients.map((c) => /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 16 }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: ".95rem" }, children: c.name }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: ".72rem", color: "var(--sub)" }, children: [
          c.remaining.length,
          " remaining",
          c.overdue ? ` · ${c.overdue} overdue` : "",
          " · ",
          c.done,
          "/",
          c.total,
          " done"
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { height: 8, borderRadius: 99, background: "var(--surface)", overflow: "hidden", margin: "10px 0" }, children: /* @__PURE__ */ jsx("div", { style: { width: `${c.pct}%`, height: "100%", background: c.pct === 100 ? "#16A34A" : "var(--accent, #6366F1)", transition: "width .3s" } }) }),
      /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }, children: c.services.map((s) => {
        var _a, _b, _c, _d;
        const rem = s.total - s.done;
        return /* @__PURE__ */ jsxs("span", { title: `${s.done}/${s.total} done`, style: { fontSize: ".7rem", fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: `${((_a = SVC[s.key]) == null ? void 0 : _a.color) || "#999"}18`, color: ((_b = SVC[s.key]) == null ? void 0 : _b.color) || "#666", display: "inline-flex", alignItems: "center", gap: 5 }, children: [
          /* @__PURE__ */ jsx("span", { style: { width: 7, height: 7, borderRadius: "50%", background: ((_c = SVC[s.key]) == null ? void 0 : _c.color) || "#999" } }),
          ((_d = SVC[s.key]) == null ? void 0 : _d.label) || s.key,
          /* @__PURE__ */ jsx("span", { style: { opacity: 0.8 }, children: rem ? `${rem} left` : "✓" })
        ] }, s.key);
      }) }),
      c.remaining.length > 0 ? /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { style: { fontSize: ".66rem", fontWeight: 700, letterSpacing: ".06em", color: "var(--sub)", marginBottom: 6 }, children: "REMAINING" }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: c.remaining.map((e) => {
          var _a;
          const st = stageOf(e.stage);
          return /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", border: `1px solid ${isOverdue(e) ? "var(--danger)" : "var(--border)"}`, borderRadius: 8 }, children: [
            /* @__PURE__ */ jsx("input", { type: "checkbox", title: "Mark complete", onChange: () => onComplete(e), style: { cursor: "pointer" } }),
            /* @__PURE__ */ jsx("span", { style: { width: 8, height: 8, borderRadius: "50%", background: ((_a = SVC[e.service]) == null ? void 0 : _a.color) || "#999", flexShrink: 0 } }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: ".8rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: e.title }),
            e.dueDate && /* @__PURE__ */ jsx("span", { style: { fontSize: ".66rem", color: isOverdue(e) ? "var(--danger)" : "var(--sub)" }, children: fmtDate(e.dueDate) }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: ".64rem", fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: st.bg, color: st.color }, children: st.label })
          ] }, e.id);
        }) })
      ] }) : /* @__PURE__ */ jsx("div", { style: { fontSize: ".78rem", color: "#16A34A", fontWeight: 600 }, children: "✓ All tasks complete" })
    ] }, c.name)) })
  ] });
}
function CompletedTable({ completed, onReopen, onEdit }) {
  const [sort, setSort] = useState("finished-desc");
  const [open, setOpen] = useState(null);
  const byClient = Object.values(completed.reduce((m, e) => {
    var _a;
    const c = m[_a = e.clientName] || (m[_a] = { clientName: e.clientName, tasks: [], services: /* @__PURE__ */ new Set(), created: e.createdAt, finished: 0 });
    c.tasks.push(e);
    c.services.add(e.service);
    c.created = Math.min(c.created, e.createdAt);
    c.finished = Math.max(c.finished, e.finishedAt || 0);
    return m;
  }, {}));
  byClient.forEach((c) => c.tasks.sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0)));
  byClient.sort((a, b) => sort === "finished-desc" ? b.finished - a.finished : sort === "finished-asc" ? a.finished - b.finished : a.clientName.localeCompare(b.clientName));
  return /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0, overflow: "hidden" }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", flexWrap: "wrap", gap: 8 }, children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "fw-700", children: "Completed Clients" }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: ".72rem", color: "var(--sub)", marginTop: 2 }, children: "Click a client to see task history and reopen (move back to board)." })
      ] }),
      /* @__PURE__ */ jsxs("select", { className: "form-input", style: { width: "auto", height: 32, fontSize: ".8rem" }, value: sort, onChange: (e) => setSort(e.target.value), children: [
        /* @__PURE__ */ jsx("option", { value: "finished-desc", children: "Date finished (newest first)" }),
        /* @__PURE__ */ jsx("option", { value: "finished-asc", children: "Date finished (oldest first)" }),
        /* @__PURE__ */ jsx("option", { value: "name", children: "Client name" })
      ] })
    ] }),
    byClient.length === 0 ? /* @__PURE__ */ jsx("div", { className: "empty-state", style: { padding: 32 }, children: /* @__PURE__ */ jsx("div", { className: "empty-sub", children: "No completed tasks yet." }) }) : /* @__PURE__ */ jsx("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxs("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: ".85rem" }, children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { style: { textAlign: "left", color: "var(--sub)", fontSize: ".7rem", letterSpacing: ".05em" }, children: [
        /* @__PURE__ */ jsx("th", { style: { padding: "10px 18px", width: 28 } }),
        /* @__PURE__ */ jsx("th", { style: { padding: "10px 18px" }, children: "CLIENT" }),
        /* @__PURE__ */ jsx("th", { style: { padding: "10px 18px" }, children: "SERVICES COMPLETED" }),
        /* @__PURE__ */ jsx("th", { style: { padding: "10px 18px" }, children: "CREATED" }),
        /* @__PURE__ */ jsx("th", { style: { padding: "10px 18px" }, children: "FINISHED" }),
        /* @__PURE__ */ jsx("th", { style: { padding: "10px 18px" }, children: "TASKS" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: byClient.map((r, i) => {
        const isOpen = open === r.clientName;
        return /* @__PURE__ */ jsxs(Fragment$1, { children: [
          /* @__PURE__ */ jsxs(
            "tr",
            {
              onClick: () => setOpen(isOpen ? null : r.clientName),
              style: { borderTop: "1px solid var(--border)", cursor: "pointer", background: isOpen ? "var(--surface)" : "transparent" },
              children: [
                /* @__PURE__ */ jsx("td", { style: { padding: "12px 18px", color: "var(--sub)" }, children: isOpen ? "▾" : "▸" }),
                /* @__PURE__ */ jsx("td", { style: { padding: "12px 18px", fontWeight: 600 }, children: r.clientName }),
                /* @__PURE__ */ jsx("td", { style: { padding: "12px 18px" }, children: /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" }, children: [...r.services].map((s) => {
                  var _a, _b, _c, _d;
                  return /* @__PURE__ */ jsxs("span", { style: { fontSize: ".72rem", fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: `${((_a = SVC[s]) == null ? void 0 : _a.color) || "#999"}22`, color: ((_b = SVC[s]) == null ? void 0 : _b.color) || "#666", display: "inline-flex", alignItems: "center", gap: 5 }, children: [
                    /* @__PURE__ */ jsx("span", { style: { width: 7, height: 7, borderRadius: "50%", background: ((_c = SVC[s]) == null ? void 0 : _c.color) || "#999" } }),
                    ((_d = SVC[s]) == null ? void 0 : _d.label) || s
                  ] }, s);
                }) }) }),
                /* @__PURE__ */ jsx("td", { style: { padding: "12px 18px", color: "var(--sub)" }, children: fmtDate(r.created) }),
                /* @__PURE__ */ jsx("td", { style: { padding: "12px 18px", color: "var(--sub)" }, children: fmtDate(r.finished) }),
                /* @__PURE__ */ jsxs("td", { style: { padding: "12px 18px", color: "var(--sub)" }, children: [
                  r.tasks.length,
                  " task",
                  r.tasks.length !== 1 ? "s" : ""
                ] })
              ]
            }
          ),
          isOpen && /* @__PURE__ */ jsx("tr", { style: { background: "var(--surface)" }, children: /* @__PURE__ */ jsx("td", { colSpan: 6, style: { padding: "4px 18px 14px 46px" }, children: /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: r.tasks.map((e) => {
            var _a, _b;
            return /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)" }, children: [
              /* @__PURE__ */ jsx("span", { style: { width: 8, height: 8, borderRadius: "50%", background: ((_a = SVC[e.service]) == null ? void 0 : _a.color) || "#999", flexShrink: 0 } }),
              /* @__PURE__ */ jsx("span", { style: { fontSize: ".82rem", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: e.title }),
              /* @__PURE__ */ jsx("span", { style: { fontSize: ".72rem", color: "var(--sub)" }, children: ((_b = SVC[e.service]) == null ? void 0 : _b.label) || e.service }),
              /* @__PURE__ */ jsxs("span", { style: { fontSize: ".72rem", color: "var(--sub)" }, children: [
                "Finished ",
                fmtDate(e.finishedAt)
              ] }),
              onEdit && /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => onEdit(e.id), children: "Edit" }),
              /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: () => onReopen(e), title: "Move back onto the board", children: "↩ Reopen" })
            ] }, e.id);
          }) }) }) })
        ] }, r.clientName);
      }) })
    ] }) })
  ] });
}
export {
  Pipeline as default
};
