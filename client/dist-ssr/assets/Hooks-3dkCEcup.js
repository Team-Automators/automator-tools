import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { a as api } from "../entry-server.mjs";
import "node:async_hooks";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
import "react-toastify";
const APP_FIELDS = [
  { key: "task_title", label: "Task Title", required: true },
  { key: "task_stage", label: "Stage", required: false },
  { key: "customer_name", label: "Customer Name", required: false },
  { key: "task_note", label: "Note", required: false }
];
const STAGES = ["urgent", "in-progress", "blocked", "for-later", "done"];
function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj || {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}
function getPath(obj, dotPath) {
  return dotPath.split(".").reduce((cur, k) => cur == null ? void 0 : cur[k], obj);
}
function inboundUrl(hook) {
  if (!hook.incomingToken) return null;
  return `${window.location.origin}/api/incoming/${hook.incomingToken}`;
}
function relTime(ts) {
  if (!ts) return null;
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 6e4);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function FieldMapper({ hook, onMappingSaved }) {
  var _a;
  const payload = (_a = hook.lastIncoming) == null ? void 0 : _a.payload;
  const sourceKeys = payload ? flattenKeys(payload) : [];
  const [map, setMap] = useState(hook.fieldMap || {});
  const [autoCreate, setAutoCreate] = useState(hook.autoCreate || false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  async function handleSave() {
    setSaving(true);
    const updated = await api.saveHookMapping(hook.id, { fieldMap: map, autoCreate }).catch(() => null);
    setSaving(false);
    if (updated) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onMappingSaved(updated);
    }
  }
  if (!payload) {
    return /* @__PURE__ */ jsxs("div", { className: "hook-mapper-empty", children: [
      /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", width: "28", height: "28", style: { color: "var(--border)" }, children: /* @__PURE__ */ jsx("path", { d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" }) }),
      /* @__PURE__ */ jsx("div", { style: { fontSize: ".8125rem", color: "var(--sub)", marginTop: 6 }, children: "Send a test payload to this URL first — the fields will appear here for mapping." })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "hook-mapper", children: [
    /* @__PURE__ */ jsx("div", { className: "hook-mapper-title", children: "Map incoming fields to task fields" }),
    /* @__PURE__ */ jsxs("div", { className: "hook-mapper-payload", children: [
      /* @__PURE__ */ jsx("div", { className: "hook-mapper-payload-label", children: "Last received payload" }),
      /* @__PURE__ */ jsx("pre", { className: "hook-mapper-payload-pre", children: JSON.stringify(payload, null, 2) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "hook-mapper-table", children: [
      /* @__PURE__ */ jsxs("div", { className: "hook-mapper-row hook-mapper-header", children: [
        /* @__PURE__ */ jsx("span", { children: "App field" }),
        /* @__PURE__ */ jsx("span", { children: "Payload field" }),
        /* @__PURE__ */ jsx("span", { children: "Preview value" })
      ] }),
      APP_FIELDS.map((field) => {
        const selected = map[field.key] || "";
        const preview = selected ? getPath(payload, selected) : null;
        return /* @__PURE__ */ jsxs("div", { className: "hook-mapper-row", children: [
          /* @__PURE__ */ jsxs("span", { className: "hook-mapper-app-field", children: [
            field.label,
            field.required && /* @__PURE__ */ jsx("span", { style: { color: "var(--danger)", marginLeft: 3 }, children: "*" })
          ] }),
          /* @__PURE__ */ jsxs(
            "select",
            {
              className: "form-input form-select hook-mapper-select",
              value: selected,
              onChange: (e) => setMap((prev) => ({ ...prev, [field.key]: e.target.value })),
              children: [
                /* @__PURE__ */ jsx("option", { value: "", children: "— skip —" }),
                sourceKeys.map((k) => /* @__PURE__ */ jsx("option", { value: k, children: k }, k))
              ]
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "hook-mapper-preview", children: preview !== null && preview !== void 0 ? String(preview) : /* @__PURE__ */ jsx("em", { style: { color: "var(--border)" }, children: "—" }) })
        ] }, field.key);
      })
    ] }),
    map.task_stage && /* @__PURE__ */ jsxs("div", { style: { fontSize: ".72rem", color: "var(--sub)", marginBottom: 8 }, children: [
      "Stage field: value must be one of ",
      /* @__PURE__ */ jsx("code", { children: STAGES.join(", ") }),
      ". Unrecognised values default to ",
      /* @__PURE__ */ jsx("code", { children: "urgent" }),
      "."
    ] }),
    /* @__PURE__ */ jsxs("label", { className: "hook-mapper-toggle", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "checkbox",
          checked: autoCreate,
          onChange: (e) => setAutoCreate(e.target.checked)
        }
      ),
      /* @__PURE__ */ jsxs("span", { className: "hook-mapper-toggle-label", children: [
        "Auto-create task when payload is received",
        /* @__PURE__ */ jsx("span", { style: { color: "var(--sub)", fontWeight: 400, fontSize: ".75rem", display: "block" }, children: "Requires Task Title to be mapped" })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "btn btn-primary btn-sm",
        style: { alignSelf: "flex-start", marginTop: 4 },
        onClick: handleSave,
        disabled: saving,
        children: saving ? "Saving…" : saved ? "✓ Saved" : "Save mapping"
      }
    )
  ] });
}
function HookCard({ hook: initialHook, onEdit, onDelete, onToggle }) {
  const [hook, setHook] = useState(initialHook);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showMapper, setShowMapper] = useState(false);
  const [showRawOut, setShowRawOut] = useState(false);
  const url = inboundUrl(hook);
  const inCount = hook.incomingCount || 0;
  const lastIn = hook.lastIncoming;
  async function handleTest() {
    setTesting(true);
    setTestMsg(null);
    const res = await api.testHook(hook.id).catch((e) => ({ error: e.message }));
    setTesting(false);
    setTestMsg(res.error ? `Failed: ${res.error}` : "Test sent ✓");
    setTimeout(() => setTestMsg(null), 4e3);
  }
  function copyUrl() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2e3);
    });
  }
  return /* @__PURE__ */ jsxs("div", { className: `hook-card ${!hook.active ? "inactive" : ""}`, children: [
    /* @__PURE__ */ jsxs("div", { className: "hook-card-header", children: [
      /* @__PURE__ */ jsxs("div", { className: "hook-card-title-row", children: [
        /* @__PURE__ */ jsx("div", { className: "hook-card-name", children: hook.name }),
        /* @__PURE__ */ jsxs("div", { className: "hook-card-badges", children: [
          /* @__PURE__ */ jsx("span", { className: `hook-status ${hook.active ? "active" : "paused"}`, children: hook.active ? "Active" : "Paused" }),
          hook.autoCreate && /* @__PURE__ */ jsx("span", { className: "hook-in-count", style: { background: "rgba(139,92,246,.12)", color: "#8B5CF6" }, title: "Auto-create task enabled", children: "⚡ auto" }),
          inCount > 0 && /* @__PURE__ */ jsxs("span", { className: "hook-in-count", title: `${inCount} payload${inCount !== 1 ? "s" : ""} received`, children: [
            "↓ ",
            inCount
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "hook-card-actions", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => onToggle(hook), children: hook.active ? "Pause" : "Resume" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => onEdit(hook), children: "Edit" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm danger", onClick: () => onDelete(hook.id), children: "Delete" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "hook-card-body", children: [
      url && /* @__PURE__ */ jsxs("div", { className: "hook-inbound-section", children: [
        /* @__PURE__ */ jsxs("div", { className: "hook-inbound-label", children: [
          /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "13", height: "13", children: [
            /* @__PURE__ */ jsx("polyline", { points: "16 16 12 12 8 16" }),
            /* @__PURE__ */ jsx("line", { x1: "12", y1: "12", x2: "12", y2: "21" }),
            /* @__PURE__ */ jsx("path", { d: "M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" })
          ] }),
          "Inbound Webhook URL",
          /* @__PURE__ */ jsx("span", { className: "hook-inbound-pill", children: "POST · No auth" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "hook-inbound-url-row", children: [
          /* @__PURE__ */ jsx("code", { className: "hook-inbound-url", children: url }),
          /* @__PURE__ */ jsxs("button", { className: "btn btn-ghost btn-sm", style: { flexShrink: 0 }, onClick: copyUrl, children: [
            copiedUrl ? /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", width: "13", height: "13", children: /* @__PURE__ */ jsx("polyline", { points: "20 6 9 17 4 12" }) }) : /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "13", height: "13", children: [
              /* @__PURE__ */ jsx("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2" }),
              /* @__PURE__ */ jsx("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
            ] }),
            copiedUrl ? "Copied!" : "Copy"
          ] })
        ] }),
        lastIn && /* @__PURE__ */ jsxs("div", { className: "hook-inbound-last", children: [
          "Last received ",
          relTime(lastIn.receivedAt),
          /* @__PURE__ */ jsx(
            "button",
            {
              className: "btn btn-ghost btn-sm",
              style: { fontSize: ".7rem", padding: "2px 8px", minHeight: "unset" },
              onClick: () => setShowMapper((v) => !v),
              children: showMapper ? "Hide field mapping" : hook.fieldMap ? "Edit field mapping" : "Map fields →"
            }
          )
        ] }),
        !lastIn && /* @__PURE__ */ jsxs("div", { style: { fontSize: ".75rem", color: "var(--sub)" }, children: [
          "Waiting for first payload…",
          /* @__PURE__ */ jsx(
            "button",
            {
              className: "btn btn-ghost btn-sm",
              style: { fontSize: ".7rem", padding: "2px 8px", minHeight: "unset", marginLeft: 8 },
              onClick: () => setShowMapper((v) => !v),
              children: showMapper ? "Hide" : "Preview mapping"
            }
          )
        ] }),
        showMapper && /* @__PURE__ */ jsx(
          FieldMapper,
          {
            hook,
            onMappingSaved: (updated) => setHook((prev) => ({ ...prev, ...updated }))
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "hook-field", children: [
        /* @__PURE__ */ jsx("span", { className: "hook-field-label", children: "Customer" }),
        /* @__PURE__ */ jsx("span", { className: "hook-field-value", children: hook.customerName ? /* @__PURE__ */ jsx("span", { className: "hook-customer-chip", children: hook.customerName }) : /* @__PURE__ */ jsx("em", { style: { color: "var(--sub)" }, children: "All customers" }) })
      ] }),
      hook.destinationUrl && /* @__PURE__ */ jsxs("div", { className: "hook-field", children: [
        /* @__PURE__ */ jsx("span", { className: "hook-field-label", children: "Outbound URL" }),
        /* @__PURE__ */ jsx("span", { className: "hook-field-value url", children: hook.destinationUrl })
      ] }),
      hook.destinationUrl && /* @__PURE__ */ jsxs("div", { className: "hook-field", children: [
        /* @__PURE__ */ jsx("span", { className: "hook-field-label", children: "Last triggered" }),
        /* @__PURE__ */ jsx("span", { className: "hook-field-value", children: hook.lastTriggered ? new Date(hook.lastTriggered).toLocaleString() : "Never" })
      ] })
    ] }),
    hook.destinationUrl && /* @__PURE__ */ jsxs("div", { className: "hook-card-footer", children: [
      /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: handleTest, disabled: testing, children: testing ? "Sending…" : "Test outbound" }),
      /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => setShowRawOut((v) => !v), children: showRawOut ? "Hide payload" : "View outbound payload" }),
      testMsg && /* @__PURE__ */ jsx("span", { className: `hook-test-msg ${testMsg.startsWith("Failed") ? "error" : "ok"}`, children: testMsg })
    ] }),
    showRawOut && /* @__PURE__ */ jsxs("div", { className: "hook-payload-wrap", children: [
      /* @__PURE__ */ jsx("div", { className: "hook-payload-toolbar", children: /* @__PURE__ */ jsx("span", { className: "hook-payload-label", children: "Outbound JSON payload (sample)" }) }),
      /* @__PURE__ */ jsx("pre", { className: "hook-payload-json", children: JSON.stringify({
        event: "kanban_update",
        hook_id: hook.id,
        customer: { id: hook.customerId, name: hook.customerName },
        task: { title: "Example task", stage: "in-progress", updated_at: (/* @__PURE__ */ new Date()).toISOString() },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, null, 2) })
    ] })
  ] });
}
function HookModal({ initial, customers, onSave, onClose }) {
  const [name, setName] = useState((initial == null ? void 0 : initial.name) || "");
  const [destinationUrl, setDestUrl] = useState((initial == null ? void 0 : initial.destinationUrl) || "");
  const [customerId, setCustomerId] = useState((initial == null ? void 0 : initial.customerId) || "");
  const [customerName, setCustName] = useState((initial == null ? void 0 : initial.customerName) || "");
  const [saving, setSaving] = useState(false);
  const [createdHook, setCreatedHook] = useState(null);
  const [copied, setCopied] = useState(false);
  const isEdit = !!(initial == null ? void 0 : initial.id);
  function handleCustomerChange(e) {
    var _a;
    const id = e.target.value;
    setCustomerId(id);
    setCustName(((_a = customers.find((c) => c.id === id)) == null ? void 0 : _a.name) || "");
  }
  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const result = await onSave({
      name: name.trim() || "Unnamed Hook",
      destinationUrl: destinationUrl.trim(),
      customerId,
      customerName
    });
    setSaving(false);
    if (result && !isEdit) setCreatedHook(result);
  }
  function copyUrl() {
    const url = inboundUrl(createdHook);
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }
  if (createdHook) {
    const url = inboundUrl(createdHook);
    return /* @__PURE__ */ jsx("div", { className: "modal-backdrop", onClick: onClose, children: /* @__PURE__ */ jsxs("div", { className: "modal", style: { maxWidth: 500 }, onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingBottom: 8 }, children: [
        /* @__PURE__ */ jsx("div", { style: { width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,.12)", color: "#22C55E", display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", width: "24", height: "24", children: /* @__PURE__ */ jsx("polyline", { points: "20 6 9 17 4 12" }) }) }),
        /* @__PURE__ */ jsx("div", { className: "modal-title", style: { marginBottom: 0 }, children: "Hook created!" }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: ".8125rem", color: "var(--sub)", textAlign: "center" }, children: "Paste this URL into Zapier, Make, or any platform. When they POST to it, the data arrives here — no authentication needed." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "hook-inbound-section", style: { marginTop: 8 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "hook-inbound-label", children: [
          /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "13", height: "13", children: [
            /* @__PURE__ */ jsx("polyline", { points: "16 16 12 12 8 16" }),
            /* @__PURE__ */ jsx("line", { x1: "12", y1: "12", x2: "12", y2: "21" }),
            /* @__PURE__ */ jsx("path", { d: "M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" })
          ] }),
          "Your Inbound Webhook URL",
          /* @__PURE__ */ jsx("span", { className: "hook-inbound-pill", children: "POST · No auth" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "hook-inbound-url-row", children: /* @__PURE__ */ jsx("code", { className: "hook-inbound-url", children: url }) }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary", style: { width: "100%", justifyContent: "center", gap: 8 }, onClick: copyUrl, children: copied ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", width: "15", height: "15", children: /* @__PURE__ */ jsx("polyline", { points: "20 6 9 17 4 12" }) }),
          "Copied!"
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "15", height: "15", children: [
            /* @__PURE__ */ jsx("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2" }),
            /* @__PURE__ */ jsx("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
          ] }),
          "Copy URL"
        ] }) }),
        /* @__PURE__ */ jsxs("div", { style: { fontSize: ".72rem", color: "var(--sub)", textAlign: "center" }, children: [
          "Once you send a test payload from Zapier, come back to this hook and click ",
          /* @__PURE__ */ jsx("strong", { children: "Map fields" }),
          " to connect incoming data to tasks."
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "modal-actions", style: { marginTop: 12 }, children: /* @__PURE__ */ jsx("button", { className: "btn btn-secondary flex-1", onClick: onClose, children: "Done" }) })
    ] }) });
  }
  return /* @__PURE__ */ jsx("div", { className: "modal-backdrop", onClick: onClose, children: /* @__PURE__ */ jsxs("div", { className: "modal", style: { maxWidth: 500 }, onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsx("div", { className: "modal-title", children: isEdit ? "Edit Hook" : "New Hook" }),
    /* @__PURE__ */ jsxs("form", { onSubmit: handleSave, children: [
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsx("label", { className: "form-label", children: "Hook name" }),
        /* @__PURE__ */ jsx("input", { className: "form-input", value: name, onChange: (e) => setName(e.target.value), placeholder: "e.g. Zapier lead intake", autoFocus: true })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsxs("label", { className: "form-label", children: [
          "Outbound URL",
          /* @__PURE__ */ jsx("span", { style: { fontWeight: 400, color: "var(--sub)", marginLeft: 4 }, children: "(optional)" })
        ] }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-input",
            type: "text",
            value: destinationUrl,
            onChange: (e) => setDestUrl(e.target.value),
            placeholder: "https://hooks.zapier.com/hooks/catch/…",
            autoComplete: "off",
            spellCheck: false
          }
        ),
        /* @__PURE__ */ jsx("div", { className: "text-xs text-sub mt-1", children: "We'll POST JSON here on every Kanban task update." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
        /* @__PURE__ */ jsxs("label", { className: "form-label", children: [
          "Assign to customer",
          /* @__PURE__ */ jsx("span", { style: { fontWeight: 400, color: "var(--sub)", marginLeft: 4 }, children: "(optional)" })
        ] }),
        /* @__PURE__ */ jsxs("select", { className: "form-input form-select", value: customerId, onChange: handleCustomerChange, children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "— All customers —" }),
          customers.map((c) => /* @__PURE__ */ jsx("option", { value: c.id, children: c.name }, c.id))
        ] })
      ] }),
      isEdit && /* @__PURE__ */ jsx("div", { className: "hook-edit-note", children: "The inbound URL is permanent — delete and recreate the hook to rotate it." }),
      /* @__PURE__ */ jsxs("div", { className: "modal-actions", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary flex-1", type: "submit", disabled: saving, children: saving ? "Creating…" : isEdit ? "Save changes" : "Create hook & get URL" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", type: "button", onClick: onClose, children: "Cancel" })
      ] })
    ] })
  ] }) });
}
function Hooks() {
  const [hooks, setHooks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  useEffect(() => {
    Promise.all([api.getHooks(), api.getCustomers()]).then(([h, c]) => {
      setHooks(Array.isArray(h) ? h : []);
      setCustomers(Array.isArray(c) ? c : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  async function handleSave(fields) {
    if (modal.hook) {
      const updated = await api.updateHook(modal.hook.id, fields);
      setHooks((prev) => prev.map((h) => h.id === modal.hook.id ? updated : h));
      setModal(null);
      return null;
    } else {
      const created = await api.createHook(fields);
      setHooks((prev) => [...prev, created]);
      return created;
    }
  }
  async function handleDelete(id) {
    setHooks((prev) => prev.filter((h) => h.id !== id));
    await api.deleteHook(id).catch(() => {
    });
  }
  async function handleToggle(hook) {
    const updated = await api.updateHook(hook.id, { active: !hook.active });
    setHooks((prev) => prev.map((h) => h.id === hook.id ? updated : h));
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "topnav", children: [
      /* @__PURE__ */ jsx("div", { className: "topnav-left", children: /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Hooks" }) }),
      /* @__PURE__ */ jsx("div", { className: "topnav-right", children: /* @__PURE__ */ jsx("button", { className: "btn btn-primary btn-sm", onClick: () => setModal({}), children: "+ New Hook" }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "page-body", children: [
      /* @__PURE__ */ jsxs("div", { className: "hook-info-banner", children: [
        /* @__PURE__ */ jsx("div", { className: "hook-info-icon", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "20", height: "20", children: [
          /* @__PURE__ */ jsx("polyline", { points: "16 16 12 12 8 16" }),
          /* @__PURE__ */ jsx("line", { x1: "12", y1: "12", x2: "12", y2: "21" }),
          /* @__PURE__ */ jsx("path", { d: "M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "hook-info-title", children: "Inbound Webhooks" }),
          /* @__PURE__ */ jsx("div", { className: "hook-info-body", children: "Each hook has a unique URL. Paste it into Zapier, Make, or any platform — they POST data, you map the fields, tasks get created automatically." })
        ] })
      ] }),
      loading ? /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", padding: 40 }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) }) : hooks.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", width: "40", height: "40", style: { color: "var(--border)" }, children: [
          /* @__PURE__ */ jsx("polyline", { points: "16 16 12 12 8 16" }),
          /* @__PURE__ */ jsx("line", { x1: "12", y1: "12", x2: "12", y2: "21" }),
          /* @__PURE__ */ jsx("path", { d: "M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "empty-title", children: "No hooks yet" }),
        /* @__PURE__ */ jsx("div", { className: "empty-sub", children: "Create a hook to get your unique webhook URL for Zapier or any platform." }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary", style: { marginTop: 8 }, onClick: () => setModal({}), children: "+ New Hook" })
      ] }) : /* @__PURE__ */ jsx("div", { className: "hooks-list", children: hooks.map((hook) => /* @__PURE__ */ jsx(
        HookCard,
        {
          hook,
          onEdit: (h) => setModal({ hook: h }),
          onDelete: handleDelete,
          onToggle: handleToggle
        },
        hook.id
      )) })
    ] }),
    modal !== null && /* @__PURE__ */ jsx(HookModal, { initial: modal.hook || null, customers, onSave: handleSave, onClose: () => setModal(null) })
  ] });
}
export {
  Hooks as default
};
