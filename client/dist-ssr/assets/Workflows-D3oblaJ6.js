import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { g as getLocationId, b as apiFetch } from "../entry-server.mjs";
import "node:async_hooks";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-toastify";
const TRIGGER_TYPES = [
  { value: "opportunity_status_changed", label: "Opportunity Status Changed" },
  { value: "contact_tag_added", label: "Contact Tag Added" },
  { value: "form_submitted", label: "Form Submitted" },
  { value: "appointment_booked", label: "Appointment Booked" },
  { value: "contact_created", label: "Contact Created" },
  { value: "invoice_sent", label: "Invoice Sent" },
  { value: "payment_received", label: "Payment Received" },
  { value: "inbound_webhook", label: "Inbound Webhook" }
];
function LibraryAnalyzer({ onFill, onClose }) {
  const locationId = getLocationId();
  const [copies, setCopies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`/api/copies?locationId=${locationId}`).then((r) => r.json()).then((d) => {
      setCopies(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [locationId]);
  async function pick(item) {
    setAnalyzing(true);
    setErr("");
    let messages = [], title = item.title;
    try {
      const r = await fetch(`/api/copies/${item.id}`);
      const copy = await r.json();
      messages = copy.messages || [];
      title = copy.title || title;
    } catch {
    }
    let aiConfig = {};
    try {
      aiConfig = JSON.parse(localStorage.getItem("ghl_ai_config") || "{}");
    } catch {
    }
    try {
      const r = await fetch("/api/workflows/analyze-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, title, provider: aiConfig.provider, apiKey: aiConfig.apiKey, model: aiConfig.model })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Analysis failed");
      onFill(d.brief);
    } catch (e) {
      setErr(e.message);
      setAnalyzing(false);
    }
  }
  const filtered = copies.filter(
    (c) => {
      var _a, _b;
      return !search || ((_a = c.title) == null ? void 0 : _a.toLowerCase().includes(search.toLowerCase())) || ((_b = c.preview) == null ? void 0 : _b.toLowerCase().includes(search.toLowerCase()));
    }
  );
  return /* @__PURE__ */ jsx("div", { className: "modal-backdrop", onClick: analyzing ? void 0 : onClose, children: /* @__PURE__ */ jsx("div", { className: "modal wf-lib-modal", onClick: (e) => e.stopPropagation(), children: analyzing ? /* @__PURE__ */ jsxs("div", { className: "wf-lib-summarizing", children: [
    /* @__PURE__ */ jsx("div", { className: "spinner", style: { width: 36, height: 36 } }),
    /* @__PURE__ */ jsx("p", { className: "wf-lib-summ-label", children: "Analyzing conversation…" }),
    /* @__PURE__ */ jsx("p", { className: "wf-lib-summ-sub", children: "Extracting campaign goal, audience, and CTA" })
  ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "wf-modal-head", children: [
      /* @__PURE__ */ jsx("div", { className: "modal-title", children: "Import from Library" }),
      /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: onClose, children: "✕" })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "wf-lib-hint", children: "Select a copy — AI will read the full conversation and extract the campaign brief to auto-fill the goal field." }),
    /* @__PURE__ */ jsx(
      "input",
      {
        className: "input wf-field",
        style: { marginBottom: 12 },
        placeholder: "Search copies…",
        value: search,
        onChange: (e) => setSearch(e.target.value),
        autoFocus: true
      }
    ),
    err && /* @__PURE__ */ jsx("p", { className: "wf-paste-err", style: { marginBottom: 8 }, children: err }),
    loading && /* @__PURE__ */ jsx("div", { style: { textAlign: "center", padding: 24 }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) }),
    !loading && filtered.length === 0 && /* @__PURE__ */ jsx("p", { className: "wf-lib-empty", children: "No copies yet. Create some in Copywriters first." }),
    /* @__PURE__ */ jsx("div", { className: "wf-lib-list", children: filtered.map((c) => /* @__PURE__ */ jsxs("button", { className: "wf-lib-item", onClick: () => pick(c), children: [
      /* @__PURE__ */ jsxs("div", { className: "wf-lib-item-top", children: [
        /* @__PURE__ */ jsx("span", { className: "wf-lib-item-title", children: c.title || "Untitled" }),
        /* @__PURE__ */ jsx("span", { className: "wf-badge wf-badge--draft", children: c.type })
      ] }),
      c.preview && /* @__PURE__ */ jsxs("div", { className: "wf-lib-item-preview", children: [
        c.preview.slice(0, 100),
        c.preview.length > 100 ? "…" : ""
      ] })
    ] }, c.id)) })
  ] }) }) });
}
function WorkflowBuilder({ onCancel, onCreate, initialDraft = null, onReconnect }) {
  var _a;
  const locationId = getLocationId();
  const [draftId, setDraftId] = useState((initialDraft == null ? void 0 : initialDraft.id) || null);
  const [name, setName] = useState((initialDraft == null ? void 0 : initialDraft.name) || "");
  const [brief, setBrief] = useState((initialDraft == null ? void 0 : initialDraft.brief) || "");
  const [emailCount, setEmailCount] = useState((initialDraft == null ? void 0 : initialDraft.emailCount) ?? 3);
  const [smsCount, setSmsCount] = useState((initialDraft == null ? void 0 : initialDraft.smsCount) ?? 1);
  const [steps, setSteps] = useState((initialDraft == null ? void 0 : initialDraft.steps) || []);
  const [phase, setPhase] = useState(((_a = initialDraft == null ? void 0 : initialDraft.steps) == null ? void 0 : _a.length) ? "preview" : "form");
  const [err, setErr] = useState("");
  const [authErr, setAuthErr] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  useEffect(() => {
    if (initialDraft) return;
    try {
      const raw = sessionStorage.getItem("automator_wf_draft");
      if (!raw) return;
      const d = JSON.parse(raw);
      if (Date.now() - d.timestamp > 10 * 60 * 1e3) {
        sessionStorage.removeItem("automator_wf_draft");
        return;
      }
      setBrief(d.content || "");
      const emailTypes = ["email", "webinar", "sales-page", "blog"];
      if (!emailTypes.includes(d.copywriterType)) {
        setEmailCount(2);
        setSmsCount(2);
      }
      if (d.copywriterType) setName(`${d.copywriterType} sequence`);
      sessionStorage.removeItem("automator_wf_draft");
    } catch {
    }
  }, [initialDraft]);
  const eCount = Math.max(0, Number(emailCount) || 0);
  const sCount = Math.max(0, Number(smsCount) || 0);
  const tCount = eCount + sCount;
  function updateStep(i, key, val) {
    setSteps((s) => s.map((step, j) => j === i ? { ...step, [key]: val } : step));
  }
  async function generateCopy() {
    if (!name.trim()) {
      setErr("Workflow name is required");
      return;
    }
    if (!brief.trim()) {
      setErr("Campaign goal is required");
      return;
    }
    if (tCount === 0) {
      setErr("Set at least one email or SMS");
      return;
    }
    setErr("");
    setPhase("generating");
    let aiConfig = {};
    try {
      aiConfig = JSON.parse(localStorage.getItem("ghl_ai_config") || "{}");
    } catch {
    }
    try {
      const r = await fetch("/api/workflows/generate-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: brief.trim(),
          emailCount: eCount,
          smsCount: sCount,
          provider: aiConfig.provider,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Generation failed");
      setSteps(d.steps);
      setPhase("preview");
      if (draftId) {
        fetch(`/api/workflows/drafts/${draftId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId, name: name.trim(), brief: brief.trim(), steps: d.steps, emailCount: eCount, smsCount: sCount })
        }).catch(() => {
        });
      } else {
        fetch("/api/workflows/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId, name: name.trim(), brief: brief.trim(), steps: d.steps, emailCount: eCount, smsCount: sCount })
        }).then((r2) => r2.json()).then((saved) => {
          if (saved == null ? void 0 : saved.id) setDraftId(saved.id);
        }).catch(() => {
        });
      }
    } catch (e) {
      setErr(e.message);
      setPhase("form");
    }
  }
  async function publish() {
    setErr("");
    setAuthErr(false);
    setPhase("publishing");
    const trigger = { type: "contact_created", name: "Contact Created", conditions: [] };
    try {
      const r = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          name: name.trim(),
          trigger,
          steps,
          workflowId: (initialDraft == null ? void 0 : initialDraft.ghlWorkflowId) || void 0
        })
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.error === "ghl_unauthorized" || d.error === "no_session") {
          setAuthErr(true);
          throw new Error("GHL is not reachable for this location. Make sure the app is installed on your agency account, then try again.");
        }
        throw new Error(d.error || JSON.stringify(d.raw || d));
      }
      if (draftId) {
        fetch(`/api/workflows/drafts/${draftId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId, steps, ghlWorkflowId: d.workflowId, publishedAt: Date.now() })
        }).catch(() => {
        });
      }
      onCreate(d);
    } catch (e) {
      setErr(e.message);
      setPhase("preview");
    }
  }
  if (phase === "form" || phase === "generating") {
    const busy2 = phase === "generating";
    return /* @__PURE__ */ jsxs("div", { className: "wf-builder", children: [
      /* @__PURE__ */ jsxs("div", { className: "wf-builder-head", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { className: "wf-builder-title", children: initialDraft ? "Edit Sequence" : "New Workflow Sequence" }),
          /* @__PURE__ */ jsx("p", { className: "wf-builder-sub", children: "Describe your goal — AI writes a story-driven email & SMS sequence." })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: onCancel, disabled: busy2, children: "Cancel" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "wf-builder-body", children: [
        /* @__PURE__ */ jsxs("div", { className: "wf-field-group", children: [
          /* @__PURE__ */ jsx("label", { className: "wf-lbl", children: "Workflow Name" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "input wf-field",
              placeholder: "e.g. Summer Sale Nurture Sequence",
              value: name,
              onChange: (e) => setName(e.target.value),
              disabled: busy2
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "wf-field-group", children: [
          /* @__PURE__ */ jsxs("div", { className: "wf-brief-header", children: [
            /* @__PURE__ */ jsx("label", { className: "wf-lbl", children: "Campaign Goal" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: () => setLibOpen(true), disabled: busy2, children: "📚 Import from Library" })
          ] }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              className: "wf-brief-ta",
              rows: 6,
              placeholder: 'Describe your campaign. Be specific:\n• Who is the audience and what pain point do they have?\n• What is the offer or product?\n• What action should they take at the end?\n\nOr click "Import from Library" to auto-fill from a saved copy.',
              value: brief,
              onChange: (e) => setBrief(e.target.value),
              disabled: busy2
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "wf-builder-counts", children: [
          /* @__PURE__ */ jsxs("div", { className: "wf-count-group", children: [
            /* @__PURE__ */ jsx("label", { className: "wf-lbl", children: "Number of Emails" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                className: "input wf-count-input",
                min: 0,
                max: 10,
                value: emailCount,
                onChange: (e) => setEmailCount(e.target.value),
                disabled: busy2
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "wf-count-group", children: [
            /* @__PURE__ */ jsx("label", { className: "wf-lbl", children: "Number of SMS" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                className: "input wf-count-input",
                min: 0,
                max: 10,
                value: smsCount,
                onChange: (e) => setSmsCount(e.target.value),
                disabled: busy2
              }
            )
          ] }),
          /* @__PURE__ */ jsx("p", { className: "wf-count-note", children: "Timing between steps is set automatically from your goal." })
        ] }),
        err && /* @__PURE__ */ jsx("p", { className: "wf-err", style: { marginTop: 4 }, children: err }),
        /* @__PURE__ */ jsxs("div", { className: "wf-builder-actions", children: [
          /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: onCancel, disabled: busy2, children: "Cancel" }),
          /* @__PURE__ */ jsxs("button", { className: "btn btn-primary wf-generate-btn", onClick: generateCopy, disabled: busy2 || tCount === 0, children: [
            busy2 && /* @__PURE__ */ jsx("span", { className: "spinner", style: { width: 14, height: 14, flexShrink: 0 } }),
            busy2 ? `Writing ${eCount} email${eCount !== 1 ? "s" : ""}${sCount ? ` + ${sCount} SMS` : ""}…` : "Generate Copy"
          ] })
        ] })
      ] }),
      libOpen && /* @__PURE__ */ jsx(LibraryAnalyzer, { onFill: (t) => {
        setBrief(t);
        setLibOpen(false);
      }, onClose: () => setLibOpen(false) })
    ] });
  }
  const busy = phase === "publishing";
  const emailSteps = steps.filter((s) => s.type === "email");
  const smsSteps = steps.filter((s) => s.type === "sms");
  const isPublished = !!(initialDraft == null ? void 0 : initialDraft.ghlWorkflowId);
  let emailIdx = 0, smsIdx = 0;
  return /* @__PURE__ */ jsxs("div", { className: "wf-builder", children: [
    /* @__PURE__ */ jsxs("div", { className: "wf-builder-head", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "wf-builder-title", children: name }),
        /* @__PURE__ */ jsxs("p", { className: "wf-builder-sub", children: [
          emailSteps.length,
          " email",
          emailSteps.length !== 1 ? "s" : "",
          smsSteps.length ? ` · ${smsSteps.length} SMS` : "",
          " · Review and edit before publishing"
        ] })
      ] }),
      /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => setPhase("form"), disabled: busy, children: "← Edit Goal" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "wf-preview-steps", children: steps.map((step, i) => {
      if (step.type === "wait") return /* @__PURE__ */ jsxs("div", { className: "wf-wait-divider", children: [
        /* @__PURE__ */ jsx("div", { className: "wf-wait-line" }),
        /* @__PURE__ */ jsxs("span", { className: "wf-wait-label", children: [
          "⏱ ",
          step.value,
          " ",
          step.unit
        ] }),
        /* @__PURE__ */ jsx("div", { className: "wf-wait-line" })
      ] }, i);
      if (step.type === "email") {
        const n = ++emailIdx;
        return /* @__PURE__ */ jsxs("div", { className: "wf-preview-card wf-preview-card--email", children: [
          /* @__PURE__ */ jsxs("div", { className: "wf-preview-card-head", children: [
            /* @__PURE__ */ jsxs("span", { className: "wf-preview-badge wf-preview-badge--email", children: [
              "✉ Email ",
              n
            ] }),
            step.name && /* @__PURE__ */ jsx("span", { className: "wf-preview-card-label", children: step.name })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "wf-field-group", style: { marginBottom: 10 }, children: [
            /* @__PURE__ */ jsx("label", { className: "wf-lbl", style: { fontSize: ".75rem", marginBottom: 4 }, children: "Subject line" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                className: "input wf-field",
                value: step.subject || "",
                onChange: (e) => updateStep(i, "subject", e.target.value),
                disabled: busy
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "wf-field-group", children: [
            /* @__PURE__ */ jsx("label", { className: "wf-lbl", style: { fontSize: ".75rem", marginBottom: 4 }, children: "Body" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                className: "wf-ta",
                style: { minHeight: 180 },
                value: step.body || "",
                onChange: (e) => updateStep(i, "body", e.target.value),
                disabled: busy
              }
            )
          ] })
        ] }, i);
      }
      if (step.type === "sms") {
        const n = ++smsIdx;
        return /* @__PURE__ */ jsxs("div", { className: "wf-preview-card wf-preview-card--sms", children: [
          /* @__PURE__ */ jsxs("div", { className: "wf-preview-card-head", children: [
            /* @__PURE__ */ jsxs("span", { className: "wf-preview-badge wf-preview-badge--sms", children: [
              "💬 SMS ",
              n
            ] }),
            step.name && /* @__PURE__ */ jsx("span", { className: "wf-preview-card-label", children: step.name })
          ] }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              className: "wf-ta",
              rows: 3,
              value: step.body || "",
              onChange: (e) => updateStep(i, "body", e.target.value),
              disabled: busy
            }
          )
        ] }, i);
      }
      return null;
    }) }),
    err && /* @__PURE__ */ jsx("p", { className: "wf-err", style: { marginTop: 12 }, children: err }),
    authErr && /* @__PURE__ */ jsxs("div", { className: "wf-auth-err-box", children: [
      /* @__PURE__ */ jsx("p", { className: "wf-auth-err-msg", children: "GHL could not be reached for this location. Confirm the app is installed on your agency account, then try again." }),
      /* @__PURE__ */ jsxs("div", { className: "wf-panel-actions", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary btn-sm", onClick: () => {
          setAuthErr(false);
          publish();
        }, children: "Retry" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => setAuthErr(false), children: "Dismiss" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "wf-builder-actions", style: { marginTop: 24 }, children: [
      /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: () => setPhase("form"), disabled: busy, children: "← Edit Goal" }),
      /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: generateCopy, disabled: busy, children: "↻ Regenerate" }),
      /* @__PURE__ */ jsxs("button", { className: "btn btn-primary wf-generate-btn", onClick: publish, disabled: busy || authErr, children: [
        busy && /* @__PURE__ */ jsx("span", { className: "spinner", style: { width: 14, height: 14, flexShrink: 0 } }),
        busy ? "Publishing to GHL…" : isPublished ? "Republish to GHL →" : "Publish to GHL →"
      ] })
    ] })
  ] });
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1e3);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function Workflows() {
  const locationId = getLocationId();
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listErr, setListErr] = useState("");
  const [showBuilder, setShowBuilder] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [draftsLoad, setDraftsLoad] = useState(true);
  const [toast, setToast] = useState("");
  const didAutoOpen = useRef(false);
  useEffect(() => {
    if (didAutoOpen.current) return;
    if (searchParams.get("build") === "1") {
      didAutoOpen.current = true;
      setShowBuilder(true);
    }
  }, [searchParams]);
  const loadDrafts = useCallback(async () => {
    setDraftsLoad(true);
    try {
      const r = await fetch(`/api/workflows/drafts?locationId=${locationId}`);
      const d = await r.json();
      setDrafts(Array.isArray(d) ? d : []);
    } catch {
    }
    setDraftsLoad(false);
  }, [locationId]);
  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);
  async function deleteDraft(id) {
    await fetch(`/api/workflows/drafts/${id}?locationId=${locationId}`, { method: "DELETE" }).catch(() => {
    });
    setDrafts((ds) => ds.filter((d) => d.id !== id));
  }
  function openDraft(draft) {
    fetch(`/api/workflows/drafts/${draft.id}`).then((r) => r.json()).then((full) => {
      setEditDraft(full);
      setShowBuilder(true);
    }).catch(() => {
      setEditDraft(draft);
      setShowBuilder(true);
    });
  }
  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3e3);
  }
  const checkSession = useCallback(async () => {
    try {
      const r = await apiFetch("/api/workflows/session/status");
      const d = await r.json();
      return !!d.connected;
    } catch {
      return false;
    }
  }, []);
  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    setListErr("");
    try {
      const r = await apiFetch("/api/workflows");
      if (r.status === 401) {
        setWorkflows([]);
        setLoading(false);
        return;
      }
      if (!r.ok) {
        const d2 = await r.json();
        throw new Error(d2.error || "Load failed");
      }
      const d = await r.json();
      setWorkflows(Array.isArray(d) ? d : []);
    } catch (e) {
      setListErr(e.message);
    }
    setLoading(false);
  }, []);
  const recheck = useCallback(() => {
    setLoading(true);
    checkSession().then((ok) => {
      setConnected(ok);
      if (ok) loadWorkflows();
      else setLoading(false);
    });
  }, [checkSession, loadWorkflows]);
  useEffect(() => {
    recheck();
  }, [recheck]);
  function onCreated() {
    setShowBuilder(false);
    setEditDraft(null);
    flash("Workflow published to GHL!");
    loadWorkflows();
    loadDrafts();
  }
  function triggerLabel(wf) {
    var _a, _b, _c;
    const t = ((_b = (_a = wf.triggers) == null ? void 0 : _a[0]) == null ? void 0 : _b.type) || wf.type || "";
    return ((_c = TRIGGER_TYPES.find((x) => x.value === t)) == null ? void 0 : _c.label) || t || "—";
  }
  function stepSummary(wf) {
    var _a;
    const tpls = ((_a = wf.workflowData) == null ? void 0 : _a.templates) || [];
    if (!tpls.length) return "No steps";
    const counts = {};
    tpls.forEach((s) => {
      counts[s.type] = (counts[s.type] || 0) + 1;
    });
    return Object.entries(counts).map(([t, n]) => `${n}× ${t}`).join("  ·  ");
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "topnav", children: [
      /* @__PURE__ */ jsx("div", { className: "topnav-left", children: /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Workflows" }) }),
      /* @__PURE__ */ jsx("div", { className: "topnav-right", children: !showBuilder && connected && /* @__PURE__ */ jsx("button", { className: "btn btn-primary btn-sm", onClick: () => setShowBuilder(true), children: "+ New Workflow" }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "page-body", children: [
      !showBuilder && /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs("div", { className: `wf-sess-bar ${connected ? "wf-sess-bar--ok" : "wf-sess-bar--warn"}`, children: [
        /* @__PURE__ */ jsxs("div", { className: "wf-sess-left", children: [
          /* @__PURE__ */ jsx("span", { className: "wf-sess-dot" }),
          /* @__PURE__ */ jsx("span", { className: "wf-sess-text", children: connected ? "GHL connected — workflows can be created and listed" : "GHL not reachable for this location. Ensure the app is installed on your agency account." })
        ] }),
        !connected && /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm wf-sess-btn", onClick: recheck, disabled: loading, children: loading ? "Checking…" : "Retry" })
      ] }) }),
      showBuilder && /* @__PURE__ */ jsx(
        WorkflowBuilder,
        {
          initialDraft: editDraft,
          onCancel: () => {
            setShowBuilder(false);
            setEditDraft(null);
          },
          onCreate: onCreated,
          onReconnect: recheck
        }
      ),
      !showBuilder && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("div", { className: "page-header", children: /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h1", { className: "page-title", children: "Workflows" }),
          /* @__PURE__ */ jsx("p", { className: "page-sub", children: "Create and manage GHL automation workflows" })
        ] }) }),
        (draftsLoad || drafts.length > 0) && /* @__PURE__ */ jsxs("div", { className: "wf-history", children: [
          /* @__PURE__ */ jsxs("div", { className: "wf-history-head", children: [
            /* @__PURE__ */ jsx("h3", { className: "wf-history-title", children: "Sequence History" }),
            /* @__PURE__ */ jsxs("span", { className: "wf-history-count", children: [
              drafts.length,
              " saved"
            ] })
          ] }),
          draftsLoad && /* @__PURE__ */ jsx("div", { style: { padding: "16px 0" }, children: /* @__PURE__ */ jsx("div", { className: "spinner", style: { margin: "0 auto" } }) }),
          /* @__PURE__ */ jsx("div", { className: "wf-history-list", children: drafts.map((d) => /* @__PURE__ */ jsxs("div", { className: "wf-history-card", children: [
            /* @__PURE__ */ jsxs("div", { className: "wf-history-card-info", children: [
              /* @__PURE__ */ jsx("div", { className: "wf-history-card-name", children: d.name }),
              /* @__PURE__ */ jsxs("div", { className: "wf-history-card-meta", children: [
                /* @__PURE__ */ jsx("span", { className: `wf-badge ${d.publishedAt ? "wf-badge--published" : "wf-badge--draft"}`, children: d.publishedAt ? "✓ Published" : "Draft" }),
                /* @__PURE__ */ jsxs("span", { className: "wf-history-stat", children: [
                  d.emailCount,
                  " email",
                  d.emailCount !== 1 ? "s" : ""
                ] }),
                d.smsCount > 0 && /* @__PURE__ */ jsxs("span", { className: "wf-history-stat", children: [
                  d.smsCount,
                  " SMS"
                ] }),
                /* @__PURE__ */ jsx("span", { className: "wf-history-time", children: timeAgo(d.updatedAt || d.createdAt) })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "wf-history-card-actions", children: [
              /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: () => openDraft(d), children: d.publishedAt ? "Edit & Republish" : "Edit" }),
              d.ghlWorkflowId && /* @__PURE__ */ jsx(
                "a",
                {
                  href: `https://app.gohighlevel.com/v2/location/${locationId}/workflows/${d.ghlWorkflowId}`,
                  target: "_blank",
                  rel: "noreferrer",
                  className: "btn btn-ghost btn-sm",
                  children: "GHL ↗"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  className: "btn btn-ghost btn-sm wf-history-del",
                  onClick: () => deleteDraft(d.id),
                  title: "Delete",
                  children: "✕"
                }
              )
            ] })
          ] }, d.id)) })
        ] }),
        loading && /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", padding: 40 }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) }),
        !loading && listErr && /* @__PURE__ */ jsx("div", { className: "wf-err-box", children: listErr }),
        !loading && !listErr && !connected && drafts.length === 0 && /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
          /* @__PURE__ */ jsx("p", { className: "empty-state-text", children: "GHL isn’t reachable for this location. Make sure Automator is installed on your agency account." }),
          /* @__PURE__ */ jsx("button", { className: "btn btn-primary", style: { marginTop: 12 }, onClick: recheck, children: "Retry" })
        ] }),
        !loading && !listErr && connected && workflows.length === 0 && drafts.length === 0 && /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
          /* @__PURE__ */ jsx("p", { className: "empty-state-text", children: "No workflows yet — create your first sequence" }),
          /* @__PURE__ */ jsx("button", { className: "btn btn-primary", style: { marginTop: 12 }, onClick: () => setShowBuilder(true), children: "+ New Workflow" })
        ] }),
        workflows.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("h3", { className: "wf-section-title", children: "Live in GHL" }),
          /* @__PURE__ */ jsx("div", { className: "wf-list", children: workflows.map((wf) => /* @__PURE__ */ jsxs("div", { className: "wf-card", children: [
            /* @__PURE__ */ jsxs("div", { className: "wf-card-info", children: [
              /* @__PURE__ */ jsx("div", { className: "wf-card-name", children: wf.name }),
              /* @__PURE__ */ jsxs("div", { className: "wf-card-meta", children: [
                /* @__PURE__ */ jsx("span", { className: `wf-badge wf-badge--${wf.status || "draft"}`, children: wf.status || "draft" }),
                /* @__PURE__ */ jsxs("span", { className: "wf-card-trigger", children: [
                  "⚡ ",
                  triggerLabel(wf)
                ] }),
                /* @__PURE__ */ jsx("span", { className: "wf-card-steps", children: stepSummary(wf) })
              ] })
            ] }),
            /* @__PURE__ */ jsx(
              "a",
              {
                href: `https://app.gohighlevel.com/v2/location/${locationId}/workflows/${wf.id || wf._id}`,
                target: "_blank",
                rel: "noreferrer",
                className: "btn btn-secondary btn-sm",
                children: "Open in GHL ↗"
              }
            )
          ] }, wf.id || wf._id)) })
        ] })
      ] })
    ] }),
    toast && /* @__PURE__ */ jsx("div", { className: "wf-toast", children: toast })
  ] });
}
export {
  Workflows as default
};
