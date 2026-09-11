import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { u as useAIConfig, g as getLocationId, a as api, b as apiFetch } from "../entry-server.mjs";
import { P as PROVIDERS } from "./providers-eVryj-46.js";
import { c as confirmToast, n as notifySuccess, a as notifyError } from "./toast-DrUOosTv.js";
import "node:async_hooks";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
import "react-toastify";
function BackupCard() {
  const fileRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const today = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  async function doExport() {
    var _a, _b, _c, _d;
    setExporting(true);
    try {
      const payload = await api.exportBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `automator-backup-${today()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const c = payload.data || {};
      notifySuccess(`Backed up ${((_a = c.copies) == null ? void 0 : _a.length) || 0} copies, ${((_b = c.tasks) == null ? void 0 : _b.length) || 0} tasks, ${((_c = c.pipeline) == null ? void 0 : _c.length) || 0} pipeline, ${((_d = c.hooks) == null ? void 0 : _d.length) || 0} hooks`);
    } catch (e) {
      notifyError(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }
  function onFile(ev) {
    var _a;
    const file = (_a = ev.target.files) == null ? void 0 : _a[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      var _a2, _b, _c, _d;
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        if (payload.format !== "automator-backup") throw new Error("Not an Automator backup file");
        const c = payload.data || {};
        const summary = `${((_a2 = c.copies) == null ? void 0 : _a2.length) || 0} copies, ${((_b = c.tasks) == null ? void 0 : _b.length) || 0} tasks, ${((_c = c.pipeline) == null ? void 0 : _c.length) || 0} pipeline, ${((_d = c.hooks) == null ? void 0 : _d.length) || 0} hooks`;
        if (!await confirmToast(`Restore ${summary}? Existing items are updated, new ones added — nothing is deleted.`, { confirmText: "Restore" })) return;
        setImporting(true);
        const out = await api.importBackup(payload);
        const n = out.counts || {};
        notifySuccess(`Restored ${n.copies || 0} copies, ${n.tasks || 0} tasks, ${n.pipeline || 0} pipeline, ${n.hooks || 0} hooks`);
      } catch (e) {
        notifyError(e.message || "Import failed");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
    ev.target.value = "";
  }
  return /* @__PURE__ */ jsxs("div", { className: "settings-section", children: [
    /* @__PURE__ */ jsx("h2", { children: "Backup & Restore" }),
    /* @__PURE__ */ jsxs("div", { className: "text-sub text-sm", style: { lineHeight: 1.6, marginBottom: 12 }, children: [
      "Download a full backup of ",
      /* @__PURE__ */ jsx("strong", { children: "your" }),
      " data on this location — copies, customers, tasks, pipeline, hooks, brand voice, feedback, and AI settings — as one JSON file. Restore it later on any location to merge it back (existing items are updated, new ones added; nothing is deleted).",
      /* @__PURE__ */ jsx("div", { style: { marginTop: 6, color: "var(--danger)" }, children: "⚠ The file includes your API keys — keep it private and don’t share it." })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: doExport, disabled: exporting || importing, children: exporting ? "Preparing…" : "Download backup" }),
      /* @__PURE__ */ jsx("input", { ref: fileRef, type: "file", accept: ".json,application/json", onChange: onFile, style: { display: "none" } }),
      /* @__PURE__ */ jsx("button", { className: "btn btn-secondary", onClick: () => {
        var _a;
        return (_a = fileRef.current) == null ? void 0 : _a.click();
      }, disabled: exporting || importing, children: importing ? "Restoring…" : "Restore from file" })
    ] })
  ] });
}
function StatusBadge({ status }) {
  if (!status) return null;
  const color = status.color || "#94A3B8";
  return /* @__PURE__ */ jsx("span", { style: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 99,
    background: color + "22",
    color,
    fontSize: ".7rem",
    fontWeight: 700
  }, children: status.status });
}
function TaskRow({ task }) {
  var _a, _b;
  const url = `https://app.clickup.com/t/${task.id}`;
  return /* @__PURE__ */ jsxs("div", { className: "cu-task-row", children: [
    /* @__PURE__ */ jsxs("div", { className: "cu-task-main", children: [
      /* @__PURE__ */ jsx("div", { className: "cu-task-name", children: task.name }),
      /* @__PURE__ */ jsxs("div", { className: "cu-task-meta", children: [
        ((_a = task.list) == null ? void 0 : _a.name) && /* @__PURE__ */ jsx("span", { className: "cu-task-list", children: task.list.name }),
        task.due_date && /* @__PURE__ */ jsxs("span", { className: "cu-task-due", children: [
          "Due ",
          new Date(Number(task.due_date)).toLocaleDateString(void 0, { month: "short", day: "numeric" })
        ] }),
        ((_b = task.assignees) == null ? void 0 : _b.length) > 0 && /* @__PURE__ */ jsx("span", { className: "cu-task-assignees", children: task.assignees.map((a) => a.username || a.email).join(", ") })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "cu-task-right", children: [
      /* @__PURE__ */ jsx(StatusBadge, { status: task.status }),
      /* @__PURE__ */ jsx("a", { href: url, target: "_blank", rel: "noopener noreferrer", className: "btn btn-ghost btn-sm cu-open-btn", children: "Open ↗" })
    ] })
  ] });
}
const LIST_ICON = /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "12", height: "12", children: [
  /* @__PURE__ */ jsx("line", { x1: "8", y1: "6", x2: "21", y2: "6" }),
  /* @__PURE__ */ jsx("line", { x1: "8", y1: "12", x2: "21", y2: "12" }),
  /* @__PURE__ */ jsx("line", { x1: "8", y1: "18", x2: "21", y2: "18" }),
  /* @__PURE__ */ jsx("line", { x1: "3", y1: "6", x2: "3.01", y2: "6" }),
  /* @__PURE__ */ jsx("line", { x1: "3", y1: "12", x2: "3.01", y2: "12" }),
  /* @__PURE__ */ jsx("line", { x1: "3", y1: "18", x2: "3.01", y2: "18" })
] });
function ClickUpSection({ locationId }) {
  const [cuKey, setCuKey] = useState("");
  const [connected, setConnected] = useState(false);
  const [cuSaving, setCuSaving] = useState(false);
  const [cuError, setCuError] = useState("");
  const [workspaces, setWorkspaces] = useState([]);
  const [fetchingWs, setFetchingWs] = useState(false);
  const [wsExpanded, setWsExpanded] = useState({});
  const [spaces, setSpaces] = useState({});
  const [loadingSpaces, setLoadingSpaces] = useState({});
  const [spaceExp, setSpaceExp] = useState({});
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [spaceContent, setSpaceContent] = useState({});
  const [loadingSC, setLoadingSC] = useState({});
  const [folderExp, setFolderExp] = useState({});
  const [folderLists, setFolderLists] = useState({});
  const [loadingFL, setLoadingFL] = useState({});
  const [selectedList, setSelectedList] = useState(null);
  const [listTasks, setListTasks] = useState([]);
  const [loadingListTasks, setLoadingListTasks] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchTeamId, setSearchTeamId] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    apiFetch("/api/settings").then((r) => r.json()).then((d) => {
      setConnected(!!d.hasClickupKey);
    }).catch(() => {
    });
  }, [locationId]);
  async function cuFetch(path) {
    const url = new URL(path, window.location.origin);
    url.searchParams.set("locationId", locationId);
    const r = await fetch(url.toString());
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "ClickUp API error");
    return d;
  }
  async function saveKey(e) {
    e.preventDefault();
    const key = cuKey.trim();
    if (!key) return;
    setCuSaving(true);
    setCuError("");
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, clickupApiKey: key })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setConnected(true);
      setCuKey("");
      fetchWorkspaces();
    } catch (e2) {
      setCuError(e2.message);
    } finally {
      setCuSaving(false);
    }
  }
  async function disconnect() {
    if (!await confirmToast("Remove the saved ClickUp API key?", { confirmText: "Remove" })) return;
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId, removeClickupKey: true })
    });
    setConnected(false);
    setWorkspaces([]);
    setResults(null);
    setSearchQ("");
    setSearchTeamId("");
    setSelectedSpace(null);
    setSelectedList(null);
  }
  async function fetchWorkspaces() {
    setFetchingWs(true);
    setCuError("");
    try {
      const data = await cuFetch("/api/clickup/workspaces");
      setWorkspaces(data);
      if (data.length > 0) {
        setSearchTeamId(data[0].id);
        toggleTeam(data[0].id, true);
      }
    } catch (e) {
      setCuError(e.message);
    } finally {
      setFetchingWs(false);
    }
  }
  async function toggleTeam(teamId, forceOpen) {
    const nowOpen = forceOpen ?? !wsExpanded[teamId];
    setWsExpanded((p) => ({ ...p, [teamId]: nowOpen }));
    setSearchTeamId(teamId);
    if (!spaces[teamId]) {
      setLoadingSpaces((p) => ({ ...p, [teamId]: true }));
      try {
        const data = await cuFetch(`/api/clickup/spaces/${teamId}`);
        setSpaces((p) => ({ ...p, [teamId]: data }));
      } catch (e) {
        setCuError(e.message);
      } finally {
        setLoadingSpaces((p) => ({ ...p, [teamId]: false }));
      }
    }
  }
  async function selectSpace(space) {
    const nowOpen = !spaceExp[space.id];
    setSpaceExp((p) => ({ ...p, [space.id]: nowOpen }));
    setSelectedSpace({ id: space.id, name: space.name });
    setSelectedList(null);
    setListTasks([]);
    if (!spaceContent[space.id]) {
      setLoadingSC((p) => ({ ...p, [space.id]: true }));
      try {
        const data = await cuFetch(`/api/clickup/space/${space.id}/content`);
        setSpaceContent((p) => ({ ...p, [space.id]: data }));
      } catch (e) {
        setCuError(e.message);
      } finally {
        setLoadingSC((p) => ({ ...p, [space.id]: false }));
      }
    }
  }
  async function toggleFolder(folderId) {
    setFolderExp((p) => ({ ...p, [folderId]: !p[folderId] }));
    if (!folderLists[folderId]) {
      setLoadingFL((p) => ({ ...p, [folderId]: true }));
      try {
        const data = await cuFetch(`/api/clickup/folder/${folderId}/lists`);
        setFolderLists((p) => ({ ...p, [folderId]: data }));
      } catch (e) {
        setCuError(e.message);
      } finally {
        setLoadingFL((p) => ({ ...p, [folderId]: false }));
      }
    }
  }
  async function openList(list) {
    setSelectedList({ id: list.id, name: list.name });
    setListTasks([]);
    setLoadingListTasks(true);
    setResults(null);
    try {
      const data = await cuFetch(`/api/clickup/list/${list.id}/tasks`);
      setListTasks(data);
    } catch (e) {
      setCuError(e.message);
    } finally {
      setLoadingListTasks(false);
    }
  }
  async function search() {
    const q = searchQ.trim();
    if (!q || !searchTeamId) return;
    setSearching(true);
    setCuError("");
    setSelectedList(null);
    setListTasks([]);
    try {
      const url = new URL("/api/clickup/search", window.location.origin);
      url.searchParams.set("locationId", locationId);
      url.searchParams.set("teamId", searchTeamId);
      url.searchParams.set("q", q);
      const r = await fetch(url.toString());
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResults(d);
    } catch (e) {
      setCuError(e.message);
    } finally {
      setSearching(false);
    }
  }
  function ListRow({ list, indent = 0 }) {
    const isSelected = (selectedList == null ? void 0 : selectedList.id) === list.id;
    return /* @__PURE__ */ jsxs(
      "button",
      {
        className: `cu-tree-row list-btn ${isSelected ? "selected" : ""}`,
        style: { paddingLeft: 50 + indent },
        onClick: () => openList(list),
        children: [
          LIST_ICON,
          /* @__PURE__ */ jsx("span", { className: "cu-tree-label", children: list.name }),
          list.task_count != null && /* @__PURE__ */ jsx("span", { className: "cu-tree-count", children: list.task_count }),
          /* @__PURE__ */ jsx("span", { className: "cu-list-view", children: "View tasks →" })
        ]
      }
    );
  }
  const taskPanelTitle = selectedList ? `Tasks in "${selectedList.name}"` : results !== null ? `Search results for "${searchQ}"` : null;
  const taskPanelItems = selectedList ? listTasks : results || [];
  const taskPanelLoading = selectedList ? loadingListTasks : searching;
  return /* @__PURE__ */ jsxs("div", { className: "settings-section", children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }, children: [
      /* @__PURE__ */ jsxs("h2", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "18", height: "18", children: [
          /* @__PURE__ */ jsx("path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }),
          /* @__PURE__ */ jsx("path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" })
        ] }),
        "ClickUp Integration"
      ] }),
      connected && /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 10, alignItems: "center" }, children: [
        /* @__PURE__ */ jsxs("span", { className: "chip chip-green", children: [
          /* @__PURE__ */ jsx("svg", { width: "8", height: "8", viewBox: "0 0 8 8", children: /* @__PURE__ */ jsx("circle", { cx: "4", cy: "4", r: "4", fill: "currentColor" }) }),
          "Connected"
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", style: { color: "var(--danger)" }, onClick: disconnect, children: "Disconnect" })
      ] })
    ] }),
    !connected && /* @__PURE__ */ jsxs("form", { onSubmit: saveKey, style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          className: "form-input",
          type: "password",
          value: cuKey,
          onChange: (e) => {
            setCuKey(e.target.value);
            setCuError("");
          },
          placeholder: "pk_••••••••  (ClickUp personal API token)",
          autoComplete: "off",
          style: { flex: 1, minWidth: 220 }
        }
      ),
      /* @__PURE__ */ jsx("button", { className: "btn btn-primary", type: "submit", disabled: !cuKey.trim() || cuSaving, children: cuSaving ? "Connecting…" : "Connect" })
    ] }),
    cuError && /* @__PURE__ */ jsx("div", { style: { fontSize: ".8125rem", color: "var(--danger)", padding: "6px 10px", background: "var(--danger-bg)", borderRadius: 6 }, children: cuError }),
    connected && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "cu-search-row", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "form-input",
            type: "text",
            value: searchQ,
            onChange: (e) => setSearchQ(e.target.value),
            onKeyDown: (e) => e.key === "Enter" && search(),
            placeholder: selectedSpace ? `Search in "${selectedSpace.name}"…` : "Search all ClickUp tasks by name…",
            style: { flex: 1 }
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "btn btn-primary",
            onClick: search,
            disabled: !searchQ.trim() || !searchTeamId || searching,
            children: searching ? "Searching…" : "Search"
          }
        )
      ] }),
      !searchTeamId && /* @__PURE__ */ jsx("div", { className: "text-xs text-sub", children: "Fetch workspace first to enable search." }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs text-sub", style: { fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }, children: "Workspace" }),
          selectedSpace && /* @__PURE__ */ jsx("span", { className: "cu-selected-space-pill", children: selectedSpace.name })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: fetchWorkspaces, disabled: fetchingWs, children: fetchingWs ? "Loading…" : workspaces.length ? "Refresh" : "Fetch Workspace" })
      ] }),
      workspaces.length > 0 && /* @__PURE__ */ jsx("div", { className: "cu-tree", children: workspaces.map((team) => /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("button", { className: "cu-tree-row team", onClick: () => toggleTeam(team.id), children: [
          /* @__PURE__ */ jsx("span", { className: "cu-tree-arrow", children: wsExpanded[team.id] ? "▾" : "▸" }),
          /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "14", height: "14", children: [
            /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "7", height: "7" }),
            /* @__PURE__ */ jsx("rect", { x: "14", y: "3", width: "7", height: "7" }),
            /* @__PURE__ */ jsx("rect", { x: "14", y: "14", width: "7", height: "7" }),
            /* @__PURE__ */ jsx("rect", { x: "3", y: "14", width: "7", height: "7" })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "cu-tree-label", children: team.name }),
          loadingSpaces[team.id] && /* @__PURE__ */ jsx("span", { className: "cu-loading", children: "…" })
        ] }),
        wsExpanded[team.id] && (spaces[team.id] || []).map((space) => /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs(
            "button",
            {
              className: `cu-tree-row space ${(selectedSpace == null ? void 0 : selectedSpace.id) === space.id ? "space-selected" : ""}`,
              onClick: () => selectSpace(space),
              children: [
                /* @__PURE__ */ jsx("span", { className: "cu-tree-arrow", children: spaceExp[space.id] ? "▾" : "▸" }),
                /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "13", height: "13", children: /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "10" }) }),
                /* @__PURE__ */ jsx("span", { className: "cu-tree-label", children: space.name }),
                loadingSC[space.id] && /* @__PURE__ */ jsx("span", { className: "cu-loading", children: "…" }),
                (selectedSpace == null ? void 0 : selectedSpace.id) === space.id && /* @__PURE__ */ jsx("span", { className: "cu-active-badge", children: "selected" })
              ]
            }
          ),
          spaceExp[space.id] && spaceContent[space.id] && /* @__PURE__ */ jsxs("div", { className: "cu-tree-content", children: [
            spaceContent[space.id].folders.map((folder) => /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("button", { className: "cu-tree-row folder", onClick: () => toggleFolder(folder.id), children: [
                /* @__PURE__ */ jsx("span", { className: "cu-tree-arrow", children: folderExp[folder.id] ? "▾" : "▸" }),
                /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "13", height: "13", children: /* @__PURE__ */ jsx("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }) }),
                /* @__PURE__ */ jsx("span", { className: "cu-tree-label", children: folder.name }),
                loadingFL[folder.id] && /* @__PURE__ */ jsx("span", { className: "cu-loading", children: "…" })
              ] }),
              folderExp[folder.id] && (folderLists[folder.id] || []).map((list) => /* @__PURE__ */ jsx(ListRow, { list, indent: 12 }, list.id))
            ] }, folder.id)),
            spaceContent[space.id].lists.map((list) => /* @__PURE__ */ jsx(ListRow, { list }, list.id))
          ] })
        ] }, space.id))
      ] }, team.id)) }),
      taskPanelTitle && /* @__PURE__ */ jsxs("div", { className: "cu-results", children: [
        /* @__PURE__ */ jsx("div", { className: "cu-results-header", children: taskPanelLoading ? "Loading tasks…" : `${taskPanelTitle} (${taskPanelItems.length})` }),
        taskPanelLoading ? /* @__PURE__ */ jsx("div", { style: { padding: "16px", display: "flex", justifyContent: "center" }, children: /* @__PURE__ */ jsx("div", { className: "spinner", style: { width: 20, height: 20, borderWidth: 2 } }) }) : taskPanelItems.length === 0 ? /* @__PURE__ */ jsx("div", { style: { padding: "14px 12px", fontSize: ".8125rem", color: "var(--sub)" }, children: "No tasks found." }) : taskPanelItems.map((task) => /* @__PURE__ */ jsx(TaskRow, { task }, task.id))
      ] })
    ] })
  ] });
}
function Settings() {
  var _a;
  const { config, loading, locationName: savedName, saveConfig, clearConfig } = useAIConfig();
  const locationId = getLocationId();
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const activeProvider = provider || (config == null ? void 0 : config.provider) || PROVIDERS[0].id;
  const selectedProv = PROVIDERS.find((p) => p.id === activeProvider) || PROVIDERS[0];
  async function handleSave(e) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSaving(true);
    setError("");
    try {
      const chosenModel = model || selectedProv.defaultModel;
      const result = await api.testAIKey({ provider: activeProvider, apiKey: apiKey.trim(), model: chosenModel });
      if (!result.ok) {
        setError(result.error || "API key rejected. Check the key and try again.");
        return;
      }
      await saveConfig({
        provider: activeProvider,
        apiKey: apiKey.trim(),
        model: chosenModel,
        businessName: businessName.trim()
      });
      setApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || "Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }
  async function handleClear() {
    if (!await confirmToast("Disconnect and remove the saved API key?", { confirmText: "Disconnect" })) return;
    await clearConfig();
    setApiKey("");
    setModel("");
    setProvider("");
    notifySuccess("API key removed");
  }
  if (loading) {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "topnav", children: /* @__PURE__ */ jsx("div", { className: "topnav-left", children: /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Settings" }) }) }),
      /* @__PURE__ */ jsx("div", { className: "content", style: { display: "flex", justifyContent: "center", paddingTop: 48 }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) })
    ] });
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "topnav", children: /* @__PURE__ */ jsxs("div", { className: "topnav-left", children: [
      /* @__PURE__ */ jsx("span", { className: "breadcrumb", children: "Dashboard" }),
      /* @__PURE__ */ jsx("span", { className: "breadcrumb-sep", children: "/" }),
      /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Settings" })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "content", style: { maxWidth: 720 }, children: [
      /* @__PURE__ */ jsx("div", { className: "page-header", children: /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "page-title", children: "Settings" }),
        /* @__PURE__ */ jsx("div", { className: "page-sub", children: "Configure your AI provider and integrations" })
      ] }) }),
      config && /* @__PURE__ */ jsx("div", { className: "settings-section", style: { marginBottom: 20 }, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "fw-700", style: { fontSize: ".9375rem" }, children: ((_a = PROVIDERS.find((p) => p.id === config.provider)) == null ? void 0 : _a.name) || config.provider }),
          /* @__PURE__ */ jsxs("div", { className: "text-sub text-sm mt-1", children: [
            "Model: ",
            config.model
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 10, alignItems: "center" }, children: [
          /* @__PURE__ */ jsxs("span", { className: "chip chip-green", children: [
            /* @__PURE__ */ jsx("svg", { width: "8", height: "8", viewBox: "0 0 8 8", children: /* @__PURE__ */ jsx("circle", { cx: "4", cy: "4", r: "4", fill: "currentColor" }) }),
            "Connected"
          ] }),
          /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", style: { color: "var(--danger)" }, onClick: handleClear, children: "Disconnect" })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs("form", { className: "settings-section", onSubmit: handleSave, children: [
        /* @__PURE__ */ jsx("h2", { children: config ? "Update Settings" : "Connect AI Provider" }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Business Name" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-input",
              type: "text",
              value: businessName,
              onChange: (e) => setBusinessName(e.target.value),
              placeholder: savedName || "Your business name"
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "text-xs text-sub mt-1", children: [
            "Shown in the sidebar. Current: ",
            /* @__PURE__ */ jsx("strong", { children: savedName || "not set" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Provider" }),
          /* @__PURE__ */ jsx(
            "select",
            {
              className: "form-input form-select",
              value: activeProvider,
              onChange: (e) => {
                setProvider(e.target.value);
                setModel("");
              },
              children: PROVIDERS.map((p) => /* @__PURE__ */ jsx("option", { value: p.id, children: p.name }, p.id))
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: -8 }, children: [
          /* @__PURE__ */ jsx("div", { style: { width: 10, height: 10, borderRadius: "50%", background: selectedProv.color, flexShrink: 0 } }),
          /* @__PURE__ */ jsx("span", { className: "text-xs text-sub", children: selectedProv.name })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "API Key" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-input",
              type: "password",
              value: apiKey,
              onChange: (e) => setApiKey(e.target.value),
              placeholder: config ? "••••••••  (enter new key to update)" : selectedProv.placeholder,
              autoComplete: "off",
              required: true
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "text-xs text-sub mt-1", children: "Stored on this device only." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Model" }),
          /* @__PURE__ */ jsx(
            "select",
            {
              className: "form-input form-select",
              value: model || ((config == null ? void 0 : config.provider) === activeProvider ? config == null ? void 0 : config.model : "") || selectedProv.defaultModel,
              onChange: (e) => setModel(e.target.value),
              children: selectedProv.models.map((m) => /* @__PURE__ */ jsxs("option", { value: m, children: [
                m,
                m === selectedProv.defaultModel ? " (default)" : ""
              ] }, m))
            }
          )
        ] }),
        error && /* @__PURE__ */ jsx("div", { className: "text-sm", style: { color: "var(--danger)", marginBottom: 8 }, children: error }),
        /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx(
          "button",
          {
            type: "submit",
            className: `btn ${saved ? "btn-secondary" : "btn-primary"}`,
            disabled: !apiKey.trim() || saving,
            children: saved ? "✓ Connected!" : saving ? "Verifying…" : config ? "Update Key" : "Connect Provider"
          }
        ) })
      ] }),
      /* @__PURE__ */ jsx(ClickUpSection, { locationId }),
      /* @__PURE__ */ jsxs("div", { className: "settings-section", children: [
        /* @__PURE__ */ jsx("h2", { children: "GHL Connection" }),
        /* @__PURE__ */ jsx("div", { className: "text-sub text-sm", style: { lineHeight: 1.6 }, children: locationId ? /* @__PURE__ */ jsxs(Fragment, { children: [
          "Location ID: ",
          /* @__PURE__ */ jsx("code", { style: { background: "var(--bg)", padding: "2px 6px", borderRadius: 4, fontSize: ".8125rem" }, children: locationId })
        ] }) : "No GHL location connected." }),
        !locationId && /* @__PURE__ */ jsx("a", { href: "/auth", className: "btn btn-primary", style: { marginTop: 4, display: "inline-flex" }, children: "Install with GHL" })
      ] }),
      /* @__PURE__ */ jsx(BackupCard, {}),
      /* @__PURE__ */ jsxs("div", { className: "settings-section", children: [
        /* @__PURE__ */ jsx("h2", { children: "Claim Existing Data" }),
        /* @__PURE__ */ jsxs("div", { className: "text-sub text-sm", style: { lineHeight: 1.6, marginBottom: 10 }, children: [
          "One-time: assign all pre-existing conversations, tasks, and hooks on this location that don’t yet have an owner ",
          /* @__PURE__ */ jsx("strong", { children: "to you" }),
          ". After this, only you will see them. This can’t be undone."
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "btn btn-secondary",
            onClick: async () => {
              if (!await confirmToast("Claim all currently-shared conversations, tasks, and hooks on this location as yours?", { confirmText: "Claim", danger: false })) return;
              const r = await api.claimLegacyData().catch(() => null);
              if (r == null ? void 0 : r.ok) {
                const { copies = 0, tasks = 0, hooks = 0, customers = 0, pipeline = 0 } = r.claimed || {};
                notifySuccess(`Claimed ${customers} folders, ${copies} conversations, ${tasks} tasks, ${pipeline} pipeline, ${hooks} hooks`);
              } else {
                notifySuccess("Nothing to claim (or you must sign in with your email first)");
              }
            },
            children: "Claim existing data"
          }
        )
      ] })
    ] })
  ] });
}
export {
  Settings as default
};
