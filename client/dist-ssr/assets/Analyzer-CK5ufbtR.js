import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { g as getLocationId, u as useAIConfig, a as api } from "../entry-server.mjs";
import { n as notifySuccess, a as notifyError } from "./toast-DrUOosTv.js";
import "node:async_hooks";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-toastify";
function renderMarkdown(text) {
  const lines = (text || "").split("\n");
  const out = [];
  let list = [];
  const flush = (key) => {
    if (list.length) {
      out.push(/* @__PURE__ */ jsx("ul", { style: { margin: "4px 0 12px", paddingLeft: 20 }, children: list }, `ul-${key}`));
      list = [];
    }
  };
  const inline = (s) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) => /^\*\*[^*]+\*\*$/.test(p) ? /* @__PURE__ */ jsx("strong", { children: p.slice(2, -2) }, i) : /* @__PURE__ */ jsx("span", { children: p }, i));
  };
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, "");
    if (/^##\s+/.test(line)) {
      flush(i);
      out.push(/* @__PURE__ */ jsx("h3", { style: { fontSize: "1rem", fontWeight: 800, color: "var(--text)", margin: "20px 0 8px" }, children: line.replace(/^##\s+/, "") }, i));
    } else if (/^#\s+/.test(line)) {
      flush(i);
      out.push(/* @__PURE__ */ jsx("h2", { style: { fontSize: "1.15rem", fontWeight: 800, color: "var(--text)", margin: "22px 0 8px" }, children: line.replace(/^#\s+/, "") }, i));
    } else if (/^[-*]\s+/.test(line)) {
      list.push(/* @__PURE__ */ jsx("li", { style: { marginBottom: 4, lineHeight: 1.5 }, children: inline(line.replace(/^[-*]\s+/, "")) }, i));
    } else if (line.trim() === "") {
      flush(i);
    } else {
      flush(i);
      out.push(/* @__PURE__ */ jsx("p", { style: { margin: "0 0 10px", lineHeight: 1.6 }, children: inline(line) }, i));
    }
  });
  flush("end");
  return out;
}
function Analyzer() {
  const navigate = useNavigate();
  const locationId = getLocationId();
  const { config, loading: configLoading } = useAIConfig();
  const [transcript, setTranscript] = useState("");
  const [clientName, setClientName] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef(null);
  const TEXT_EXTS = ["txt", "vtt", "srt", "md", "csv", "rtf", "json", "html", "htm", "log"];
  async function onFile(e) {
    var _a;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    if (!file) return;
    setFileName(file.name);
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (TEXT_EXTS.includes(ext)) {
      const reader = new FileReader();
      reader.onload = () => setTranscript((prev) => appendText(prev, String(reader.result || "")));
      reader.readAsText(file);
      return;
    }
    setExtracting(true);
    try {
      const { text, chars } = await api.extractFile(file);
      setTranscript((prev) => appendText(prev, text));
      notifySuccess(`Extracted ${chars.toLocaleString()} characters from ${file.name}`);
    } catch (err) {
      notifyError(err.message || "Could not read that file");
      setFileName("");
    } finally {
      setExtracting(false);
      e.target.value = "";
    }
  }
  function appendText(prev, next) {
    const a = (prev || "").trim();
    return a ? `${a}

${next}` : next;
  }
  async function analyze() {
    if (!transcript.trim()) {
      notifyError("Add a transcript, notes, summary, or a file first");
      return;
    }
    if (!(config == null ? void 0 : config.apiKey)) {
      notifyError("Connect an AI provider in Settings first");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      await api.analyzeTranscriptStream(
        { transcript, clientName, provider: config.provider, apiKey: config.apiKey, model: config.model },
        { onChunk: (_c, full) => setResult(full) }
      );
    } catch (e) {
      notifyError(e.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  }
  function copyResult() {
    var _a;
    (_a = navigator.clipboard) == null ? void 0 : _a.writeText(result).then(() => notifySuccess("Brief copied")).catch(() => {
    });
  }
  function buildFunnel() {
    const material = [transcript.trim(), result.trim() ? `PROJECT BRIEF:
${result.trim()}` : ""].filter(Boolean).join("\n\n");
    const u = new URL("/architect", window.location.origin);
    if (locationId) u.searchParams.set("locationId", locationId);
    navigate(u.pathname + u.search, { state: { notes: material, auto: true } });
  }
  async function saveToLibrary() {
    if (!result.trim()) return;
    setSaving(true);
    try {
      let customerId = "_unsorted", customerName = "";
      const name = clientName.trim();
      if (name) {
        const custs = await api.getCustomers().catch(() => []);
        const existing = (Array.isArray(custs) ? custs : []).find((c) => (c.name || "").toLowerCase() === name.toLowerCase());
        const cust = existing || await api.createCustomer(name);
        if (cust == null ? void 0 : cust.id) {
          customerId = cust.id;
          customerName = cust.name;
        }
      }
      const title = `Project Brief — ${name || (/* @__PURE__ */ new Date()).toLocaleDateString()}`;
      const copy = await api.saveCopy({
        customerId,
        customerName,
        type: "general",
        title,
        preview: result.replace(/[#*]/g, "").slice(0, 120),
        messages: [
          { role: "user", content: "Analyze this into a project brief." },
          { role: "assistant", content: result }
        ]
      });
      notifySuccess("Brief saved to Library");
      if (copy == null ? void 0 : copy.id) {
        const u = new URL(`/library/${customerId}/${copy.id}`, window.location.origin);
        if (locationId) u.searchParams.set("locationId", locationId);
        navigate(u.pathname + u.search);
      }
    } catch (e) {
      notifyError(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "topnav", children: /* @__PURE__ */ jsx("div", { className: "topnav-left", children: /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Analyzer" }) }) }),
    /* @__PURE__ */ jsxs("div", { className: "content", style: { maxWidth: 900 }, children: [
      /* @__PURE__ */ jsx("div", { className: "page-header", children: /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "page-title", children: "Transcript Analyzer" }),
        /* @__PURE__ */ jsx("div", { className: "page-sub", children: "Turn a call/Zoom transcript into a build-ready project brief" })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 18, marginBottom: 18, display: "flex", flexDirection: "column", gap: 12 }, children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", style: { margin: 0 }, children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Client name (optional)" }),
          /* @__PURE__ */ jsx("input", { className: "form-input", value: clientName, onChange: (e) => setClientName(e.target.value), placeholder: "e.g. Trevor Brooks" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", style: { margin: 0 }, children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Transcript, notes, or summary" }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              className: "form-input",
              style: { minHeight: 180, resize: "vertical", fontFamily: "inherit" },
              value: transcript,
              onChange: (e) => setTranscript(e.target.value),
              placeholder: "Paste the Zoom/call transcript, your meeting notes, or a summary — or upload a file below…"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              ref: fileRef,
              type: "file",
              accept: ".pdf,.docx,.txt,.vtt,.srt,.md,.csv,.rtf,.json,.html,.htm,.log,application/pdf",
              onChange: onFile,
              style: { display: "none" }
            }
          ),
          /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: () => {
            var _a;
            return (_a = fileRef.current) == null ? void 0 : _a.click();
          }, disabled: extracting, children: extracting ? "Reading file…" : "Upload file (PDF, Word, text)" }),
          fileName && !extracting && /* @__PURE__ */ jsx("span", { style: { fontSize: ".8rem", color: "var(--sub)" }, children: fileName }),
          /* @__PURE__ */ jsx(
            "button",
            {
              className: "btn btn-primary",
              style: { marginLeft: "auto" },
              onClick: analyze,
              disabled: loading || extracting || configLoading || !transcript.trim(),
              children: loading ? "Analyzing…" : "Analyze"
            }
          )
        ] })
      ] }),
      (loading || result) && /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: "20px 24px" }, children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }, children: [
          /* @__PURE__ */ jsx("div", { className: "fw-700", style: { fontSize: ".95rem" }, children: "Project Brief" }),
          result && !loading && /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: copyResult, children: "Copy" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: buildFunnel, children: "Build funnel from this →" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-primary btn-sm", onClick: saveToLibrary, disabled: saving, children: saving ? "Saving…" : "Save to Library" })
          ] })
        ] }),
        loading && !result ? /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, color: "var(--sub)", padding: "12px 0" }, children: [
          /* @__PURE__ */ jsx("div", { className: "spinner" }),
          " Reading the transcript and building the brief…"
        ] }) : /* @__PURE__ */ jsx("div", { style: { fontSize: ".9rem", color: "var(--text)" }, children: renderMarkdown(result) })
      ] })
    ] })
  ] });
}
export {
  Analyzer as default
};
