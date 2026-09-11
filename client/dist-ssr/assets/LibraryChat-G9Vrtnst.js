import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { g as getLocationId, u as useAIConfig, a as api } from "../entry-server.mjs";
import { a as TYPES } from "./types-nNhWZ2i7.js";
import { P as PROVIDERS } from "./providers-eVryj-46.js";
import { c as confirmToast, n as notifySuccess } from "./toast-DrUOosTv.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-toastify";
const STATUS_OPTS = [
  { value: "draft", label: "Draft", color: "#64748B", bg: "rgba(100,116,139,.14)" },
  { value: "in-progress", label: "In Progress", color: "#2563EB", bg: "rgba(37,99,235,.14)" },
  { value: "completed", label: "Completed", color: "#16A34A", bg: "rgba(22,163,74,.14)" }
];
const STATUS_META = Object.fromEntries(STATUS_OPTS.map((s) => [s.value, s]));
function mockupEstimate(mode, type, copyLength) {
  if (mode !== "ai") return null;
  let base = type === "webinar" ? 22 : copyLength === "short" ? Math.round(30 * 0.65) : 30;
  return { low: Math.max(8, Math.round(base * 0.6)), high: Math.round(base * 1.6) };
}
function mockupTargetChars(type, copyLength) {
  if (type === "webinar") return 9e3;
  return copyLength === "short" ? 8e3 : 14e3;
}
function webinarLandingContent(messages) {
  var _a;
  const assistants = (messages || []).filter((m) => m.role === "assistant" && m.content);
  const re = /reserve|what\s*you'?ll\s*learn|free to attend|save (my|your) (seat|spot)|register (now|free)|100% free/i;
  const landing = [...assistants].reverse().find((m) => re.test(m.content));
  return (landing == null ? void 0 : landing.content) || ((_a = assistants[assistants.length >= 2 ? 1 : 0]) == null ? void 0 : _a.content) || "";
}
function useAutoResize(ref) {
  return function resize() {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = Math.min(ref.current.scrollHeight, 160) + "px";
  };
}
function cleanDisplayText(text) {
  const JUNK_LINE = [
    /\[ON[\s-]?SCREEN/i,
    /\bon[\s-]?screen\s*text\b/i,
    /^\(?visual\s*:/i,
    /^\(?(?:pause|beat|hold|cut to|fade in|fade out)\)?\.?$/i,
    /^segment\s*\d*\s*[:\-—]/i,
    /^target\s*(?:length|duration|runtime)\s*:/i,
    /^format\s*:\s*(?:talking|video|slideshow|b[\s-]roll)/i,
    /\btalking[\s-]head\b/i,
    /\bb[\s-]roll\b/i,
    /\bword[\s-]for[\s-]word script\b/i,
    /^vsl\s*script\b/i
  ];
  return text.split("\n").map(
    (line) => line.replace(/\*{0,3}\s*\[ON[\s-]?SCREEN[^\]\n]*\]\s*\*{0,3}/gi, "").replace(/\*{0,3}\s*\(?Visual:[^*\n]*?\)?\s*\*{0,3}/gi, "").replace(/\*{0,3}\s*\((?:Pause|Beat|Hold)\)\s*\*{0,3}/gi, "")
  ).filter((line) => {
    const raw = line.trim();
    if (raw === "---" || /^-{3,}$/.test(raw)) return false;
    if (!raw) return true;
    const plain = raw.replace(/^#+\s+/, "").replace(/^\*{1,3}|\*{1,3}$/g, "").replace(/^\[|\]$/g, "").trim();
    return !JUNK_LINE.some((re) => re.test(plain));
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function ThumbUpIcon() {
  return /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "14", height: "14", children: [
    /* @__PURE__ */ jsx("path", { d: "M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" }),
    /* @__PURE__ */ jsx("path", { d: "M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" })
  ] });
}
function ThumbDownIcon() {
  return /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "14", height: "14", children: [
    /* @__PURE__ */ jsx("path", { d: "M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" }),
    /* @__PURE__ */ jsx("path", { d: "M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" })
  ] });
}
function MsgBubble({ msg, isLast, onFeedback, feedback, onMockup, onGeneratePrompt, showPreview }) {
  const [copied, setCopied] = useState(false);
  const isAI = msg.role === "assistant";
  const hasContent = msg.content.length > 60;
  const displayContent = isAI ? cleanDisplayText(msg.content) : msg.content;
  function copy() {
    navigator.clipboard.writeText(displayContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    });
  }
  return /* @__PURE__ */ jsxs("div", { className: `msg-row ${msg.role === "user" ? "user" : ""}`, children: [
    /* @__PURE__ */ jsx("div", { className: `msg-avatar ${isAI ? "ai" : "user-av"}`, children: isAI ? "✦" : "Y" }),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("div", { className: `msg-bubble ${isAI ? "ai" : "user"}`, children: displayContent }),
      isAI && hasContent && /* @__PURE__ */ jsxs("div", { className: "msg-actions", children: [
        isLast && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("button", { className: "action-btn", onClick: copy, children: copied ? "Copied!" : "Copy to clipboard" }),
          showPreview && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("button", { className: "action-btn mockup-btn", onClick: onMockup, children: "Preview Mockup" }),
            /* @__PURE__ */ jsx("button", { className: "action-btn ghl-prompt-btn", onClick: () => onGeneratePrompt(msg.content), children: "Generate Prompt" })
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: `action-btn thumb-btn ${feedback === "up" ? "thumb-up-active" : ""}`,
            onClick: () => onFeedback("up"),
            title: "Good copy — trains brand voice",
            children: /* @__PURE__ */ jsx(ThumbUpIcon, {})
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: `action-btn thumb-btn ${feedback === "down" ? "thumb-down-active" : ""}`,
            onClick: () => onFeedback("down"),
            title: "Not right — avoid this style",
            children: /* @__PURE__ */ jsx(ThumbDownIcon, {})
          }
        )
      ] })
    ] })
  ] });
}
function LibraryChat() {
  var _a;
  const { customerId, copyId } = useParams();
  const navigate = useNavigate();
  const locationId = getLocationId();
  const { config, loading: configLoading } = useAIConfig();
  const isUnsorted = customerId === "_unsorted";
  const [copy, setCopy] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [showDots, setShowDots] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`lib_fb_${copyId}`) || "{}");
    } catch {
      return {};
    }
  });
  const [mockup, setMockup] = useState(null);
  const [mockupMode, setMockupMode] = useState("ai");
  const [mockupChars, setMockupChars] = useState(0);
  const [mockupElapsed, setMockupElapsed] = useState(0);
  const [copyLength, setCopyLength] = useState("long");
  const [autoCycle, setAutoCycle] = useState(false);
  const [cycleCountdown, setCycleCountdown] = useState(0);
  const cycleTimerRef = useRef(null);
  const countdownRef = useRef(null);
  const [ghlPrompt, setGhlPrompt] = useState(null);
  const [ghlPromptCopied, setGhlPromptCopied] = useState(false);
  const [voiceInfo, setVoiceInfo] = useState(null);
  const [showVoiceDetail, setShowVoiceDetail] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const readerRef = useRef(null);
  const stoppedRef = useRef(false);
  function stopStreaming() {
    var _a2;
    stoppedRef.current = true;
    try {
      (_a2 = readerRef.current) == null ? void 0 : _a2.cancel();
    } catch {
    }
  }
  const resize = useAutoResize(textareaRef);
  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    api.getCopy(copyId).then((c) => {
      if (!c) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      setCopy(c);
      setMessages(c.messages || []);
      setLoading(false);
    }).catch(() => {
      setLoadError(true);
      setLoading(false);
    });
  }, [copyId]);
  useEffect(() => {
    var _a2;
    (_a2 = bottomRef.current) == null ? void 0 : _a2.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, showDots]);
  useEffect(() => {
    if (autoCycle && mockup && !mockup.loading && mockup.html && !mockup.error) {
      const DELAY = 20;
      setCycleCountdown(DELAY);
      countdownRef.current = setInterval(() => {
        setCycleCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1e3);
      const prevStyle = mockup.style;
      cycleTimerRef.current = setTimeout(() => {
        const lastAiMsg = [...messages].reverse().find((m) => m.role === "assistant");
        if (lastAiMsg) handleMockup(cleanDisplayText(lastAiMsg.content), "ai", prevStyle);
      }, DELAY * 1e3);
    }
    return () => {
      clearTimeout(cycleTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [autoCycle, mockup == null ? void 0 : mockup.html, mockup == null ? void 0 : mockup.loading]);
  useEffect(() => {
    if (!(mockup == null ? void 0 : mockup.loading)) return;
    setMockupElapsed(0);
    const started = Date.now();
    const iv = setInterval(() => setMockupElapsed(Math.floor((Date.now() - started) / 1e3)), 500);
    return () => clearInterval(iv);
  }, [mockup == null ? void 0 : mockup.loading]);
  useEffect(() => {
    if (!mockup) {
      setAutoCycle(false);
      clearTimeout(cycleTimerRef.current);
      clearInterval(countdownRef.current);
    }
  }, [mockup]);
  useEffect(() => {
    try {
      localStorage.setItem(`lib_fb_${copyId}`, JSON.stringify(feedbackMap));
    } catch {
    }
  }, [feedbackMap, copyId]);
  useEffect(() => {
    if (!locationId) return;
    api.getBrandVoice().then((data) => {
      var _a2;
      if ((_a2 = data == null ? void 0 : data.voice) == null ? void 0 : _a2.profile) setVoiceInfo(data.voice);
      else setVoiceInfo(false);
    }).catch(() => setVoiceInfo(false));
  }, [locationId]);
  function goBack() {
    const u = new URL(`/library/${customerId}`, window.location.origin);
    if (locationId) u.searchParams.set("locationId", locationId);
    navigate(u.pathname + u.search);
  }
  async function autoSave(msgs) {
    if (!copy) return;
    setSaveStatus("saving");
    await api.updateCopy(copyId, { messages: msgs });
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus(""), 2e3);
  }
  async function handleMockup(content, mode, avoidStyle = null) {
    if (((copy == null ? void 0 : copy.type) || "") === "webinar") {
      const landing = webinarLandingContent(messages);
      if (landing) content = landing;
    }
    setMockupMode(mode);
    setMockupChars(0);
    setMockup({ loading: true, mode, html: null, error: null });
    try {
      if (mode === "ai") {
        const result = await api.generateMockupStream(
          { copy: content, type: (copy == null ? void 0 : copy.type) || "general", mode, copyLength, provider: config == null ? void 0 : config.provider, apiKey: config == null ? void 0 : config.apiKey, model: config == null ? void 0 : config.model, avoidStyle },
          { onChunk: (chunk) => setMockupChars((n) => n + chunk.length) }
        );
        if (result == null ? void 0 : result.html) {
          setMockup({ html: result.html, mode, loading: false, error: null, style: result.style });
        } else {
          setMockup({ html: null, mode, loading: false, error: "No HTML returned" });
        }
      } else {
        const result = await api.generateMockup({
          copy: content,
          type: (copy == null ? void 0 : copy.type) || "general",
          mode,
          copyLength,
          provider: config == null ? void 0 : config.provider,
          apiKey: config == null ? void 0 : config.apiKey,
          model: config == null ? void 0 : config.model
        });
        if (result.html) {
          setMockup({ html: result.html, mode, loading: false, error: null });
        } else {
          setMockup({ html: null, mode, loading: false, error: result.error || "No HTML returned" });
        }
      }
    } catch (e) {
      setMockup({ html: null, mode, loading: false, error: e.message || "Request failed" });
    }
  }
  async function handleGeneratePrompt(content, html) {
    setGhlPromptCopied(false);
    setGhlPrompt({ loading: true, text: null, error: null });
    try {
      const result = await api.generateGhlPrompt({
        copy: cleanDisplayText(content),
        html: html || null,
        provider: config == null ? void 0 : config.provider,
        apiKey: config == null ? void 0 : config.apiKey,
        model: config == null ? void 0 : config.model
      });
      if (result.prompt) {
        setGhlPrompt({ loading: false, text: result.prompt, error: null });
      } else {
        setGhlPrompt({ loading: false, text: null, error: result.error || "Failed to generate prompt" });
      }
    } catch (e) {
      setGhlPrompt({ loading: false, text: null, error: e.message || "Request failed" });
    }
  }
  function handleFeedback(msgIndex, sentiment) {
    var _a2;
    const prev = feedbackMap[msgIndex];
    if (prev === sentiment) return;
    setFeedbackMap((m) => ({ ...m, [msgIndex]: sentiment }));
    const text = ((_a2 = messages[msgIndex]) == null ? void 0 : _a2.content) || "";
    const type = (copy == null ? void 0 : copy.type) || "general";
    api.addCopyFeedback({ type, text, sentiment }).catch(() => {
    });
  }
  async function send() {
    const text = input.trim();
    if (!text || streaming || !copy) return;
    if (!configLoading && !config) {
      const u = new URL("/settings", window.location.origin);
      if (locationId) u.searchParams.set("locationId", locationId);
      navigate(u.pathname + u.search);
      return;
    }
    const userMsg = { role: "user", content: text };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setStreaming(true);
    setShowDots(true);
    setStreamText("");
    stoppedRef.current = false;
    let accumulated = "";
    let committed = false;
    const commit = async (content) => {
      if (committed || !content) return;
      committed = true;
      const finalMsgs = [...allMsgs, { role: "assistant", content }];
      setMessages(finalMsgs);
      await autoSave(finalMsgs);
    };
    function sanitize(msgs) {
      const cleaned = msgs.filter((m) => m.content && !m.content.startsWith("Sorry, something went wrong") && !m.content.startsWith("Error:")).reduce((acc, m) => {
        if (acc.length && acc[acc.length - 1].role === m.role) {
          acc[acc.length - 1] = { ...acc[acc.length - 1], content: acc[acc.length - 1].content + "\n" + m.content };
        } else {
          acc.push(m);
        }
        return acc;
      }, []);
      while (cleaned.length && cleaned[0].role === "assistant") cleaned.shift();
      return cleaned;
    }
    try {
      const resp = await fetch("/copywrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: copy.type,
          locationId,
          messages: sanitize(allMsgs).map((m) => ({ role: m.role, content: m.content })),
          provider: config == null ? void 0 : config.provider,
          apiKey: config == null ? void 0 : config.apiKey,
          model: config == null ? void 0 : config.model
        })
      });
      if (!resp.ok) {
        let errMsg = "Request failed";
        try {
          const j = await resp.json();
          errMsg = j.error || errMsg;
        } catch {
        }
        throw new Error(errMsg);
      }
      const reader = resp.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let errorText = "";
      let firstToken = true;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") break;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) {
              errorText = parsed.error;
            } else if (parsed.text) {
              if (firstToken) {
                setShowDots(false);
                firstToken = false;
              }
              accumulated += parsed.text;
              setStreamText(accumulated);
            }
          } catch {
          }
        }
      }
      if (errorText && !accumulated) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${errorText}` }]);
        return;
      }
      await commit(accumulated);
    } catch (e) {
      if (stoppedRef.current) {
        await commit(accumulated);
        if (!accumulated) setMessages((prev) => prev.slice(0, -1));
      } else {
        setSaveStatus((e == null ? void 0 : e.message) || "Something went wrong. Check your AI settings.");
        setTimeout(() => setSaveStatus(""), 6e3);
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      readerRef.current = null;
      setStreamText("");
      setShowDots(false);
      setStreaming(false);
    }
  }
  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
  const typeInfo = copy ? TYPES[copy.type] || TYPES.general : TYPES.general;
  if (loading) return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "topnav", children: /* @__PURE__ */ jsxs("div", { className: "topnav-left", children: [
      /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: goBack, style: { padding: "6px 8px" }, children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "16", height: "16", children: /* @__PURE__ */ jsx("path", { d: "M19 12H5M12 19l-7-7 7-7" }) }) }),
      /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Loading…" })
    ] }) }),
    /* @__PURE__ */ jsx("div", { style: { padding: 32, display: "flex", justifyContent: "center" }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) })
  ] });
  if (loadError) return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "topnav", children: /* @__PURE__ */ jsxs("div", { className: "topnav-left", children: [
      /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: goBack, style: { padding: "6px 8px" }, children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "16", height: "16", children: /* @__PURE__ */ jsx("path", { d: "M19 12H5M12 19l-7-7 7-7" }) }) }),
      /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Error" })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "empty-state", style: { padding: 32 }, children: [
      /* @__PURE__ */ jsx("div", { className: "empty-title", children: "Could not load this copy" }),
      /* @__PURE__ */ jsx("div", { className: "empty-sub", children: "It may have been deleted, or there was a network error." }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 10, marginTop: 16 }, children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: () => {
          setLoading(true);
          setLoadError(false);
          api.getCopy(copyId).then((c) => {
            if (!c) {
              setLoadError(true);
              setLoading(false);
              return;
            }
            setCopy(c);
            setMessages(c.messages || []);
            setLoading(false);
          }).catch(() => {
            setLoadError(true);
            setLoading(false);
          });
        }, children: "Retry" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: goBack, children: "Go back" })
      ] })
    ] })
  ] });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "topnav", children: [
      /* @__PURE__ */ jsxs("div", { className: "topnav-left", children: [
        /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: goBack, style: { padding: "6px 8px" }, children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "16", height: "16", children: /* @__PURE__ */ jsx("path", { d: "M19 12H5M12 19l-7-7 7-7" }) }) }),
        /* @__PURE__ */ jsx("span", { className: "breadcrumb", children: isUnsorted ? "Unsorted" : (copy == null ? void 0 : copy.customerName) || customerId }),
        /* @__PURE__ */ jsx("span", { className: "breadcrumb-sep", children: "/" }),
        /* @__PURE__ */ jsx("span", { className: "breadcrumb-current truncate", style: { maxWidth: "30vw" }, children: (copy == null ? void 0 : copy.title) || "Untitled" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "topnav-right", style: { display: "flex", alignItems: "center", gap: 12 }, children: [
        /* @__PURE__ */ jsx(
          "select",
          {
            className: "form-input form-select",
            value: STATUS_META[copy == null ? void 0 : copy.status] ? copy.status : "in-progress",
            onChange: (e) => {
              const status = e.target.value;
              setCopy((c) => c ? { ...c, status } : c);
              api.setCopyStatus(copyId, status).catch(() => {
              });
            },
            title: "Status",
            style: {
              width: "auto",
              minHeight: "auto",
              padding: "4px 24px 4px 10px",
              fontSize: ".72rem",
              fontWeight: 700,
              color: (STATUS_META[copy == null ? void 0 : copy.status] || STATUS_META["in-progress"]).color,
              background: (STATUS_META[copy == null ? void 0 : copy.status] || STATUS_META["in-progress"]).bg,
              border: "none",
              borderRadius: 99
            },
            children: STATUS_OPTS.map((s) => /* @__PURE__ */ jsx("option", { value: s.value, children: s.label }, s.value))
          }
        ),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [
          /* @__PURE__ */ jsx("span", { style: { fontSize: ".72rem", fontWeight: copyLength === "short" ? 700 : 400, color: copyLength === "short" ? "var(--accent)" : "var(--sub)", transition: "color .15s" }, children: "Short" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setCopyLength((l) => l === "short" ? "long" : "short"),
              title: copyLength === "long" ? "Switch to short copy" : "Switch to long copy",
              style: {
                width: 36,
                height: 20,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                padding: 0,
                background: copyLength === "long" ? "var(--accent)" : "var(--border)",
                position: "relative",
                transition: "background .2s",
                flexShrink: 0
              },
              children: /* @__PURE__ */ jsx("span", { style: {
                position: "absolute",
                top: 2,
                left: copyLength === "long" ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#fff",
                transition: "left .2s",
                display: "block",
                boxShadow: "0 1px 3px rgba(0,0,0,.2)"
              } })
            }
          ),
          /* @__PURE__ */ jsx("span", { style: { fontSize: ".72rem", fontWeight: copyLength === "long" ? 700 : 400, color: copyLength === "long" ? "var(--accent)" : "var(--sub)", transition: "color .15s" }, children: "Long" })
        ] }),
        saveStatus && /* @__PURE__ */ jsx("span", { className: `save-status ${saveStatus}`, children: saveStatus === "saving" ? "Saving…" : "✓ Saved" }),
        voiceInfo && /* @__PURE__ */ jsxs(
          "button",
          {
            className: "voice-chip",
            onClick: () => setShowVoiceDetail((v) => !v),
            title: "Brand voice is trained — click to view",
            children: [
              /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "12", height: "12", children: [
                /* @__PURE__ */ jsx("path", { d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" }),
                /* @__PURE__ */ jsx("path", { d: "M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" })
              ] }),
              "Voice trained"
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "span",
          {
            className: "badge",
            style: { background: typeInfo.colorBg, color: typeInfo.color },
            children: copy == null ? void 0 : copy.type
          }
        )
      ] })
    ] }),
    showVoiceDetail && voiceInfo && /* @__PURE__ */ jsxs("div", { className: "voice-panel", children: [
      /* @__PURE__ */ jsxs("div", { className: "voice-panel-header", children: [
        /* @__PURE__ */ jsx("span", { className: "voice-panel-title", children: "Brand Voice Profile" }),
        /* @__PURE__ */ jsxs("span", { className: "voice-panel-meta", children: [
          voiceInfo.sampleCount,
          " copies analyzed"
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "btn btn-ghost btn-sm",
            style: { marginLeft: "auto", fontSize: ".75rem" },
            onClick: async () => {
              if (!await confirmToast("Clear the trained brand voice?", { confirmText: "Clear" })) return;
              api.clearBrandVoice().then(() => {
                setVoiceInfo(false);
                setShowVoiceDetail(false);
                notifySuccess("Brand voice cleared");
              }).catch(() => {
              });
            },
            children: "Clear"
          }
        ),
        /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", style: { fontSize: ".75rem" }, onClick: () => setShowVoiceDetail(false), children: "Close" })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "voice-panel-body", children: voiceInfo.profile })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "chat-shell", children: [
      /* @__PURE__ */ jsxs("div", { className: "chat-messages", children: [
        messages.map((msg, i) => {
          var _a2;
          const isLast = i === messages.length - 1;
          return /* @__PURE__ */ jsx(
            MsgBubble,
            {
              msg,
              isLast,
              onFeedback: (sentiment) => handleFeedback(i, sentiment),
              feedback: feedbackMap[i] || null,
              onMockup: () => handleMockup(cleanDisplayText(msg.content), "ai"),
              onGeneratePrompt: () => handleGeneratePrompt(msg.content),
              showPreview: !!((_a2 = TYPES[copy == null ? void 0 : copy.type]) == null ? void 0 : _a2.preview)
            },
            i
          );
        }),
        showDots && /* @__PURE__ */ jsxs("div", { className: "msg-row", children: [
          /* @__PURE__ */ jsx("div", { className: "msg-avatar ai", children: "✦" }),
          /* @__PURE__ */ jsx("div", { className: "msg-bubble ai", children: /* @__PURE__ */ jsxs("div", { className: "typing-dots", children: [
            /* @__PURE__ */ jsx("span", {}),
            /* @__PURE__ */ jsx("span", {}),
            /* @__PURE__ */ jsx("span", {})
          ] }) })
        ] }),
        streamText && !showDots && /* @__PURE__ */ jsxs("div", { className: "msg-row", children: [
          /* @__PURE__ */ jsx("div", { className: "msg-avatar ai", children: "✦" }),
          /* @__PURE__ */ jsx("div", { className: "msg-bubble ai", children: cleanDisplayText(streamText) })
        ] }),
        /* @__PURE__ */ jsx("div", { ref: bottomRef })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "chat-input-bar", children: [
        /* @__PURE__ */ jsxs("div", { className: "chat-input-row", children: [
          /* @__PURE__ */ jsx(
            "textarea",
            {
              ref: textareaRef,
              className: "chat-textarea",
              placeholder: "Continue the conversation…",
              value: input,
              rows: 1,
              onChange: (e) => {
                setInput(e.target.value);
                resize();
              },
              onKeyDown: handleKey,
              disabled: streaming
            }
          ),
          streaming ? /* @__PURE__ */ jsx("button", { className: "send-btn", onClick: stopStreaming, title: "Stop generating", "aria-label": "Stop", children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", width: "16", height: "16", children: /* @__PURE__ */ jsx("rect", { x: "6", y: "6", width: "12", height: "12", rx: "2.5", fill: "currentColor" }) }) }) : /* @__PURE__ */ jsx("button", { className: "send-btn", onClick: send, disabled: !input.trim(), "aria-label": "Send", children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "18", height: "18", children: [
            /* @__PURE__ */ jsx("line", { x1: "22", y1: "2", x2: "11", y2: "13" }),
            /* @__PURE__ */ jsx("polygon", { points: "22 2 15 22 11 13 2 9 22 2" })
          ] }) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "chat-provider-bar", children: config ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs("span", { children: [
            ((_a = PROVIDERS.find((p) => p.id === config.provider)) == null ? void 0 : _a.name) || config.provider,
            " · ",
            config.model
          ] }),
          /* @__PURE__ */ jsx("button", { className: "chat-provider-link", onClick: () => {
            const u = new URL("/settings", window.location.origin);
            if (locationId) u.searchParams.set("locationId", locationId);
            navigate(u.pathname + u.search);
          }, children: "Change" })
        ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { children: "No AI provider configured" }),
          /* @__PURE__ */ jsx("button", { className: "chat-provider-link", onClick: () => {
            const u = new URL("/settings", window.location.origin);
            if (locationId) u.searchParams.set("locationId", locationId);
            navigate(u.pathname + u.search);
          }, children: "Connect →" })
        ] }) })
      ] })
    ] }),
    mockup && /* @__PURE__ */ jsx("div", { className: "mockup-overlay", children: /* @__PURE__ */ jsxs("div", { className: "mockup-modal", children: [
      /* @__PURE__ */ jsxs("div", { className: "mockup-header", children: [
        /* @__PURE__ */ jsx("span", { className: "mockup-title", children: "AI Generated Design" }),
        /* @__PURE__ */ jsx("div", { className: "mockup-tabs", children: !(mockup == null ? void 0 : mockup.loading) && (mockup == null ? void 0 : mockup.html) && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("button", { className: "mockup-tab", title: "I like this design", onClick: () => {
            api.mockupFeedback(mockup.style, "up");
            notifySuccess("Saved — more designs like this");
          }, children: "👍" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              className: "mockup-tab active",
              onClick: () => {
                api.mockupFeedback(mockup.style, "skip");
                setAutoCycle(false);
                clearTimeout(cycleTimerRef.current);
                clearInterval(countdownRef.current);
                const lastAiMsg = [...messages].reverse().find((m) => m.role === "assistant");
                handleMockup((lastAiMsg == null ? void 0 : lastAiMsg.content) || "", "ai", mockup.style);
              },
              children: "↺ New Design"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              className: `mockup-tab ${autoCycle ? "auto-cycle-on" : ""}`,
              onClick: () => setAutoCycle((v) => !v),
              title: "Auto-cycle through different designs every 20 seconds",
              children: autoCycle ? cycleCountdown > 0 ? `⏸ Next in ${cycleCountdown}s` : "⏸ Auto" : "▶ Auto"
            }
          )
        ] }) }),
        /* @__PURE__ */ jsx("button", { className: "mockup-close", onClick: () => setMockup(null), children: "✕" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mockup-body", children: mockup.loading ? /* @__PURE__ */ jsxs("div", { className: "mockup-loading", children: [
        /* @__PURE__ */ jsxs("div", { className: "typing-dots", children: [
          /* @__PURE__ */ jsx("span", {}),
          /* @__PURE__ */ jsx("span", {}),
          /* @__PURE__ */ jsx("span", {})
        ] }),
        /* @__PURE__ */ jsxs("p", { children: [
          "Generating ",
          mockup.mode === "ai" ? "AI design" : "design",
          "…"
        ] }),
        (() => {
          const t = (copy == null ? void 0 : copy.type) || "general";
          const est = mockupEstimate(mockup.mode, t, copyLength);
          if (!est) return null;
          const target = mockupTargetChars(t, copyLength);
          const pct = Math.min(96, Math.max(mockupChars > 0 ? 5 : 0, Math.round(mockupChars / target * 100)));
          return /* @__PURE__ */ jsxs("div", { style: { width: 260, marginTop: 8 }, children: [
            /* @__PURE__ */ jsxs("p", { style: { fontSize: ".78rem", color: "var(--sub)", textAlign: "center", marginBottom: 8 }, children: [
              "Usually ~",
              est.low,
              "–",
              est.high,
              "s · ",
              /* @__PURE__ */ jsxs("strong", { style: { color: "var(--text)" }, children: [
                mockupElapsed,
                "s"
              ] }),
              " elapsed"
            ] }),
            /* @__PURE__ */ jsx("div", { style: { height: 6, background: "var(--border)", borderRadius: 99, overflow: "hidden" }, children: /* @__PURE__ */ jsx("div", { style: { height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 99, transition: "width .4s ease" } }) }),
            mockupChars > 0 && /* @__PURE__ */ jsxs("p", { style: { fontSize: ".72rem", color: "var(--sub)", textAlign: "center", marginTop: 6 }, children: [
              mockupChars.toLocaleString(),
              " characters"
            ] }),
            mockupElapsed > est.high && /* @__PURE__ */ jsx("p", { style: { fontSize: ".72rem", color: "var(--sub)", textAlign: "center", marginTop: 4 }, children: "Taking longer than usual — almost there…" })
          ] });
        })()
      ] }) : mockup.error ? /* @__PURE__ */ jsxs("div", { className: "mockup-loading", children: [
        /* @__PURE__ */ jsx("p", { style: { color: "var(--danger)", fontWeight: 600 }, children: "Generation failed" }),
        /* @__PURE__ */ jsx("p", { style: { color: "var(--sub)", fontSize: ".875rem", maxWidth: 400, textAlign: "center" }, children: mockup.error }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: () => {
          const lastAiMsg = [...messages].reverse().find((m) => m.role === "assistant");
          handleMockup((lastAiMsg == null ? void 0 : lastAiMsg.content) || "", mockupMode);
        }, children: "Retry" })
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(
          "iframe",
          {
            className: "mockup-frame",
            srcDoc: mockup.html,
            title: "Page Mockup",
            sandbox: "allow-scripts"
          }
        ),
        /* @__PURE__ */ jsx("div", { className: "mockup-footer", children: /* @__PURE__ */ jsx(
          "button",
          {
            className: "btn btn-primary mockup-gen-prompt-btn",
            onClick: () => {
              const lastAiMsg = [...messages].reverse().find((m) => m.role === "assistant");
              handleGeneratePrompt((lastAiMsg == null ? void 0 : lastAiMsg.content) || "", mockup.html);
            },
            children: "Generate Prompt from This Design"
          }
        ) })
      ] }) })
    ] }) }),
    ghlPrompt && /* @__PURE__ */ jsx("div", { className: "modal-backdrop", onClick: () => setGhlPrompt(null), children: /* @__PURE__ */ jsxs("div", { className: "modal", style: { maxWidth: 640 }, onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxs("div", { className: "modal-title", style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
        /* @__PURE__ */ jsx("span", { children: "AI Builder Funnel Prompt" }),
        /* @__PURE__ */ jsx("button", { className: "mockup-close", style: { position: "static" }, onClick: () => setGhlPrompt(null), children: "✕" })
      ] }),
      ghlPrompt.loading ? /* @__PURE__ */ jsxs("div", { style: { padding: "32px 0", textAlign: "center" }, children: [
        /* @__PURE__ */ jsxs("div", { className: "typing-dots", children: [
          /* @__PURE__ */ jsx("span", {}),
          /* @__PURE__ */ jsx("span", {}),
          /* @__PURE__ */ jsx("span", {})
        ] }),
        /* @__PURE__ */ jsx("p", { style: { color: "var(--sub)", marginTop: 12, fontSize: ".9rem" }, children: "Analyzing funnel copy…" })
      ] }) : ghlPrompt.error ? /* @__PURE__ */ jsx("p", { style: { color: "var(--danger)", padding: "16px 0" }, children: ghlPrompt.error }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("p", { style: { color: "var(--sub)", fontSize: ".85rem", marginBottom: 12 }, children: [
          "Copy this prompt and paste it into any AI website or funnel builder — ",
          /* @__PURE__ */ jsx("strong", { children: "Framer AI, Durable, Wix AI, Webflow AI" }),
          ", or similar — to recreate this exact funnel from scratch."
        ] }),
        /* @__PURE__ */ jsx(
          "textarea",
          {
            readOnly: true,
            value: ghlPrompt.text,
            style: {
              width: "100%",
              minHeight: 320,
              padding: "12px 14px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
              fontSize: ".85rem",
              lineHeight: 1.6,
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box"
            },
            onFocus: (e) => e.target.select()
          }
        ),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 10, marginTop: 14 }, children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              className: "btn btn-primary",
              style: { flex: 1 },
              onClick: () => {
                navigator.clipboard.writeText(ghlPrompt.text).then(() => {
                  setGhlPromptCopied(true);
                  setTimeout(() => setGhlPromptCopied(false), 2500);
                });
              },
              children: ghlPromptCopied ? "✓ Copied!" : "Copy Prompt"
            }
          ),
          /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: () => setGhlPrompt(null), children: "Close" })
        ] })
      ] })
    ] }) })
  ] });
}
export {
  LibraryChat as default
};
