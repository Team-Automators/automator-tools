import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { g as getLocationId, a as api } from "../entry-server.mjs";
import { n as notifySuccess, c as confirmToast } from "./toast-DrUOosTv.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-toastify";
function fmtDate(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString(void 0, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}
function Archive() {
  const navigate = useNavigate();
  const locationId = getLocationId();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(() => /* @__PURE__ */ new Set());
  async function load() {
    setLoading(true);
    const list = await api.getArchivedCopies();
    setItems(Array.isArray(list) ? list : []);
    setSelected(/* @__PURE__ */ new Set());
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  const allSelected = items.length > 0 && selected.size === items.length;
  function toggle(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? /* @__PURE__ */ new Set() : new Set(items.map((i) => i.id)));
  }
  async function bulkRestore() {
    const ids = [...selected];
    if (!ids.length) return;
    setItems((prev) => prev.filter((i) => !selected.has(i.id)));
    setSelected(/* @__PURE__ */ new Set());
    await Promise.all(ids.map((id) => api.setCopyStatus(id, "in-progress").catch(() => {
    })));
    notifySuccess(`Restored ${ids.length} conversation${ids.length !== 1 ? "s" : ""}`);
  }
  async function bulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;
    if (!await confirmToast(`Permanently delete ${ids.length} conversation${ids.length !== 1 ? "s" : ""}? This cannot be undone.`, { confirmText: "Delete" })) return;
    setItems((prev) => prev.filter((i) => !selected.has(i.id)));
    setSelected(/* @__PURE__ */ new Set());
    await Promise.all(ids.map((id) => api.purgeCopy(id).catch(() => {
    })));
    notifySuccess(`Deleted ${ids.length} conversation${ids.length !== 1 ? "s" : ""}`);
  }
  function openCopy(item) {
    const cust = item.customerId || "_unsorted";
    const u = new URL(`/library/${cust}/${item.id}`, window.location.origin);
    if (locationId) u.searchParams.set("locationId", locationId);
    navigate(u.pathname + u.search);
  }
  async function restore(e, id) {
    e.stopPropagation();
    setBusyId(id);
    await api.setCopyStatus(id, "in-progress").catch(() => {
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
    setBusyId(null);
    notifySuccess("Restored to In Progress");
  }
  async function purge(e, id) {
    e.stopPropagation();
    if (!await confirmToast("Permanently delete this conversation? This cannot be undone.", { confirmText: "Delete" })) return;
    setBusyId(id);
    await api.purgeCopy(id).catch(() => {
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
    setBusyId(null);
    notifySuccess("Deleted permanently");
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "topnav", children: /* @__PURE__ */ jsxs("div", { className: "topnav-left", children: [
      /* @__PURE__ */ jsx("span", { className: "breadcrumb", children: "Library" }),
      /* @__PURE__ */ jsx("span", { className: "breadcrumb-sep", children: "/" }),
      /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Archive" })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "content", children: [
      /* @__PURE__ */ jsx("div", { className: "page-header", children: /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "page-title", children: "Archive" }),
        /* @__PURE__ */ jsx("div", { className: "page-sub", children: "Your archived conversations — restore or permanently delete" })
      ] }) }),
      loading ? /* @__PURE__ */ jsx("div", { style: { padding: 32, display: "flex", justifyContent: "center" }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) }) : items.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "empty-icon", children: "🗄️" }),
        /* @__PURE__ */ jsx("div", { className: "empty-title", children: "Archive is empty" }),
        /* @__PURE__ */ jsx("div", { className: "empty-sub", children: "Deleted conversations land here so you can restore them." })
      ] }) : /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12, padding: "4px 4px 8px" }, children: [
          /* @__PURE__ */ jsxs("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: ".8rem", color: "var(--sub)", cursor: "pointer" }, children: [
            /* @__PURE__ */ jsx("input", { type: "checkbox", checked: allSelected, onChange: toggleAll }),
            selected.size > 0 ? `${selected.size} selected` : "Select all"
          ] }),
          selected.size > 0 && /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, marginLeft: "auto" }, children: [
            /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: bulkRestore, children: "Restore selected" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", style: { color: "var(--danger)" }, onClick: bulkDelete, children: "Delete selected" })
          ] })
        ] }),
        items.map((item) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: "card",
            style: { padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer", borderColor: selected.has(item.id) ? "var(--accent)" : void 0 },
            onClick: () => openCopy(item),
            children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "checkbox",
                  checked: selected.has(item.id),
                  onClick: (e) => e.stopPropagation(),
                  onChange: () => toggle(item.id),
                  style: { flexShrink: 0 }
                }
              ),
              /* @__PURE__ */ jsxs("div", { style: { minWidth: 0, flex: 1 }, children: [
                /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: ".9375rem", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: item.title || "Untitled conversation" }),
                /* @__PURE__ */ jsxs("div", { style: { fontSize: ".78rem", color: "var(--sub)", marginTop: 3 }, children: [
                  item.customerName || "Unsorted",
                  " · ",
                  item.type || "copy",
                  " · archived ",
                  fmtDate(item.updatedAt)
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, flexShrink: 0 }, children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    className: "btn btn-secondary btn-sm",
                    disabled: busyId === item.id,
                    onClick: (e) => restore(e, item.id),
                    title: "Restore to In Progress",
                    children: "Restore"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    className: "btn btn-ghost btn-sm",
                    style: { color: "var(--danger)" },
                    disabled: busyId === item.id,
                    onClick: (e) => purge(e, item.id),
                    title: "Delete permanently",
                    children: "Delete"
                  }
                )
              ] })
            ]
          },
          item.id
        ))
      ] })
    ] })
  ] });
}
export {
  Archive as default
};
