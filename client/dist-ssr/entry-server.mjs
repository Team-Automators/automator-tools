var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { AsyncLocalStorage } from "node:async_hooks";
import { renderToPipeableStream } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server.mjs";
import React, { useEffect, useState, useCallback, lazy, useRef, Suspense } from "react";
import { useSearchParams, useNavigate, useLocation, NavLink, Outlet, Routes, Route, Navigate, useParams } from "react-router-dom";
import { ToastContainer } from "react-toastify";
let resolver = null;
function setStateResolver(fn) {
  resolver = fn;
}
function ssrState() {
  if (resolver) {
    try {
      return resolver() || null;
    } catch {
      return null;
    }
  }
  try {
    return typeof globalThis !== "undefined" && globalThis.__SSR_STATE__ || null;
  } catch {
    return null;
  }
}
const LOCATION_KEY = "ghl_location_id";
function getLocationId() {
  const s = ssrState();
  if (s && s.locationId != null) return s.locationId || "";
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  return url.searchParams.get("locationId") || localStorage.getItem(LOCATION_KEY) || "";
}
function persistLocationId(id) {
  if (id) localStorage.setItem(LOCATION_KEY, id);
}
function withLocationId(url) {
  const id = getLocationId();
  if (id) url.searchParams.set("locationId", id);
  return url;
}
async function apiFetch(path, opts = {}) {
  const url = withLocationId(new URL(path, window.location.origin));
  return fetch(url.toString(), {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers || {} }
  });
}
const api = {
  async getDashboard() {
    const r = await apiFetch("/api/dashboard");
    if (!r.ok) return null;
    return r.json();
  },
  async getCustomers() {
    const r = await apiFetch("/api/customers");
    if (!r.ok) return [];
    return r.json();
  },
  async createCustomer(name, email = "") {
    const r = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId(), name, email })
    });
    return r.json();
  },
  async updateCustomer(id, { name, email } = {}) {
    const body = { locationId: getLocationId() };
    if (name !== void 0) body.name = name;
    if (email !== void 0) body.email = email;
    const r = await fetch(`/api/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return r.json();
  },
  async deleteCustomer(id) {
    const url = withLocationId(new URL(`/api/customers/${id}`, window.location.origin));
    const r = await fetch(url.toString(), { method: "DELETE" });
    return r.json();
  },
  async getCopies(customerId = "", limit = 0, status = "") {
    const url = withLocationId(new URL("/api/copies", window.location.origin));
    if (customerId) url.searchParams.set("customerId", customerId);
    if (limit) url.searchParams.set("limit", String(limit));
    if (status) url.searchParams.set("status", status);
    const r = await fetch(url.toString());
    if (!r.ok) return [];
    return r.json();
  },
  async getArchivedCopies() {
    return this.getCopies("", 0, "archived");
  },
  async claimLegacyData() {
    const r = await fetch("/api/settings/claim-legacy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId() })
    });
    return r.json();
  },
  async setCopyStatus(id, status) {
    const r = await fetch(`/api/copies/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId(), status })
    });
    return r.json();
  },
  // Permanently delete (from Archive). Regular deleteCopy now soft-deletes (archives).
  async purgeCopy(id) {
    const url = withLocationId(new URL(`/api/copies/${id}`, window.location.origin));
    url.searchParams.set("permanent", "true");
    const r = await fetch(url.toString(), { method: "DELETE" });
    return r.json();
  },
  async getCopy(id) {
    const r = await apiFetch(`/api/copies/${id}`);
    if (!r.ok) return null;
    return r.json();
  },
  async saveCopy({ customerId, customerName, type, messages, title, preview }) {
    const r = await fetch("/api/copies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId(), customerId, customerName, type, messages, title, preview })
    });
    return r.json();
  },
  async updateCopy(id, { messages, customerId, customerName } = {}) {
    const body = { locationId: getLocationId(), messages };
    if (customerId !== void 0) body.customerId = customerId;
    if (customerName !== void 0) body.customerName = customerName;
    const r = await fetch(`/api/copies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return r.json();
  },
  async deleteCopy(id) {
    const url = withLocationId(new URL(`/api/copies/${id}`, window.location.origin));
    const r = await fetch(url.toString(), { method: "DELETE" });
    return r.json();
  },
  // ── Client Pipeline Tracker ──────────────────────────────────────────────
  async getPipeline() {
    const r = await apiFetch("/api/pipeline");
    if (!r.ok) return [];
    return r.json();
  },
  async createEngagement(fields) {
    const r = await fetch("/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId(), ...fields })
    });
    return r.json();
  },
  async updateEngagement(id, fields) {
    const r = await fetch(`/api/pipeline/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId(), ...fields })
    });
    return r.json();
  },
  async deleteEngagement(id) {
    const url = withLocationId(new URL(`/api/pipeline/${id}`, window.location.origin));
    const r = await fetch(url.toString(), { method: "DELETE" });
    return r.json();
  },
  async importPipeline(items) {
    const r = await fetch("/api/pipeline/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId(), items })
    });
    return r.json();
  },
  async getTasks() {
    const r = await apiFetch("/api/tasks");
    if (!r.ok) return [];
    return r.json();
  },
  async createTask({ title, customerId, customerName, stage, notes }) {
    const r = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId(), title, customerId, customerName, stage, notes })
    });
    return r.json();
  },
  async updateTask(id, fields) {
    const r = await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId(), ...fields })
    });
    return r.json();
  },
  async deleteTask(id) {
    const url = withLocationId(new URL(`/api/tasks/${id}`, window.location.origin));
    const r = await fetch(url.toString(), { method: "DELETE" });
    return r.json();
  },
  async addNote(taskId, text) {
    const r = await fetch(`/api/tasks/${taskId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId(), text })
    });
    return r.json();
  },
  async deleteNote(taskId, noteId) {
    const url = withLocationId(new URL(`/api/tasks/${taskId}/notes/${noteId}`, window.location.origin));
    const r = await fetch(url.toString(), { method: "DELETE" });
    return r.json();
  },
  async getHooks() {
    const r = await apiFetch("/api/hooks");
    if (!r.ok) return [];
    return r.json();
  },
  async createHook({ name, destinationUrl, customerId, customerName }) {
    const r = await fetch("/api/hooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId(), name, destinationUrl, customerId, customerName })
    });
    return r.json();
  },
  async updateHook(id, fields) {
    const r = await fetch(`/api/hooks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId(), ...fields })
    });
    return r.json();
  },
  async deleteHook(id) {
    const url = withLocationId(new URL(`/api/hooks/${id}`, window.location.origin));
    const r = await fetch(url.toString(), { method: "DELETE" });
    return r.json();
  },
  async resolveClickupTask(taskId) {
    const url = withLocationId(new URL(`/api/clickup/task/${taskId}`, window.location.origin));
    const r = await fetch(url.toString());
    return r.json();
  },
  async getClickupWorkspaces() {
    const url = withLocationId(new URL("/api/clickup/workspaces", window.location.origin));
    const r = await fetch(url.toString());
    if (!r.ok) return [];
    return r.json();
  },
  async getClickupSpaces(teamId) {
    const url = withLocationId(new URL(`/api/clickup/spaces/${teamId}`, window.location.origin));
    const r = await fetch(url.toString());
    if (!r.ok) return [];
    return r.json();
  },
  async getClickupSpaceContent(spaceId) {
    const url = withLocationId(new URL(`/api/clickup/space/${spaceId}/content`, window.location.origin));
    const r = await fetch(url.toString());
    if (!r.ok) return { folders: [], lists: [] };
    return r.json();
  },
  async getClickupFolderLists(folderId) {
    const url = withLocationId(new URL(`/api/clickup/folder/${folderId}/lists`, window.location.origin));
    const r = await fetch(url.toString());
    if (!r.ok) return [];
    return r.json();
  },
  async getClickupListTasks(listId) {
    const url = withLocationId(new URL(`/api/clickup/list/${listId}/tasks`, window.location.origin));
    const r = await fetch(url.toString());
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Failed to load tasks");
    return d;
  },
  async searchClickupTasks(teamId, q) {
    const url = withLocationId(new URL("/api/clickup/search", window.location.origin));
    url.searchParams.set("teamId", teamId);
    url.searchParams.set("q", q);
    const r = await fetch(url.toString());
    if (!r.ok) return [];
    return r.json();
  },
  async saveHookMapping(id, { fieldMap, autoCreate }) {
    const r = await fetch(`/api/hooks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId(), fieldMap, autoCreate })
    });
    return r.json();
  },
  async testHook(id) {
    const r = await fetch(`/api/hooks/${id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId() })
    });
    return r.json();
  },
  async testAIKey({ provider, apiKey, model }) {
    const r = await fetch("/copywrite/test-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey, model })
    });
    return r.json();
  },
  async getBrandVoice() {
    const r = await apiFetch("/copywrite/brand-voice");
    if (!r.ok) return null;
    return r.json();
  },
  async clearBrandVoice() {
    const url = withLocationId(new URL("/copywrite/brand-voice", window.location.origin));
    const r = await fetch(url.toString(), { method: "DELETE" });
    return r.json();
  },
  async addCopyFeedback({ type, text, sentiment }) {
    const r = await fetch("/copywrite/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: getLocationId(), type, text, sentiment })
    });
    return r.json();
  },
  async getSession(type) {
    const r = await apiFetch(`/copywrite/session?type=${encodeURIComponent(type)}`);
    if (!r.ok) return [];
    const d = await r.json();
    return d.messages || [];
  },
  async saveSession(type, messages) {
    try {
      await fetch("/copywrite/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: getLocationId(), type, messages })
      });
    } catch {
    }
  },
  async generateGhlPrompt({ copy, html, provider, apiKey, model }) {
    const r = await fetch("/copywrite/generate-ghl-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copy, html, provider, apiKey, model })
    });
    return r.json();
  },
  async generateMockup({ copy, type, mode, copyLength, provider, apiKey, model }) {
    const r = await fetch("/copywrite/mockup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copy, type, mode, copyLength, provider, apiKey, model, seed: Date.now() })
    });
    return r.json();
  },
  // Teach the account's design preferences (👍/👎/regenerate). Fire-and-forget.
  mockupFeedback(style, sentiment) {
    if (!style) return;
    try {
      fetch("/copywrite/mockup-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style, sentiment, locationId: getLocationId() })
      }).catch(() => {
      });
    } catch {
    }
  },
  // Streaming version for AI mode — returns { html, mode, style } when done
  generateMockupStream({ copy, type, mode, copyLength, provider, apiKey, model, avoidStyle }, { onChunk } = {}) {
    return new Promise((resolve, reject) => {
      fetch("/copywrite/mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copy, type, mode, copyLength, provider, apiKey, model, seed: Date.now(), avoidStyle })
      }).then(async (resp) => {
        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}));
          reject(new Error(j.error || `Request failed (${resp.status})`));
          return;
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6);
            if (raw === "[DONE]") continue;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.chunk && onChunk) onChunk(parsed.chunk);
              if (parsed.done) resolve({ html: parsed.html, mode: parsed.mode, style: parsed.style });
              if (parsed.error) reject(new Error(parsed.error));
            } catch {
            }
          }
        }
      }).catch(reject);
    });
  },
  // Stream a project brief from a call transcript.
  // Extract plain text from an uploaded document (PDF/DOCX/text) server-side.
  async extractFile(file) {
    const dataBase64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("Could not read file"));
      r.readAsDataURL(file);
    });
    const url = withLocationId(new URL("/copywrite/extract-file", window.location.origin));
    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, dataBase64 })
    });
    const j = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(j.error || `Extraction failed (${resp.status})`);
    return j;
  },
  analyzeTranscriptStream({ transcript, clientName, provider, apiKey, model }, { onChunk } = {}) {
    return new Promise((resolve, reject) => {
      fetch("/copywrite/analyze-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, clientName, provider, apiKey, model })
      }).then(async (resp) => {
        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}));
          reject(new Error(j.error || `Request failed (${resp.status})`));
          return;
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "", full = "", errText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6);
            if (raw === "[DONE]") continue;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.error) errText = parsed.error;
              else if (parsed.text) {
                full += parsed.text;
                onChunk == null ? void 0 : onChunk(parsed.text, full);
              }
            } catch {
            }
          }
        }
        if (errText && !full) reject(new Error(errText));
        else resolve(full);
      }).catch(reject);
    });
  },
  async architectFromNotes({ notes, provider, apiKey, model }) {
    const r = await fetch("/copywrite/architect/from-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes, provider, apiKey, model })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
    return j;
  },
  async architectOptions({ offer, pricePoint, traffic, goal, notes, provider, apiKey, model }) {
    const r = await fetch("/copywrite/architect/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer, pricePoint, traffic, goal, notes, provider, apiKey, model })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
    return j;
  },
  async architectBuild({ offer, pricePoint, traffic, goal, notes, funnelName, pages, provider, apiKey, model }) {
    const r = await fetch("/copywrite/architect/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer, pricePoint, traffic, goal, notes, funnelName, pages, provider, apiKey, model })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
    return j;
  },
  async architectPageCopy({ offer, pricePoint, traffic, goal, notes, funnelName, pages, provider, apiKey, model }) {
    const r = await fetch("/copywrite/architect/page-copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer, pricePoint, traffic, goal, notes, funnelName, pages, provider, apiKey, model })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
    return j;
  },
  async getArchitectMemory() {
    const url = withLocationId(new URL("/copywrite/architect/memory", window.location.origin));
    const r = await fetch(url.toString());
    return r.ok ? r.json() : { playbook: "", count: 0, examples: [] };
  },
  async setArchitectPlaybook(playbook) {
    const r = await fetch("/copywrite/architect/memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playbook, locationId: getLocationId() })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Save failed");
    return j;
  },
  async resetArchitectMemory() {
    const url = withLocationId(new URL("/copywrite/architect/memory", window.location.origin));
    const r = await fetch(url.toString(), { method: "DELETE" });
    return r.json().catch(() => ({ ok: false }));
  },
  // ── Admin console ─────────────────────────────────────────────────────────
  async getAdminUsers() {
    const url = withLocationId(new URL("/api/admin/users", window.location.origin));
    const r = await fetch(url.toString());
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
    return j;
  },
  async revokeUserKey(email) {
    const r = await fetch("/api/admin/revoke-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locationId: getLocationId() })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Failed");
    return j;
  },
  async setUserBlocked(email, blocked) {
    const r = await fetch("/api/admin/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, blocked, locationId: getLocationId() })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Failed");
    return j;
  },
  async shareUserKey(email) {
    const r = await fetch("/api/admin/share-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locationId: getLocationId() })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Failed");
    return j;
  },
  // Fire-and-forget: teaches the account playbook so future builds improve.
  architectLearn(payload) {
    try {
      fetch("/copywrite/architect/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => {
      });
    } catch {
    }
  },
  architectFunnelStream({ offer, pricePoint, traffic, goal, provider, apiKey, model }, { onChunk } = {}) {
    return new Promise((resolve, reject) => {
      fetch("/copywrite/architect-funnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer, pricePoint, traffic, goal, provider, apiKey, model })
      }).then(async (resp) => {
        if (!resp.ok) {
          const j = await resp.json().catch(() => ({}));
          reject(new Error(j.error || `Request failed (${resp.status})`));
          return;
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "", full = "", errText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6);
            if (raw === "[DONE]") continue;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.error) errText = parsed.error;
              else if (parsed.text) {
                full += parsed.text;
                onChunk == null ? void 0 : onChunk(parsed.text, full);
              }
            } catch {
            }
          }
        }
        if (errText && !full) reject(new Error(errText));
        else resolve(full);
      }).catch(reject);
    });
  },
  async analyzeVoice({ provider, apiKey, model }) {
    const url = withLocationId(new URL("/copywrite/analyze-voice", window.location.origin));
    const r = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey, model })
    });
    return r.json();
  },
  // ── Backup / restore ──────────────────────────────────────────────────────
  async exportBackup() {
    const url = withLocationId(new URL("/api/backup/export", window.location.origin));
    const r = await fetch(url.toString());
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Export failed (${r.status})`);
    return j;
  },
  async importBackup(backup) {
    const r = await fetch("/api/backup/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backup, locationId: getLocationId() })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Import failed (${r.status})`);
    return j;
  }
};
function useLocationId() {
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const fromUrl = searchParams.get("locationId");
    if (fromUrl) persistLocationId(fromUrl);
  }, [searchParams]);
  return getLocationId();
}
const STORAGE_KEY = "ghl_ai_config";
const AI_EVENT = "aiconfig-changed";
const SHARED_KEY = "ghl_ai_shared";
function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function isShared() {
  try {
    return localStorage.getItem(SHARED_KEY) === "1";
  } catch {
    return false;
  }
}
function setShared(v) {
  try {
    if (v) localStorage.setItem(SHARED_KEY, "1");
    else localStorage.removeItem(SHARED_KEY);
  } catch {
  }
}
let loadedOnce = false;
function useAIConfig() {
  const [config, setConfig] = useState(readLocal);
  const [locationName, setLocationName] = useState("");
  const [locationLogo, setLocationLogo] = useState("");
  const [loading, setLoading] = useState(!loadedOnce);
  const locationId = getLocationId();
  const refresh = useCallback(async () => {
    var _a;
    if (!locationId) {
      loadedOnce = true;
      setLoading(false);
      return;
    }
    try {
      const r = await apiFetch("/api/settings");
      const d = await r.json();
      setLocationName(d.locationName || "");
      setLocationLogo(d.locationLogo || "");
    } catch {
    }
    try {
      const local = readLocal();
      const wasShared = isShared();
      const kr = await apiFetch("/api/settings/ai-key").then((x) => x.json()).catch(() => null);
      if (kr) {
        if ((_a = kr.config) == null ? void 0 : _a.apiKey) {
          if (!(local == null ? void 0 : local.apiKey) || wasShared) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(kr.config));
            setShared(!!kr.shared);
            setConfig(kr.config);
            window.dispatchEvent(new Event(AI_EVENT));
          }
        } else if (wasShared && (local == null ? void 0 : local.apiKey)) {
          localStorage.removeItem(STORAGE_KEY);
          setShared(false);
          setConfig(null);
          window.dispatchEvent(new Event(AI_EVENT));
        }
      }
    } catch {
    } finally {
      loadedOnce = true;
      setLoading(false);
    }
  }, [locationId]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    const sync = () => setConfig(readLocal());
    window.addEventListener(AI_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AI_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  function saveConfig({ provider, apiKey, model, businessName }) {
    const stored = { provider, apiKey, model };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setShared(false);
    setConfig(stored);
    window.dispatchEvent(new Event(AI_EVENT));
    apiFetch("/api/settings/ai-key", {
      method: "PUT",
      body: JSON.stringify({ provider, apiKey, model })
    }).catch(() => {
    });
    if (businessName !== void 0) {
      apiFetch("/api/settings", {
        method: "POST",
        body: JSON.stringify({ locationId, businessName: businessName.trim() })
      }).then((r) => r.json()).then((d) => {
        if (d.locationName !== void 0) setLocationName(d.locationName);
      }).catch(() => {
      });
    }
  }
  function clearConfig() {
    localStorage.removeItem(STORAGE_KEY);
    setShared(false);
    setConfig(null);
    window.dispatchEvent(new Event(AI_EVENT));
    apiFetch("/api/settings/ai-key", { method: "DELETE" }).catch(() => {
    });
  }
  return { config, loading, locationName, locationLogo, saveConfig, clearConfig, refresh };
}
function withPreload(factory) {
  const Component = lazy(factory);
  Component.preload = factory;
  return Component;
}
const Dashboard = withPreload(() => import("./assets/Dashboard-Dwjws8MU.js"));
const CopywritersList = withPreload(() => import("./assets/CopywritersList-CkV70USI.js"));
const CopywritersChat = withPreload(() => import("./assets/CopywritersChat-I5skgXay.js"));
const Library = withPreload(() => import("./assets/Library-BiIltWSU.js"));
const CustomerDetail = withPreload(() => import("./assets/CustomerDetail-74-vXkQu.js"));
const LibraryChat = withPreload(() => import("./assets/LibraryChat-fdh054zA.js"));
const Settings = withPreload(() => import("./assets/Settings-OcO6Wapc.js"));
const Tasks = withPreload(() => import("./assets/Tasks-C1WCGwxj.js"));
const Hooks = withPreload(() => import("./assets/Hooks-3dkCEcup.js"));
const Workflows = withPreload(() => import("./assets/Workflows-D3oblaJ6.js"));
const Archive = withPreload(() => import("./assets/Archive-BxVK8TGk.js"));
const Analyzer = withPreload(() => import("./assets/Analyzer-CK5ufbtR.js"));
const FunnelArchitect = withPreload(() => import("./assets/FunnelArchitect-XNCHFlGU.js"));
const Pipeline = withPreload(() => import("./assets/Pipeline-l5LmIG25.js"));
const Admin = withPreload(() => import("./assets/Admin-uieHiv6y.js"));
const prefetchByKey = {
  dashboard: () => Dashboard.preload(),
  copywriters: () => {
    CopywritersList.preload();
    CopywritersChat.preload();
  },
  library: () => {
    Library.preload();
    CustomerDetail.preload();
    LibraryChat.preload();
  },
  architect: () => FunnelArchitect.preload(),
  hooks: () => Hooks.preload(),
  tasks: () => Tasks.preload(),
  pipeline: () => Pipeline.preload(),
  archive: () => Archive.preload(),
  analyzer: () => Analyzer.preload(),
  workflows: () => Workflows.preload(),
  admin: () => Admin.preload(),
  settings: () => Settings.preload()
};
function prefetchAll() {
  [
    Dashboard,
    CopywritersList,
    CopywritersChat,
    Library,
    CustomerDetail,
    LibraryChat,
    Settings,
    Tasks,
    Hooks,
    Workflows,
    Archive,
    Analyzer,
    FunnelArchitect,
    Pipeline,
    Admin
  ].forEach((c) => {
    try {
      c.preload();
    } catch {
    }
  });
}
const KEY = "ghl_session";
const EMAIL_KEY = "ghl_user_email";
function getSessionToken() {
  const s = ssrState();
  if (s && s.token != null) return s.token || "";
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}
function setSessionToken(token) {
  var _a;
  try {
    if (token) {
      localStorage.setItem(KEY, token);
      const email = (_a = decodeClaims(token)) == null ? void 0 : _a.email;
      if (email) localStorage.setItem(EMAIL_KEY, email);
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
  }
}
function getRememberedEmail() {
  try {
    return localStorage.getItem(EMAIL_KEY) || "";
  } catch {
    return "";
  }
}
function decodeClaims(t) {
  if (!t || t.indexOf(".") < 1) return null;
  try {
    let b = t.slice(0, t.indexOf(".")).replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    return JSON.parse(atob(b));
  } catch {
    return null;
  }
}
function getSessionClaims() {
  const s = ssrState();
  if (s && s.claims) return s.claims;
  return decodeClaims(getSessionToken());
}
function currentLocationId() {
  if (typeof window === "undefined") return "";
  try {
    const fromUrl = new URL(window.location.href).searchParams.get("locationId");
    return fromUrl || localStorage.getItem("ghl_location_id") || "";
  } catch {
    return "";
  }
}
async function reauth(origFetch = window.fetch.bind(window)) {
  const id = currentLocationId();
  if (!id) return "";
  try {
    const lr = await origFetch("/auth/location-login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: id })
    });
    const ld = await lr.json().catch(() => ({}));
    if (!lr.ok || !ld.token) return "";
    setSessionToken(ld.token);
    const email = getRememberedEmail();
    if (email) {
      const ur = await origFetch("/auth/user-login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ld.token}` },
        body: JSON.stringify({ locationId: id, email })
      });
      const ud = await ur.json().catch(() => ({}));
      if (ur.ok && ud.token) {
        setSessionToken(ud.token);
        return ud.token;
      }
    }
    return ld.token;
  } catch {
  }
  return "";
}
function userInitials(name, email) {
  const src = (name || email || "").trim();
  if (!src) return "ME";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}
const NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/",
    icon: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "18", height: "18", children: [
      /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "7", height: "7" }),
      /* @__PURE__ */ jsx("rect", { x: "14", y: "3", width: "7", height: "7" }),
      /* @__PURE__ */ jsx("rect", { x: "14", y: "14", width: "7", height: "7" }),
      /* @__PURE__ */ jsx("rect", { x: "3", y: "14", width: "7", height: "7" })
    ] })
  },
  {
    key: "copywriters",
    label: "Copywriters",
    path: "/copywriters",
    icon: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "18", height: "18", children: [
      /* @__PURE__ */ jsx("path", { d: "M12 20h9" }),
      /* @__PURE__ */ jsx("path", { d: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" })
    ] })
  },
  {
    key: "library",
    label: "Library",
    path: "/library",
    icon: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "18", height: "18", children: [
      /* @__PURE__ */ jsx("path", { d: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20" }),
      /* @__PURE__ */ jsx("path", { d: "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" })
    ] })
  },
  {
    key: "architect",
    label: "Funnel Architect",
    path: "/architect",
    icon: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "18", height: "18", children: [
      /* @__PURE__ */ jsx("path", { d: "M3 21h18" }),
      /* @__PURE__ */ jsx("path", { d: "M5 21V7l7-4 7 4v14" }),
      /* @__PURE__ */ jsx("path", { d: "M9 21v-6h6v6" }),
      /* @__PURE__ */ jsx("path", { d: "M9 10h.01M15 10h.01" })
    ] })
  },
  {
    key: "hooks",
    label: "Hooks",
    path: "/hooks",
    icon: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "18", height: "18", children: [
      /* @__PURE__ */ jsx("path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }),
      /* @__PURE__ */ jsx("path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" })
    ] })
  },
  {
    key: "tasks",
    label: "Tasks",
    path: "/tasks",
    icon: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "18", height: "18", children: [
      /* @__PURE__ */ jsx("rect", { x: "3", y: "3", width: "5", height: "18", rx: "1" }),
      /* @__PURE__ */ jsx("rect", { x: "10", y: "3", width: "5", height: "12", rx: "1" }),
      /* @__PURE__ */ jsx("rect", { x: "17", y: "3", width: "5", height: "16", rx: "1" })
    ] })
  },
  {
    key: "pipeline",
    label: "Pipeline",
    path: "/pipeline",
    icon: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "18", height: "18", children: [
      /* @__PURE__ */ jsx("line", { x1: "8", y1: "6", x2: "21", y2: "6" }),
      /* @__PURE__ */ jsx("line", { x1: "8", y1: "12", x2: "21", y2: "12" }),
      /* @__PURE__ */ jsx("line", { x1: "8", y1: "18", x2: "21", y2: "18" }),
      /* @__PURE__ */ jsx("circle", { cx: "3.5", cy: "6", r: "1.5" }),
      /* @__PURE__ */ jsx("circle", { cx: "3.5", cy: "12", r: "1.5" }),
      /* @__PURE__ */ jsx("circle", { cx: "3.5", cy: "18", r: "1.5" })
    ] })
  },
  {
    key: "archive",
    label: "Archive",
    path: "/archive",
    icon: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "18", height: "18", children: [
      /* @__PURE__ */ jsx("rect", { x: "3", y: "4", width: "18", height: "4", rx: "1" }),
      /* @__PURE__ */ jsx("path", { d: "M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" }),
      /* @__PURE__ */ jsx("path", { d: "M10 12h4" })
    ] })
  },
  {
    key: "admin",
    label: "Admin",
    path: "/admin",
    adminOnly: true,
    icon: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "18", height: "18", children: [
      /* @__PURE__ */ jsx("path", { d: "M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z" }),
      /* @__PURE__ */ jsx("path", { d: "m9 12 2 2 4-4" })
    ] })
  },
  {
    key: "settings",
    label: "Settings",
    path: "/settings",
    icon: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "18", height: "18", children: [
      /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "3" }),
      /* @__PURE__ */ jsx("path", { d: "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" })
    ] })
  }
];
function navPath(path) {
  const id = getLocationId();
  if (!id) return path;
  const u = new URL(path === "/" ? "/" : path, "http://x");
  u.searchParams.set("locationId", id);
  return u.pathname + u.search;
}
function Layout() {
  useLocationId();
  const { config, loading: configLoading, locationName } = useAIConfig();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    const id = idle(() => prefetchAll());
    return () => {
      try {
        (window.cancelIdleCallback || clearTimeout)(id);
      } catch {
      }
    };
  }, []);
  const locationId = getLocationId();
  const user = getSessionClaims();
  const navItems = NAV_ITEMS.filter((i) => !i.adminOnly || (user == null ? void 0 : user.adm));
  const userName = (user == null ? void 0 : user.name) || (user == null ? void 0 : user.email) || "";
  const initials = user ? userInitials(user.name, user.email) : locationId ? locationId.slice(0, 2).toUpperCase() : "GL";
  const routerLocation = useLocation();
  function isActive(item) {
    const path = routerLocation.pathname;
    if (item.path === "/") return path === "/" || path === "/dashboard";
    return path.startsWith(item.path);
  }
  return /* @__PURE__ */ jsxs("div", { className: "app-shell", children: [
    /* @__PURE__ */ jsxs("aside", { className: "sidebar", children: [
      /* @__PURE__ */ jsxs("div", { className: "sb-logo", children: [
        /* @__PURE__ */ jsx("div", { className: "sb-logo-icon", children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "#fff", width: "18", height: "18", children: /* @__PURE__ */ jsx("path", { d: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" }) }) }),
        /* @__PURE__ */ jsx("span", { className: "sb-logo-name", children: "Automator" })
      ] }),
      /* @__PURE__ */ jsxs("nav", { className: "sb-nav", children: [
        /* @__PURE__ */ jsx("div", { className: "sb-section-label", children: "Menu" }),
        navItems.map((item) => /* @__PURE__ */ jsxs(
          NavLink,
          {
            to: navPath(item.path),
            end: item.path === "/",
            onMouseEnter: () => {
              var _a;
              return (_a = prefetchByKey[item.key]) == null ? void 0 : _a.call(prefetchByKey);
            },
            onFocus: () => {
              var _a;
              return (_a = prefetchByKey[item.key]) == null ? void 0 : _a.call(prefetchByKey);
            },
            className: ({ isActive: ra }) => `nav-item ${ra || isActive(item) ? "active" : ""}`,
            children: [
              item.icon,
              /* @__PURE__ */ jsx("span", { children: item.label })
            ]
          },
          item.key
        ))
      ] }),
      /* @__PURE__ */ jsx("div", { className: "sb-ai-status", children: configLoading ? /* @__PURE__ */ jsx("span", { className: "chip", style: { fontSize: ".72rem" }, children: "AI …" }) : (config == null ? void 0 : config.apiKey) ? /* @__PURE__ */ jsxs("span", { className: "chip chip-green", style: { fontSize: ".72rem", gap: 5 }, children: [
        /* @__PURE__ */ jsx("svg", { width: "7", height: "7", viewBox: "0 0 8 8", children: /* @__PURE__ */ jsx("circle", { cx: "4", cy: "4", r: "4", fill: "currentColor" }) }),
        "AI Active"
      ] }) : /* @__PURE__ */ jsx("span", { className: "chip chip-red", style: { fontSize: ".72rem" }, children: "AI not configured" }) }),
      /* @__PURE__ */ jsxs("div", { className: "sb-user-wrap", ref: menuRef, children: [
        /* @__PURE__ */ jsxs("div", { className: "sb-user", onClick: () => setMenuOpen((v) => !v), children: [
          /* @__PURE__ */ jsx("div", { className: "sb-avatar", children: /* @__PURE__ */ jsx("span", { children: initials }) }),
          /* @__PURE__ */ jsxs("div", { className: "sb-user-info", children: [
            /* @__PURE__ */ jsx("div", { className: "sb-user-name", children: userName || locationName || "My Location" }),
            userName && /* @__PURE__ */ jsx("div", { style: { fontSize: ".72rem", color: "var(--sub)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: locationName || "Location" })
          ] }),
          /* @__PURE__ */ jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "#94A3B8", strokeWidth: "2", children: [
            /* @__PURE__ */ jsx("circle", { cx: "12", cy: "5", r: "1" }),
            /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "1" }),
            /* @__PURE__ */ jsx("circle", { cx: "12", cy: "19", r: "1" })
          ] })
        ] }),
        menuOpen && /* @__PURE__ */ jsx("div", { className: "user-menu", children: /* @__PURE__ */ jsxs(
          "button",
          {
            className: "user-menu-item danger",
            onClick: () => {
              fetch("/auth/logout", { method: "POST", credentials: "include" }).catch(() => {
              });
              localStorage.removeItem("ghl_ai_config");
              localStorage.removeItem("ghl_session");
              localStorage.removeItem("ghl_user_email");
              localStorage.removeItem("ghl_location_id");
              navigate("/login", { replace: true });
            },
            children: [
              /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", width: "16", height: "16", children: [
                /* @__PURE__ */ jsx("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }),
                /* @__PURE__ */ jsx("polyline", { points: "16 17 21 12 16 7" }),
                /* @__PURE__ */ jsx("line", { x1: "21", y1: "12", x2: "9", y2: "12" })
              ] }),
              "Sign out"
            ]
          }
        ) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("main", { className: "main", children: [
      !configLoading && !config && /* @__PURE__ */ jsxs("div", { className: "ai-banner", children: [
        /* @__PURE__ */ jsx("span", { children: "No AI provider connected — set an API key to use Copywriters." }),
        /* @__PURE__ */ jsx(NavLink, { to: navPath("/settings"), className: "ai-banner-link", children: "Set up AI →" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "page-enter", children: /* @__PURE__ */ jsx(Outlet, {}) }, routerLocation.pathname)
    ] }),
    /* @__PURE__ */ jsx("nav", { className: "mobile-nav", children: navItems.map((item) => /* @__PURE__ */ jsxs(
      NavLink,
      {
        to: navPath(item.path),
        end: item.path === "/",
        className: ({ isActive: ra }) => `mobile-nav-item ${ra || isActive(item) ? "active" : ""}`,
        children: [
          item.icon,
          /* @__PURE__ */ jsx("span", { children: item.label })
        ]
      },
      item.key
    )) })
  ] });
}
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    __publicField(this, "handleReload", () => {
      try {
        window.location.reload();
      } catch {
      }
    });
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[app] render error:", error, info == null ? void 0 : info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return /* @__PURE__ */ jsx("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg, #0F172A)", color: "var(--text, #F1F5F9)" }, children: /* @__PURE__ */ jsxs("div", { style: { maxWidth: 460, textAlign: "center" }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: "2.5rem", marginBottom: 8 }, children: "⚠️" }),
      /* @__PURE__ */ jsx("h1", { style: { fontSize: "1.25rem", margin: "0 0 8px" }, children: "Something went wrong" }),
      /* @__PURE__ */ jsx("p", { style: { opacity: 0.75, fontSize: ".95rem", lineHeight: 1.5, margin: "0 0 20px" }, children: "This page hit an unexpected error. Reloading usually fixes it — your saved work isn’t affected." }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: this.handleReload,
          style: { background: "var(--accent, #6366F1)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: ".95rem", fontWeight: 600, cursor: "pointer" },
          children: "Reload"
        }
      )
    ] }) });
  }
}
function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [locationId, setLocationId] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  function enterApp(id) {
    navigate(`/?locationId=${(id || locationId || getLocationId() || "").trim()}`, { replace: true });
  }
  useEffect(() => {
    var _a;
    const id = getLocationId();
    const hasLocation = id && getSessionToken();
    const hasUser = !!((_a = getSessionClaims()) == null ? void 0 : _a.uid);
    if (hasLocation && hasUser) enterApp(id);
    else if (hasLocation) {
      setLocationId(id);
      setStep(2);
    } else if (id) setLocationId(id);
  }, [navigate]);
  async function handleEmailSubmit(e) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) {
      setError("Please enter your email");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const r = await fetch("/auth/user-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.token) {
        setError(data.message || "That email is not a user on this location.");
        setVerifying(false);
        return;
      }
      setSessionToken(data.token);
      enterApp();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setVerifying(false);
    }
  }
  async function handleLocationSubmit(e) {
    e.preventDefault();
    const id = locationId.trim();
    if (!id) {
      setError("Please enter your Location ID");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const r = await fetch("/auth/location-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: id })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.token) {
        setError(data.message || "This Location ID is not authorized.");
        setVerifying(false);
        return;
      }
      setSessionToken(data.token);
      persistLocationId(id);
      setStep(2);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setVerifying(false);
    }
  }
  return /* @__PURE__ */ jsx("div", { style: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    padding: 24
  }, children: /* @__PURE__ */ jsxs("div", { style: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "40px 36px",
    width: "100%",
    maxWidth: 420
  }, children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }, children: [
      /* @__PURE__ */ jsx("div", { style: {
        width: 36,
        height: 36,
        borderRadius: 9,
        background: "var(--accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0
      }, children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "#fff", width: "18", height: "18", children: /* @__PURE__ */ jsx("path", { d: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" }) }) }),
      /* @__PURE__ */ jsx("span", { style: { fontWeight: 700, fontSize: "1.125rem", color: "var(--text)" }, children: "Automator" }),
      /* @__PURE__ */ jsx("div", { style: { marginLeft: "auto", display: "flex", gap: 6 }, children: [1, 2].map((s) => /* @__PURE__ */ jsx("div", { style: {
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: s === step ? "var(--accent)" : "var(--border)",
        transition: "background .2s"
      } }, s)) })
    ] }),
    step === 1 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { style: { marginBottom: 24 }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: "1.125rem", color: "var(--text)", marginBottom: 6 }, children: "Step 1 of 2 — Location ID" }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: ".875rem", color: "var(--sub)" }, children: "Enter the Automator Location ID for your sub-account" })
      ] }),
      /* @__PURE__ */ jsxs("form", { onSubmit: handleLocationSubmit, children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Location ID" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-input",
              type: "text",
              value: locationId,
              onChange: (e) => {
                setLocationId(e.target.value);
                setError("");
              },
              placeholder: "e.g. KogOOG0gkaYzCE9gAaWr",
              autoComplete: "off",
              autoFocus: true,
              spellCheck: false
            }
          ),
          error && /* @__PURE__ */ jsx("div", { style: { fontSize: ".8125rem", color: "var(--danger)", marginTop: 6 }, children: error }),
          /* @__PURE__ */ jsx("div", { className: "text-xs text-sub mt-1", children: "Found in Automator → Settings → Business Info" })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "submit",
            className: "btn btn-primary",
            style: { width: "100%", marginTop: 8 },
            disabled: !locationId.trim() || verifying,
            children: verifying ? "Verifying…" : "Next →"
          }
        )
      ] })
    ] }),
    step === 2 && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { style: { marginBottom: 24 }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: "1.125rem", color: "var(--text)", marginBottom: 6 }, children: "Step 2 of 2 — Your Email" }),
        /* @__PURE__ */ jsx("div", { style: { fontSize: ".875rem", color: "var(--sub)" }, children: "Enter the email of your Automator account on this location — used to keep your work private to you" })
      ] }),
      /* @__PURE__ */ jsxs("form", { onSubmit: handleEmailSubmit, children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Email" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-input",
              type: "email",
              value: email,
              onChange: (e) => {
                setEmail(e.target.value);
                setError("");
              },
              placeholder: "you@company.com",
              autoComplete: "email",
              autoFocus: true
            }
          ),
          error && /* @__PURE__ */ jsx("div", { style: { fontSize: ".8125rem", color: "var(--danger)", marginTop: 6 }, children: error }),
          /* @__PURE__ */ jsx("div", { className: "text-xs text-sub mt-1", children: "Must match a user on this Automator location. You can add your AI API key later in Settings." })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "submit",
            className: "btn btn-primary",
            style: { width: "100%", marginTop: 8 },
            disabled: !email.trim() || verifying,
            children: verifying ? "Verifying…" : "Enter Automator →"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "btn btn-ghost",
            style: { width: "100%", marginTop: 8 },
            onClick: () => {
              setStep(1);
              setError("");
            },
            children: "← Back"
          }
        )
      ] })
    ] })
  ] }) });
}
async function bootstrapAuth() {
  if (window.location.pathname === "/login") return;
  const claims = getSessionClaims();
  if ((claims == null ? void 0 : claims.uid) && claims.exp && Date.now() < claims.exp) return;
  try {
    const s = await fetch("/auth/session", { credentials: "include" }).then((r) => r.json()).catch(() => null);
    if ((s == null ? void 0 : s.authenticated) && s.locationId) persistLocationId(s.locationId);
  } catch {
  }
  const id = getLocationId();
  if (id) {
    await reauth();
    persistLocationId(id);
  }
}
function CopywritersChatKeyed() {
  const { type } = useParams();
  return /* @__PURE__ */ jsx(CopywritersChat, {}, type);
}
function RequireLocation({ children }) {
  var _a;
  const authed = getLocationId() && getSessionToken() && ((_a = getSessionClaims()) == null ? void 0 : _a.uid);
  if (authed) return children;
  if (typeof window === "undefined") return null;
  return /* @__PURE__ */ jsx(Navigate, { to: "/login", replace: true });
}
function App() {
  const [booting, setBooting] = useState(() => {
    const claims = getSessionClaims();
    if ((claims == null ? void 0 : claims.uid) && claims.exp && Date.now() < claims.exp) return false;
    if (typeof window === "undefined") return false;
    if (window.location.pathname === "/login") return false;
    return true;
  });
  useEffect(() => {
    let alive = true;
    bootstrapAuth().finally(() => {
      if (alive) setBooting(false);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const ping = () => {
      var _a;
      try {
        if ((_a = getSessionClaims()) == null ? void 0 : _a.uid) fetch("/auth/ping", { method: "POST" }).catch(() => {
        });
      } catch {
      }
    };
    ping();
    const id = setInterval(ping, 6e4);
    const onVis = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  const Loading = /* @__PURE__ */ jsx("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) });
  if (booting) return Loading;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(ToastContainer, { position: "bottom-right", autoClose: 3e3, newestOnTop: true, theme: "colored", pauseOnFocusLoss: false }),
    /* @__PURE__ */ jsx(ErrorBoundary, { children: /* @__PURE__ */ jsx(Suspense, { fallback: Loading, children: /* @__PURE__ */ jsxs(Routes, { children: [
      /* @__PURE__ */ jsx(Route, { path: "login", element: /* @__PURE__ */ jsx(Login, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "admin", element: /* @__PURE__ */ jsx(Admin, {}) }),
      /* @__PURE__ */ jsxs(Route, { element: /* @__PURE__ */ jsx(RequireLocation, { children: /* @__PURE__ */ jsx(Layout, {}) }), children: [
        /* @__PURE__ */ jsx(Route, { index: true, element: /* @__PURE__ */ jsx(Dashboard, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "dashboard", element: /* @__PURE__ */ jsx(Dashboard, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "copywriters", element: /* @__PURE__ */ jsx(CopywritersList, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "copywriters/:type", element: /* @__PURE__ */ jsx(CopywritersChatKeyed, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "library", element: /* @__PURE__ */ jsx(Library, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "library/:customerId", element: /* @__PURE__ */ jsx(CustomerDetail, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "library/:customerId/:copyId", element: /* @__PURE__ */ jsx(LibraryChat, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "tasks", element: /* @__PURE__ */ jsx(Tasks, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "hooks", element: /* @__PURE__ */ jsx(Hooks, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "workflows", element: /* @__PURE__ */ jsx(Workflows, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "archive", element: /* @__PURE__ */ jsx(Archive, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "analyzer", element: /* @__PURE__ */ jsx(Analyzer, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "architect", element: /* @__PURE__ */ jsx(FunnelArchitect, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "pipeline", element: /* @__PURE__ */ jsx(Pipeline, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "settings", element: /* @__PURE__ */ jsx(Settings, {}) }),
        /* @__PURE__ */ jsx(Route, { path: "*", element: /* @__PURE__ */ jsx(Navigate, { to: "/", replace: true }) })
      ] })
    ] }) }) })
  ] });
}
const als = new AsyncLocalStorage();
setStateResolver(() => als.getStore() || null);
function renderStream(url, ssr, handlers) {
  return als.run(ssr || null, () => {
    const app = /* @__PURE__ */ jsx(StaticRouter, { location: url, children: /* @__PURE__ */ jsx(App, {}) });
    return renderToPipeableStream(app, handlers);
  });
}
export {
  api as a,
  apiFetch as b,
  getSessionClaims as c,
  getSessionToken as d,
  getLocationId as g,
  persistLocationId as p,
  renderStream,
  setSessionToken as s,
  useAIConfig as u
};
