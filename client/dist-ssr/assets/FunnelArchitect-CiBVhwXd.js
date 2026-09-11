import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useRef, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { g as getLocationId, u as useAIConfig, a as api } from "../entry-server.mjs";
import { n as notifySuccess, a as notifyError, c as confirmToast } from "./toast-DrUOosTv.js";
import "node:async_hooks";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-toastify";
const PRICE_POINTS = ["Free / Lead magnet", "$100 to $1k", "$1k to $5k", "$5k to $25k", "$25k+"];
const TRAFFIC = ["Paid ads", "Organic / Social", "Email list", "SEO", "Referrals", "Cold outreach"];
const GOALS = ["Book calls", "Sell a product", "Collect leads", "Webinar registrations", "Applications"];
const STEP = {
  TAG: "#8B5CF6",
  PIPELINE: "#6366F1",
  EMAIL: "#10B981",
  SMS: "#06B6D4",
  WAIT: "#F59E0B",
  INTERNAL: "#64748B",
  CONDITION: "#EF4444"
};
const stepColor = (t) => STEP[String(t || "").toUpperCase()] || "#64748B";
function Chip({ children, color }) {
  return /* @__PURE__ */ jsx("span", { style: { fontSize: ".72rem", fontWeight: 600, padding: "3px 10px", borderRadius: 99, border: "1px solid var(--border)", background: color ? `${color}18` : "var(--surface)", color: color || "var(--sub)", whiteSpace: "nowrap" }, children });
}
function Flow({ pages }) {
  return /* @__PURE__ */ jsx("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: (pages || []).map((p, i) => /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 6 }, children: [
    /* @__PURE__ */ jsx("span", { style: { fontSize: ".72rem", fontWeight: 600, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }, children: p }),
    i < pages.length - 1 && /* @__PURE__ */ jsx("span", { style: { color: "var(--sub)" }, children: "→" })
  ] }, i)) });
}
function buildToText(ctx, b, isWeb) {
  const L = [];
  L.push(`${isWeb ? "WEBSITE" : "FUNNEL"} BUILD SHEET`, b.funnelName || "", b.flow || "", "");
  L.push(`OFFER: ${ctx.offer}`);
  L.push(`PRICE POINT: ${ctx.price}`, `TRAFFIC: ${ctx.traffic}`, `GOAL: ${ctx.goal}`);
  if (b.watchOut) L.push(`WATCH OUT: ${b.watchOut}`);
  L.push("", "== CUSTOMER JOURNEY ==");
  (b.journey || []).forEach((j, i) => {
    L.push("", `${i + 1}. ${j.page}`);
    if (j.mindset) L.push(`   MINDSET: ${j.mindset}`);
    if (j.pageJob) L.push(`   PAGE JOB: ${j.pageJob}`);
    (j.mustHave || []).forEach((m) => L.push(`   MUST HAVE: ${m}`));
    if (j.button) L.push(`   BUTTON: ${j.button}`);
    if (j.dropOff) L.push(`   DROP-OFF: ${j.dropOff}`);
  });
  if ((b.pageCopy || []).length) {
    L.push("", "== PAGE COPY ==");
    b.pageCopy.forEach((p) => {
      L.push("", `${p.badge || p.page}`);
      if (p.headline) L.push(`   ${p.headline}`);
      if (p.subhead) L.push(`   ${p.subhead}`);
      (p.bullets || []).forEach((x) => L.push(`   • ${x}`));
      if ((p.formFields || []).length) L.push(`   FORM: ${p.formFields.join(", ")}`);
      if (p.button) L.push(`   [${p.button}]`);
      if (p.testimonial) L.push(`   ${p.testimonial}`);
    });
  }
  if ((b.workflows || []).length) L.push("", "== GHL AUTOMATION MAP ==");
  (b.workflows || []).forEach((w) => {
    L.push("", `${w.name}  (Trigger: ${w.trigger})`);
    (w.steps || []).forEach((s) => L.push(`   [${String(s.type).toUpperCase()}] ${s.text}`));
  });
  if ((b.tagsToCreate || []).length) L.push("", `TAGS TO CREATE: ${b.tagsToCreate.join(", ")}`);
  if ((b.customFields || []).length) L.push(`CUSTOM FIELDS: ${b.customFields.join(", ")}`);
  if ((b.pipelineStages || []).length) L.push(`PIPELINE STAGES: ${b.pipelineStages.join(" → ")}`);
  return L.join("\n");
}
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function downloadPDF(ctx, b, isWeb) {
  const w = window.open("", "_blank");
  if (!w) {
    notifyError("Allow pop-ups to download the PDF");
    return;
  }
  const sheetLabel = isWeb ? "Website Build Sheet" : "Funnel Build Sheet";
  const row = (label, val) => `<tr><td class="lbl">${esc(label)}</td><td>${val}</td></tr>`;
  const journey = (b.journey || []).map((j, i) => `
    <div class="blk"><h3>${i + 1}. ${esc(j.page)}</h3><table>
      ${j.mindset ? row("MINDSET", esc(j.mindset)) : ""}
      ${j.pageJob ? row("PAGE JOB", esc(j.pageJob)) : ""}
      ${(j.mustHave || []).length ? row("MUST HAVE", (j.mustHave || []).map(esc).join("<br>")) : ""}
      ${j.button ? row("BUTTON", `<b>${esc(j.button)}</b>`) : ""}
      ${j.dropOff ? row("DROP-OFF", esc(j.dropOff)) : ""}
    </table></div>`).join("");
  const wf = (b.workflows || []).map((wf2) => `
    <div class="blk"><h3>${esc(wf2.name)}</h3><div class="trg">Trigger: ${esc(wf2.trigger)}</div>
      <table>${(wf2.steps || []).map((s) => `<tr><td class="lbl">${esc(String(s.type).toUpperCase())}</td><td>${esc(s.text)}</td></tr>`).join("")}</table></div>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(b.funnelName || sheetLabel)}</title>
    <style>
      *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;margin:32px;font-size:12px;line-height:1.5}
      h1{font-size:20px;margin:0 0 2px} h2{font-size:13px;letter-spacing:.06em;background:#0f172a;color:#fff;padding:6px 10px;border-radius:6px;margin:22px 0 10px}
      h3{font-size:13px;margin:0 0 6px} .flow{color:#475569;margin:0 0 16px}
      .sub{color:#64748b;text-transform:uppercase;letter-spacing:.08em;font-size:10px;font-weight:700}
      table{width:100%;border-collapse:collapse;margin:2px 0} td{padding:5px 8px;vertical-align:top;border-top:1px solid #e2e8f0}
      td.lbl{width:110px;color:#64748b;font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:.05em}
      .blk{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin:0 0 12px} .trg{font-size:10px;color:#334155;margin:0 0 6px}
      .meta td.lbl{width:120px} @media print{body{margin:12mm}}
    </style></head><body>
    <div class="sub">${esc(sheetLabel)}</div>
    <h1>${esc(b.funnelName || "")}</h1>
    <div class="flow">${esc(b.flow || "")}</div>
    <table class="meta">
      ${row("OFFER", esc(ctx.offer))}
      ${row("PRICE POINT", esc(ctx.price))}
      ${row("TRAFFIC", esc(ctx.traffic))}
      ${row("GOAL", esc(ctx.goal))}
      ${b.watchOut ? row("WATCH OUT", esc(b.watchOut)) : ""}
    </table>
    <h2>${isWeb ? "PAGE-BY-PAGE PLAN" : "CUSTOMER JOURNEY"}</h2>${journey}
    ${(b.workflows || []).length ? `<h2>GHL AUTOMATION MAP</h2>${wf}` : ""}
    ${(b.tagsToCreate || []).length ? `<h2>SETUP</h2><table>${row("TAGS", (b.tagsToCreate || []).map(esc).join(", "))}${row("CUSTOM FIELDS", (b.customFields || []).map(esc).join(", "))}${row("PIPELINE", (b.pipelineStages || []).map(esc).join(" → "))}</table>` : ""}
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
  w.document.close();
}
function FunnelArchitect({ kind = "funnel" }) {
  const isWeb = kind === "website";
  const T = isWeb ? { title: "Website Architect", sub: "Start with your business, or drop in a meeting transcript — one website build sheet out.", recommend: "Recommend site structures", options: "Three ways to build this site", map: "Map this website" } : { title: "Funnel Architect", sub: "Start with your offer, or drop in a meeting transcript — one build sheet out.", recommend: "Recommend funnels", options: "Three ways to build this", map: "Map this funnel" };
  const navigate = useNavigate();
  const location = useLocation();
  const locationId = getLocationId();
  const { config, loading: configLoading } = useAIConfig();
  const handoffDone = useRef(false);
  const [stage, setStage] = useState("intake");
  const [offer, setOffer] = useState("");
  const [price, setPrice] = useState(PRICE_POINTS[1]);
  const [traffic, setTraffic] = useState(TRAFFIC[0]);
  const [goal, setGoal] = useState(GOALS[0]);
  const [inputMode, setInputMode] = useState("offer");
  const [notes, setNotes] = useState("");
  const [notesFile, setNotesFile] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [options, setOptions] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [selPages, setSelPages] = useState([]);
  const [build, setBuild] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyIdx, setCopyIdx] = useState(0);
  const [rewriting, setRewriting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showPB, setShowPB] = useState(false);
  const [pb, setPb] = useState(null);
  const [pbText, setPbText] = useState("");
  const [pbBusy, setPbBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const notesFileRef = useRef(null);
  const ctx = { offer, price, traffic, goal };
  const aiArgs = () => ({ offer, pricePoint: price, traffic, goal, notes, kind, provider: config.provider, apiKey: config.apiKey, model: config.model });
  const TEXT_EXTS = ["txt", "vtt", "srt", "md", "csv", "rtf", "json", "html", "htm", "log"];
  async function onNotesFile(e) {
    var _a;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    if (!file) return;
    setNotesFile(file.name);
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (TEXT_EXTS.includes(ext)) {
      const reader = new FileReader();
      reader.onload = () => setNotes((prev) => (prev ? prev + "\n\n" : "") + String(reader.result || ""));
      reader.readAsText(file);
      e.target.value = "";
      return;
    }
    setExtracting(true);
    try {
      const { text, chars } = await api.extractFile(file);
      setNotes((prev) => (prev ? prev + "\n\n" : "") + text);
      notifySuccess(`Extracted ${chars.toLocaleString()} characters`);
    } catch (err) {
      notifyError(err.message || "Could not read that file");
      setNotesFile("");
    } finally {
      setExtracting(false);
      e.target.value = "";
    }
  }
  async function runFromNotes(text) {
    setNotes(text);
    setAnalyzing(true);
    let derived = { offer: "", pricePoint: price, traffic, goal };
    try {
      const d = await api.architectFromNotes({ notes: text, kind, provider: config.provider, apiKey: config.apiKey, model: config.model });
      derived = { offer: d.offer || "", pricePoint: d.pricePoint || price, traffic: d.traffic || traffic, goal: d.goal || goal };
      setOffer(derived.offer);
      setPrice(derived.pricePoint);
      setTraffic(derived.traffic);
      setGoal(derived.goal);
    } catch (e) {
      setAnalyzing(false);
      notifyError(e.message || "Could not read the notes");
      return;
    }
    setAnalyzing(false);
    setLoading(true);
    try {
      const j = await api.architectOptions({ ...derived, notes: text, kind, provider: config.provider, apiKey: config.apiKey, model: config.model });
      setOptions(j.options || []);
      setStage("options");
    } catch (e) {
      notifyError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const st = location.state;
    if (!(st == null ? void 0 : st.notes) || handoffDone.current) return;
    if (st.auto && !(config == null ? void 0 : config.apiKey)) return;
    handoffDone.current = true;
    if (st.auto && (config == null ? void 0 : config.apiKey)) runFromNotes(st.notes);
    else {
      setNotes(st.notes);
      setInputMode("notes");
    }
  }, [location.state, config == null ? void 0 : config.apiKey]);
  async function getOptions() {
    if (!offer.trim()) {
      notifyError("Tell me the offer first");
      return;
    }
    if (!(config == null ? void 0 : config.apiKey)) {
      notifyError("Connect an AI provider in Settings first");
      return;
    }
    setLoading(true);
    try {
      const j = await api.architectOptions(aiArgs());
      setOptions(j.options || []);
      setStage("options");
    } catch (e) {
      notifyError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }
  function pickOption(opt) {
    setChosen(opt);
    const core = opt.corePages && opt.corePages.length ? opt.corePages : opt.mvpFlow || [];
    setSelPages((opt.pages && opt.pages.length ? opt.pages : opt.mvpFlow || []).filter((p) => core.includes(p)));
    setStage("pages");
  }
  const orderedSelected = () => {
    const all = (chosen == null ? void 0 : chosen.pages) && chosen.pages.length ? chosen.pages : (chosen == null ? void 0 : chosen.mvpFlow) || [];
    return all.filter((p) => selPages.includes(p));
  };
  async function mapFunnel() {
    const pages = orderedSelected();
    if (!pages.length) {
      notifyError("Select at least one page");
      return;
    }
    setLoading(true);
    try {
      const j = await api.architectBuild({ ...aiArgs(), funnelName: chosen.name, pages });
      setBuild(j);
      setCopyIdx(0);
      setFeedback(null);
      setStage("build");
      api.architectLearn({ ...aiArgs(), funnelName: j.funnelName || chosen.name, flow: j.flow || pages.join(" → "), kept: false });
    } catch (e) {
      notifyError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }
  async function openPlaybook() {
    const next = !showPB;
    setShowPB(next);
    if (next) {
      setPbBusy(true);
      try {
        const m = await api.getArchitectMemory();
        setPb(m);
        setPbText(m.playbook || "");
      } catch {
      } finally {
        setPbBusy(false);
      }
    }
  }
  async function savePlaybook() {
    setPbBusy(true);
    try {
      await api.setArchitectPlaybook(pbText);
      setPb((p) => ({ ...p || {}, playbook: pbText }));
      notifySuccess("Playbook saved");
    } catch (e) {
      notifyError(e.message || "Save failed");
    } finally {
      setPbBusy(false);
    }
  }
  async function resetPlaybook() {
    if (!await confirmToast("Reset everything the Architect has learned for this account? This clears the playbook and history.", { confirmText: "Reset", danger: true })) return;
    setPbBusy(true);
    try {
      await api.resetArchitectMemory();
      setPb({ playbook: "", count: 0, examples: [] });
      setPbText("");
      notifySuccess("Playbook reset");
    } catch (e) {
      notifyError(e.message || "Reset failed");
    } finally {
      setPbBusy(false);
    }
  }
  function thumb(sentiment) {
    setFeedback(sentiment);
    api.architectLearn({ ...aiArgs(), funnelName: build.funnelName, flow: build.flow, sentiment });
    notifySuccess(sentiment === "up" ? "Thanks — reinforced for next time" : "Noted — I’ll steer away from this");
  }
  async function rewriteCopy() {
    setRewriting(true);
    try {
      const pages = (build.pageCopy || []).map((p) => p.page).filter(Boolean);
      const j = await api.architectPageCopy({ ...aiArgs(), funnelName: build.funnelName, pages: pages.length ? pages : orderedSelected() });
      if (Array.isArray(j.pageCopy) && j.pageCopy.length) {
        setBuild((b) => ({ ...b, pageCopy: j.pageCopy }));
        setCopyIdx((i) => Math.min(i, j.pageCopy.length - 1));
        notifySuccess("Page copy rewritten");
      }
    } catch (e) {
      notifyError(e.message || "Rewrite failed");
    } finally {
      setRewriting(false);
    }
  }
  async function previewPage(p) {
    if (!(config == null ? void 0 : config.apiKey)) {
      notifyError("Connect an AI provider in Settings first");
      return;
    }
    const copyText = [
      p.headline,
      p.subhead,
      ...(p.bullets || []).map((b) => `• ${b}`),
      p.button ? `Primary button: ${p.button}` : "",
      p.testimonial ? `Testimonial: ${p.testimonial}` : ""
    ].filter(Boolean).join("\n");
    setPreview({ page: p.page, loading: true, chars: 0, html: null, error: null });
    try {
      const r = await api.generateMockupStream(
        { copy: `${p.badge || p.page}

${copyText}`, type: "sales-page", mode: "ai", copyLength: "short", provider: config.provider, apiKey: config.apiKey, model: config.model },
        { onChunk: (c) => setPreview((pv) => pv ? { ...pv, chars: (pv.chars || 0) + c.length } : pv) }
      );
      setPreview((pv) => pv ? { ...pv, loading: false, html: (r == null ? void 0 : r.html) || null } : pv);
    } catch (e) {
      setPreview((pv) => pv ? { ...pv, loading: false, error: e.message || "Preview failed" } : pv);
    }
  }
  function copySheet() {
    var _a;
    (_a = navigator.clipboard) == null ? void 0 : _a.writeText(buildToText(ctx, build, isWeb)).then(() => notifySuccess("Build sheet copied")).catch(() => {
    });
  }
  async function saveToLibrary() {
    setSaving(true);
    try {
      const title = `${isWeb ? "Website" : "Funnel"} Build — ${build.funnelName || offer.slice(0, 40)}`;
      const copy = await api.saveCopy({
        customerId: "_unsorted",
        customerName: "",
        type: "general",
        title,
        preview: (build.flow || "").slice(0, 120),
        messages: [
          { role: "user", content: `Offer: ${offer}
Price: ${price} · Traffic: ${traffic} · Goal: ${goal}` },
          { role: "assistant", content: buildToText(ctx, build, isWeb) }
        ]
      });
      notifySuccess("Saved to Library");
      api.architectLearn({ ...aiArgs(), funnelName: build.funnelName, flow: build.flow, kept: true });
      if (copy == null ? void 0 : copy.id) {
        const u = new URL(`/library/_unsorted/${copy.id}`, window.location.origin);
        if (locationId) u.searchParams.set("locationId", locationId);
        navigate(u.pathname + u.search);
      }
    } catch (e) {
      notifyError(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }
  const Kicker = ({ children }) => /* @__PURE__ */ jsx("span", { style: { fontSize: ".66rem", fontWeight: 700, letterSpacing: ".1em", color: "var(--sub)", marginLeft: 10 }, children });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "topnav", children: [
      /* @__PURE__ */ jsx("div", { className: "topnav-left", children: /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: T.title }) }),
      /* @__PURE__ */ jsxs("div", { className: "topnav-right", style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${showPB ? "btn-secondary" : "btn-ghost"}`, onClick: openPlaybook, title: "What the Architect has learned for this account", children: "✦ Playbook" }),
        stage !== "intake" && /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => {
          setStage("intake");
          setBuild(null);
          setChosen(null);
          setFeedback(null);
        }, children: "Start over" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "content", style: { maxWidth: 980 }, children: [
      /* @__PURE__ */ jsx(Stepper, { stage }),
      showPB && /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 18, marginBottom: 18, borderLeft: "3px solid var(--accent)" }, children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }, children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "fw-700", children: "Account Playbook" }),
            /* @__PURE__ */ jsxs("div", { style: { fontSize: ".76rem", color: "var(--sub)" }, children: [
              "What the Architect has learned for this account",
              (pb == null ? void 0 : pb.count) ? ` · ${pb.count} build${pb.count !== 1 ? "s" : ""} so far` : "",
              ". It gets applied to every generation and sharpens with 👍/👎 and saves."
            ] })
          ] }),
          /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => setShowPB(false), children: "Close" })
        ] }),
        pbBusy && !pb ? /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, color: "var(--sub)", padding: "10px 0" }, children: [
          /* @__PURE__ */ jsx("div", { className: "spinner" }),
          " Loading…"
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            "textarea",
            {
              className: "form-input",
              style: { minHeight: 130, resize: "vertical", fontFamily: "inherit", fontSize: ".85rem", background: "var(--surface)" },
              value: pbText,
              onChange: (e) => setPbText(e.target.value),
              placeholder: "The playbook is still learning — run a few builds, or write your own notes here (funnel types that fit, tone, offers, what to avoid)…"
            }
          ),
          ((pb == null ? void 0 : pb.examples) || []).length > 0 && /* @__PURE__ */ jsxs("div", { style: { marginTop: 10 }, children: [
            /* @__PURE__ */ jsx("div", { style: { fontSize: ".62rem", fontWeight: 700, letterSpacing: ".08em", color: "var(--sub)", marginBottom: 6 }, children: "RECENT BUILDS" }),
            /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: pb.examples.map((e, i) => /* @__PURE__ */ jsxs("div", { style: { fontSize: ".78rem", color: "var(--sub)", display: "flex", gap: 8, alignItems: "center" }, children: [
              /* @__PURE__ */ jsx("span", { style: { fontWeight: 700, color: "var(--text)" }, children: e.funnelName }),
              /* @__PURE__ */ jsx("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: e.offer }),
              e.kept && /* @__PURE__ */ jsx("span", { style: { color: "var(--accent)" }, children: "★ saved" })
            ] }, i)) })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx("button", { className: "btn btn-primary btn-sm", onClick: savePlaybook, disabled: pbBusy, children: "Save playbook" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", style: { color: "var(--danger)" }, onClick: resetPlaybook, disabled: pbBusy, children: "Reset learning" })
          ] })
        ] })
      ] }),
      stage === "intake" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("div", { className: "page-header", children: /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "page-title", children: T.title }),
          /* @__PURE__ */ jsx("div", { className: "page-sub", children: T.sub })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { style: { display: "inline-flex", gap: 4, background: "var(--surface)", borderRadius: 10, padding: 4, marginBottom: 14 }, children: [
          /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${inputMode === "offer" ? "btn-primary" : "btn-ghost"}`, onClick: () => setInputMode("offer"), children: "I have the offer" }),
          /* @__PURE__ */ jsx("button", { className: `btn btn-sm ${inputMode === "notes" ? "btn-primary" : "btn-ghost"}`, onClick: () => setInputMode("notes"), children: "I have meeting notes / transcript" })
        ] }),
        inputMode === "offer" ? /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 20, display: "flex", flexDirection: "column", gap: 14 }, children: [
          /* @__PURE__ */ jsxs("div", { className: "form-group", style: { margin: 0 }, children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", children: "The offer" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                className: "form-input",
                style: { minHeight: 120, resize: "vertical", fontFamily: "inherit", background: "var(--surface)" },
                value: offer,
                onChange: (e) => setOffer(e.target.value),
                placeholder: "Example: 12-week 1-on-1 coaching for female founders who want to hit their first $10k month. Includes weekly calls, a template vault, and Slack access."
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }, children: [
            /* @__PURE__ */ jsxs("div", { className: "form-group", style: { margin: 0 }, children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Price point" }),
              /* @__PURE__ */ jsx("select", { className: "form-input form-select", value: price, onChange: (e) => setPrice(e.target.value), children: PRICE_POINTS.map((p) => /* @__PURE__ */ jsx("option", { children: p }, p)) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "form-group", style: { margin: 0 }, children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Main traffic" }),
              /* @__PURE__ */ jsx("select", { className: "form-input form-select", value: traffic, onChange: (e) => setTraffic(e.target.value), children: TRAFFIC.map((t) => /* @__PURE__ */ jsx("option", { children: t }, t)) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "form-group", style: { margin: 0 }, children: [
              /* @__PURE__ */ jsx("label", { className: "form-label", children: "Primary goal" }),
              /* @__PURE__ */ jsx("select", { className: "form-input form-select", value: goal, onChange: (e) => setGoal(e.target.value), children: GOALS.map((g) => /* @__PURE__ */ jsx("option", { children: g }, g)) })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: getOptions, disabled: loading || configLoading || !offer.trim(), children: loading ? "Thinking…" : T.recommend }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: ".75rem", color: "var(--sub)" }, children: isWeb ? "site structure · page list · visitor journey · page copy" : "funnel type · page flow · customer journey · GHL workflows" })
          ] })
        ] }) : /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 20, display: "flex", flexDirection: "column", gap: 12 }, children: [
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx("label", { className: "form-label", style: { margin: 0 }, children: "Meeting transcript, notes, or summary" }),
            /* @__PURE__ */ jsx("input", { ref: notesFileRef, type: "file", accept: ".pdf,.docx,.txt,.vtt,.srt,.md,.csv,.rtf,.json,.html,.htm,.log,application/pdf", onChange: onNotesFile, style: { display: "none" } }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => {
              var _a;
              return (_a = notesFileRef.current) == null ? void 0 : _a.click();
            }, disabled: extracting, children: extracting ? "Reading file…" : "📎 Upload PDF / Word / text" })
          ] }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              className: "form-input",
              style: { minHeight: 160, resize: "vertical", fontFamily: "inherit", background: "var(--surface)" },
              value: notes,
              onChange: (e) => setNotes(e.target.value),
              placeholder: "Paste the Zoom/call transcript or your meeting notes here — or upload a file. I’ll read it, derive the offer, and recommend funnels."
            }
          ),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: () => runFromNotes(notes), disabled: analyzing || loading || extracting || configLoading || !notes.trim(), children: analyzing ? "Reading your notes…" : loading ? "Recommending funnels…" : "Build from notes →" }),
            notesFile && !extracting && /* @__PURE__ */ jsx("span", { style: { fontSize: ".75rem", color: "var(--sub)" }, children: notesFile }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: ".75rem", color: "var(--sub)" }, children: "derives the offer → recommends funnels" })
          ] })
        ] })
      ] }),
      stage === "options" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { style: { marginBottom: 16 }, children: [
          /* @__PURE__ */ jsx("div", { className: "page-title", style: { display: "inline" }, children: T.options }),
          /* @__PURE__ */ jsx(Kicker, { children: "PICK ONE TO MAP IT" }),
          /* @__PURE__ */ jsx("div", { className: "page-sub", style: { marginTop: 6 }, children: "Based on your offer, price point, traffic, and goal." })
        ] }),
        /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14 }, children: options.map((o, i) => {
          const best = i === 0;
          return /* @__PURE__ */ jsxs("div", { className: "card", style: { position: "relative", overflow: "hidden", padding: 16, paddingTop: best ? 20 : 16, display: "flex", flexDirection: "column", gap: 8, border: best ? "1px solid var(--accent)" : "1px solid var(--border)", boxShadow: best ? "0 8px 28px color-mix(in srgb, var(--accent) 20%, transparent)" : void 0 }, children: [
            best && /* @__PURE__ */ jsx("div", { style: { position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg,#14B8A6,var(--accent))" } }),
            /* @__PURE__ */ jsx(Chip, { color: best ? "var(--accent)" : void 0, children: (o.badge || (best ? "Best Fit" : `Option ${i + 1}`)).toUpperCase() }),
            /* @__PURE__ */ jsx("div", { style: { fontWeight: 800, fontSize: "1rem", color: "var(--text)" }, children: o.name }),
            /* @__PURE__ */ jsx("div", { style: { fontSize: ".68rem", fontWeight: 700, letterSpacing: ".08em", color: "var(--sub)" }, children: o.tagline }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: ".66rem", color: "var(--sub)", marginBottom: 3 }, children: [
                /* @__PURE__ */ jsx("span", { children: "FIT" }),
                /* @__PURE__ */ jsx("span", { children: o.fit ?? "" })
              ] }),
              /* @__PURE__ */ jsx("div", { style: { height: 6, borderRadius: 99, background: "var(--surface)", overflow: "hidden" }, children: /* @__PURE__ */ jsx("div", { style: { width: `${Math.max(0, Math.min(100, o.fit || 0))}%`, height: "100%", background: "linear-gradient(90deg,#14B8A6,var(--accent))" } }) })
            ] }),
            /* @__PURE__ */ jsx("div", { style: { fontSize: ".84rem", color: "var(--text)", lineHeight: 1.5 }, children: o.description }),
            /* @__PURE__ */ jsxs("div", { style: { marginTop: 2 }, children: [
              /* @__PURE__ */ jsxs("div", { style: { fontSize: ".62rem", fontWeight: 700, letterSpacing: ".08em", color: "var(--sub)", marginBottom: 4 }, children: [
                "MVP FLOW · ",
                (o.mvpFlow || []).length,
                " PAGES"
              ] }),
              /* @__PURE__ */ jsx(Flow, { pages: o.mvpFlow })
            ] }),
            o.watchOut && /* @__PURE__ */ jsxs("div", { style: { fontSize: ".76rem", color: "var(--danger)", lineHeight: 1.4 }, children: [
              "Watch out: ",
              o.watchOut
            ] }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-primary btn-sm", style: { marginTop: "auto" }, onClick: () => pickOption(o), children: "Pick this →" })
          ] }, o.id || i);
        }) })
      ] }),
      stage === "pages" && chosen && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { style: { marginBottom: 16 }, children: [
          /* @__PURE__ */ jsx("div", { className: "page-title", style: { display: "inline" }, children: "Confirm the pages" }),
          /* @__PURE__ */ jsx(Kicker, { children: "CORE PAGES ARE ON, ADD-ONS ARE OFF" }),
          /* @__PURE__ */ jsx("div", { className: "page-sub", style: { marginTop: 6 }, children: chosen.name })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 18 }, children: [
          /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 10 }, children: (chosen.pages && chosen.pages.length ? chosen.pages : chosen.mvpFlow || []).map((p) => {
            const core = (chosen.corePages || chosen.mvpFlow || []).includes(p);
            const on = selPages.includes(p);
            return /* @__PURE__ */ jsxs("label", { style: { display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, borderRadius: 10, cursor: "pointer", background: on ? "var(--accent-bg, rgba(99,102,241,.06))" : "var(--card)" }, children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "checkbox",
                  checked: on,
                  style: { marginTop: 3 },
                  onChange: () => setSelPages((s) => s.includes(p) ? s.filter((x) => x !== p) : [...s, p])
                }
              ),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: ".86rem" }, children: p }),
                /* @__PURE__ */ jsx("div", { style: { fontSize: ".72rem", color: "var(--sub)" }, children: core ? "Core page" : "Add-on" })
              ] })
            ] }, p);
          }) }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx("span", { style: { fontSize: ".62rem", fontWeight: 700, letterSpacing: ".08em", color: "var(--sub)" }, children: "BUILDS" }),
            /* @__PURE__ */ jsx(Flow, { pages: orderedSelected() })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: mapFunnel, disabled: loading || !orderedSelected().length, children: loading ? isWeb ? "Mapping the website…" : "Mapping the funnel…" : T.map }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: () => setSelPages(chosen.corePages || chosen.mvpFlow || []), children: "Reset to MVP" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-ghost", onClick: () => setStage("options"), children: "← Back" })
          ] })
        ] })
      ] }),
      stage === "build" && build && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "page-title", children: build.funnelName }),
            /* @__PURE__ */ jsx("div", { className: "page-sub", style: { marginTop: 4 }, children: build.flow })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }, children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 4, marginRight: 4 }, title: "Teach the Architect whether this build resonated", children: [
              /* @__PURE__ */ jsx(
                "button",
                {
                  className: "btn btn-ghost btn-sm",
                  onClick: () => thumb("up"),
                  style: { padding: "4px 8px", color: feedback === "up" ? "var(--accent)" : "var(--sub)", background: feedback === "up" ? "color-mix(in srgb, var(--accent) 12%, transparent)" : void 0 },
                  children: "👍"
                }
              ),
              /* @__PURE__ */ jsx(
                "button",
                {
                  className: "btn btn-ghost btn-sm",
                  onClick: () => thumb("down"),
                  style: { padding: "4px 8px", color: feedback === "down" ? "var(--danger)" : "var(--sub)", background: feedback === "down" ? "color-mix(in srgb, var(--danger) 12%, transparent)" : void 0 },
                  children: "👎"
                }
              )
            ] }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => setStage("pages"), children: "← Pages" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: copySheet, children: "Copy as text" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: () => downloadPDF(ctx, build, isWeb), children: "Download PDF" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-primary btn-sm", onClick: saveToLibrary, disabled: saving, children: saving ? "Saving…" : "Save to Library" })
          ] })
        ] }),
        build.watchOut && /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: "12px 16px", marginBottom: 16, borderLeft: "3px solid var(--danger)" }, children: [
          /* @__PURE__ */ jsx("span", { style: { fontSize: ".66rem", fontWeight: 700, letterSpacing: ".08em", color: "var(--danger)" }, children: "WATCH OUT" }),
          /* @__PURE__ */ jsx("div", { style: { fontSize: ".86rem", marginTop: 2 }, children: build.watchOut })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "section-title", style: { marginTop: 4 }, children: isWeb ? "Page-by-page plan" : "Customer journey" }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }, children: (build.journey || []).map((j, i) => /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 16 }, children: [
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }, children: [
            /* @__PURE__ */ jsx("span", { style: { width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".75rem", fontWeight: 800, flexShrink: 0 }, children: i + 1 }),
            /* @__PURE__ */ jsx("div", { style: { fontWeight: 800, fontSize: "1rem" }, children: j.page })
          ] }),
          /* @__PURE__ */ jsx(JRow, { label: "Mindset", value: j.mindset }),
          /* @__PURE__ */ jsx(JRow, { label: "Page job", value: j.pageJob }),
          (j.mustHave || []).length > 0 && /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 12, padding: "6px 0", borderTop: "1px solid var(--border)" }, children: [
            /* @__PURE__ */ jsx("div", { style: { width: 92, flexShrink: 0, fontSize: ".64rem", fontWeight: 700, letterSpacing: ".05em", color: "var(--sub)", paddingTop: 2 }, children: "MUST HAVE" }),
            /* @__PURE__ */ jsx("ul", { style: { margin: 0, paddingLeft: 18, fontSize: ".85rem", lineHeight: 1.5 }, children: j.mustHave.map((m, k) => /* @__PURE__ */ jsx("li", { children: m }, k)) })
          ] }),
          /* @__PURE__ */ jsx(JRow, { label: "Button", value: j.button, strong: true }),
          /* @__PURE__ */ jsx(JRow, { label: "Drop-off", value: j.dropOff, danger: true })
        ] }, i)) }),
        (build.pageCopy || []).length > 0 && (() => {
          const total = build.pageCopy.length;
          const idx = Math.min(copyIdx, total - 1);
          const p = build.pageCopy[idx];
          return /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", margin: "4px 0 10px" }, children: [
              /* @__PURE__ */ jsxs("div", { className: "section-title", style: { margin: 0 }, children: [
                "Page copy ",
                /* @__PURE__ */ jsxs("span", { style: { fontSize: ".66rem", color: "var(--sub)", fontWeight: 600 }, children: [
                  "· ",
                  idx + 1,
                  " of ",
                  total
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
                /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", disabled: idx === 0, onClick: () => setCopyIdx(idx - 1), children: "‹ Prev" }),
                /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", disabled: idx >= total - 1, onClick: () => setCopyIdx(idx + 1), children: "Next ›" }),
                /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: rewriteCopy, disabled: rewriting, children: rewriting ? "Rewriting…" : "↻ Rewrite copy" }),
                /* @__PURE__ */ jsx("button", { className: "btn btn-primary btn-sm", onClick: () => previewPage(p), disabled: preview == null ? void 0 : preview.loading, children: (preview == null ? void 0 : preview.loading) && (preview == null ? void 0 : preview.page) === p.page ? "Rendering…" : "🖥 Preview page" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0, overflow: "hidden", marginBottom: 14, opacity: rewriting ? 0.55 : 1, transition: "opacity .15s" }, children: [
              /* @__PURE__ */ jsxs("div", { style: { padding: "20px 24px", background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--card)), var(--card))", borderBottom: "1px solid var(--border)" }, children: [
                /* @__PURE__ */ jsx(Chip, { color: "#0EA5E9", children: p.badge || p.page }),
                /* @__PURE__ */ jsx("div", { style: { fontWeight: 800, fontSize: "1.35rem", margin: "12px 0 8px", lineHeight: 1.25, letterSpacing: "-.01em" }, children: p.headline }),
                p.subhead && /* @__PURE__ */ jsx("div", { style: { color: "var(--sub)", fontSize: ".95rem", lineHeight: 1.5, maxWidth: 640 }, children: p.subhead })
              ] }),
              /* @__PURE__ */ jsxs("div", { style: { padding: "18px 24px" }, children: [
                (p.bullets || []).length > 0 && /* @__PURE__ */ jsx("ul", { style: { margin: "0 0 16px", paddingLeft: 4, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }, children: p.bullets.map((b, k) => /* @__PURE__ */ jsxs("li", { style: { display: "flex", gap: 10, fontSize: ".9rem", lineHeight: 1.5 }, children: [
                  /* @__PURE__ */ jsx("span", { style: { color: "var(--accent)", fontWeight: 800, flexShrink: 0 }, children: "✓" }),
                  /* @__PURE__ */ jsx("span", { children: b })
                ] }, k)) }),
                (p.formFields || []).length > 0 && /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }, children: p.formFields.map((f, k) => /* @__PURE__ */ jsx("span", { style: { fontSize: ".8rem", padding: "9px 14px", border: "1px dashed var(--border)", borderRadius: 8, color: "var(--sub)", background: "var(--surface)", minWidth: 140 }, children: f }, k)) }),
                p.button && /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("span", { className: "btn btn-primary", style: { pointerEvents: "none", fontSize: ".95rem", padding: "11px 22px" }, children: p.button }) }),
                p.testimonial && /* @__PURE__ */ jsx("div", { style: { marginTop: 16, paddingLeft: 14, borderLeft: "3px solid var(--accent)", fontStyle: "italic", color: "var(--sub)", fontSize: ".86rem", lineHeight: 1.5 }, children: p.testimonial })
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", gap: 6, marginBottom: 24 }, children: build.pageCopy.map((_, k) => /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => setCopyIdx(k),
                "aria-label": `Page ${k + 1}`,
                style: { width: k === idx ? 22 : 8, height: 8, borderRadius: 99, border: "none", cursor: "pointer", padding: 0, background: k === idx ? "var(--accent)" : "var(--border)", transition: "width .15s, background .15s" }
              },
              k
            )) })
          ] });
        })(),
        /* @__PURE__ */ jsxs("div", { className: "section-title", children: [
          "GHL automation map ",
          /* @__PURE__ */ jsxs("span", { style: { fontSize: ".66rem", color: "var(--sub)", fontWeight: 600 }, children: [
            "· ",
            (build.workflows || []).length,
            " workflows"
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { style: { display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }, children: (build.workflows || []).map((w, i) => /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 0, overflow: "hidden" }, children: [
          /* @__PURE__ */ jsxs("div", { style: { background: "var(--text)", color: "var(--card)", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx("span", { style: { fontWeight: 800, fontSize: ".9rem" }, children: w.name }),
            /* @__PURE__ */ jsxs("span", { style: { fontSize: ".68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,.14)" }, children: [
              "Trigger: ",
              w.trigger
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { children: (w.steps || []).map((s, k) => /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 12, alignItems: "flex-start", padding: "9px 14px", borderTop: "1px solid var(--border)" }, children: [
            /* @__PURE__ */ jsx("span", { style: { width: 82, flexShrink: 0, textAlign: "center", fontSize: ".62rem", fontWeight: 800, letterSpacing: ".04em", padding: "3px 0", borderRadius: 6, background: `${stepColor(s.type)}22`, color: stepColor(s.type) }, children: String(s.type).toUpperCase() }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: ".85rem", lineHeight: 1.45 }, children: s.text })
          ] }, k)) })
        ] }, i)) }),
        /* @__PURE__ */ jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 12, marginBottom: 24 }, children: [
          /* @__PURE__ */ jsx(SetupCol, { title: "TAGS TO CREATE", items: build.tagsToCreate, color: "#8B5CF6" }),
          /* @__PURE__ */ jsx(SetupCol, { title: "CUSTOM FIELDS", items: build.customFields, color: "#0EA5E9" }),
          /* @__PURE__ */ jsx(SetupCol, { title: "PIPELINE STAGES", items: build.pipelineStages, color: "#6366F1", arrow: true })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "fw-700", children: "Take the whole build with you" }),
            /* @__PURE__ */ jsx("div", { style: { fontSize: ".8rem", color: "var(--sub)" }, children: "One sheet with the funnel build and the automation build, ready to send or work from." })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: copySheet, children: "Copy as text" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: () => downloadPDF(ctx, build, isWeb), children: "Download the PDF" })
          ] })
        ] })
      ] }),
      loading && (stage === "options" || stage === "pages") && /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, color: "var(--sub)", padding: "18px 0" }, children: [
        /* @__PURE__ */ jsx("div", { className: "spinner" }),
        " Working…"
      ] })
    ] }),
    preview && /* @__PURE__ */ jsx(
      "div",
      {
        onClick: () => setPreview(null),
        style: { position: "fixed", inset: 0, background: "rgba(2,6,23,.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
        children: /* @__PURE__ */ jsxs(
          "div",
          {
            onClick: (e) => e.stopPropagation(),
            style: { background: "var(--card)", borderRadius: 14, width: "min(1040px, 96vw)", height: "min(88vh, 940px)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.45)" },
            children: [
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)" }, children: [
                /* @__PURE__ */ jsxs("div", { style: { fontWeight: 700 }, children: [
                  preview.page,
                  " ",
                  /* @__PURE__ */ jsx("span", { style: { fontSize: ".76rem", color: "var(--sub)", fontWeight: 500 }, children: "· page preview" })
                ] }),
                /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 10, alignItems: "center" }, children: [
                  preview.loading && /* @__PURE__ */ jsxs("span", { style: { fontSize: ".78rem", color: "var(--sub)" }, children: [
                    (preview.chars || 0).toLocaleString(),
                    " chars…"
                  ] }),
                  /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => setPreview(null), children: "Close" })
                ] })
              ] }),
              /* @__PURE__ */ jsx("div", { style: { flex: 1, minHeight: 0, background: "#fff" }, children: preview.error ? /* @__PURE__ */ jsx("div", { style: { padding: 24, color: "var(--danger)" }, children: preview.error }) : preview.loading && !preview.html ? /* @__PURE__ */ jsxs("div", { style: { height: "100%", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: "center", color: "var(--sub)" }, children: [
                /* @__PURE__ */ jsx("div", { className: "spinner" }),
                " Rendering the page…"
              ] }) : /* @__PURE__ */ jsx("iframe", { title: "page preview", srcDoc: preview.html || "", style: { width: "100%", height: "100%", border: "none" }, sandbox: "allow-same-origin" }) })
            ]
          }
        )
      }
    )
  ] });
}
function Stepper({ stage }) {
  const steps = ["Offer", "Options", "Pages", "Build"];
  const idx = { intake: 0, options: 1, pages: 2, build: 3 }[stage] ?? 0;
  return /* @__PURE__ */ jsx("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 22, flexWrap: "wrap" }, children: steps.map((s, i) => /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 6 }, children: [
    /* @__PURE__ */ jsxs("span", { style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "5px 12px 5px 6px",
      borderRadius: 99,
      background: i <= idx ? "var(--accent)" : "var(--surface)",
      color: i <= idx ? "#fff" : "var(--sub)",
      border: i <= idx ? "1px solid transparent" : "1px solid var(--border)",
      fontSize: ".76rem",
      fontWeight: 700,
      transition: "all .15s"
    }, children: [
      /* @__PURE__ */ jsx("span", { style: { width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: i <= idx ? "rgba(255,255,255,.22)" : "var(--border)", fontSize: ".68rem" }, children: i < idx ? "✓" : i + 1 }),
      s
    ] }),
    i < steps.length - 1 && /* @__PURE__ */ jsx("span", { style: { width: 18, height: 2, borderRadius: 2, background: i < idx ? "var(--accent)" : "var(--border)" } })
  ] }, s)) });
}
function JRow({ label, value, strong, danger }) {
  if (!value) return null;
  return /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 12, padding: "6px 0", borderTop: "1px solid var(--border)" }, children: [
    /* @__PURE__ */ jsx("div", { style: { width: 92, flexShrink: 0, fontSize: ".64rem", fontWeight: 700, letterSpacing: ".05em", color: "var(--sub)", paddingTop: 2 }, children: label.toUpperCase() }),
    /* @__PURE__ */ jsx("div", { style: { fontSize: ".85rem", lineHeight: 1.5, fontWeight: strong ? 700 : 400, color: danger ? "var(--danger)" : "var(--text)" }, children: value })
  ] });
}
function SetupCol({ title, items, color, arrow }) {
  if (!items || !items.length) return null;
  return /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 14 }, children: [
    /* @__PURE__ */ jsx("div", { style: { fontSize: ".62rem", fontWeight: 700, letterSpacing: ".08em", color: "var(--sub)", marginBottom: 8 }, children: title }),
    /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }, children: items.map((t, i) => /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 6 }, children: [
      /* @__PURE__ */ jsx("span", { style: { fontSize: ".72rem", fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: `${color}18`, color, border: `1px solid ${color}33` }, children: t }),
      arrow && i < items.length - 1 && /* @__PURE__ */ jsx("span", { style: { color: "var(--sub)" }, children: "→" })
    ] }, i)) })
  ] });
}
export {
  FunnelArchitect as default
};
