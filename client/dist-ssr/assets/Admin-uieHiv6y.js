import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { a as api, c as getSessionClaims, d as getSessionToken, g as getLocationId, s as setSessionToken, p as persistLocationId } from "../entry-server.mjs";
import { a as notifyError, c as confirmToast, n as notifySuccess } from "./toast-DrUOosTv.js";
import "node:async_hooks";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-toastify";
function relTime(ts) {
  if (!ts) return "never";
  const m = Math.floor((Date.now() - ts) / 6e4);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
const ONLINE_MS = 2 * 60 * 1e3;
const isOnline = (ts) => ts && Date.now() - ts < ONLINE_MS;
function AdminConsole() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  async function load() {
    setLoading(true);
    try {
      const d = await api.getAdminUsers();
      setUsers(d.users || []);
    } catch (e) {
      notifyError(e.message || "Could not load users");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 3e4);
    return () => clearInterval(id);
  }, []);
  async function revokeKey(u) {
    if (!await confirmToast(`Revoke the AI key for ${u.email}? They’ll need to add a new one to use AI.`, { confirmText: "Revoke key", danger: true })) return;
    setBusy(u.email);
    try {
      await api.revokeUserKey(u.email);
      setUsers((us) => us.map((x) => x.email === u.email ? { ...x, hasApiKey: false, keyMasked: "", provider: "" } : x));
      notifySuccess("API key revoked");
    } catch (e) {
      notifyError(e.message || "Failed");
    } finally {
      setBusy("");
    }
  }
  async function shareKey(u) {
    if (!await confirmToast(`Share your AI key with ${u.email}? They’ll be able to use all AI features on your key until you revoke it.`, { confirmText: "Share my key", danger: false })) return;
    setBusy(u.email);
    try {
      await api.shareUserKey(u.email);
      await load();
      notifySuccess("Your key is shared — they can use all features now");
    } catch (e) {
      notifyError(e.message || "Failed");
    } finally {
      setBusy("");
    }
  }
  async function toggleBlock(u) {
    const next = !u.blocked;
    if (next && !await confirmToast(`Force ${u.email} to sign out and block their access? They can’t sign back in until you restore it.`, { confirmText: "Log out & block", danger: true })) return;
    setBusy(u.email);
    try {
      await api.setUserBlocked(u.email, next);
      setUsers((us) => us.map((x) => x.email === u.email ? { ...x, blocked: next } : x));
      notifySuccess(next ? "User logged out & blocked" : "Access restored");
    } catch (e) {
      notifyError(e.message || "Failed");
    } finally {
      setBusy("");
    }
  }
  const query = q.trim().toLowerCase();
  const rows = query ? users.filter((u) => (u.email + " " + u.name).toLowerCase().includes(query)) : users;
  const onlineCount = users.filter((u) => isOnline(u.lastSeen) && !u.blocked).length;
  const stat = (n, label, color) => /* @__PURE__ */ jsxs("div", { style: { flex: "1 1 90px", minWidth: 0, textAlign: "center", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)" }, children: [
    /* @__PURE__ */ jsx("div", { style: { fontSize: "1.15rem", fontWeight: 800, color: color || "var(--text)" }, children: n }),
    /* @__PURE__ */ jsx("div", { style: { fontSize: ".62rem", fontWeight: 700, letterSpacing: ".08em", color: "var(--sub)" }, children: label })
  ] });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }, children: [
      stat(users.length, "USERS"),
      stat(onlineCount, "ONLINE", "#16A34A"),
      stat(users.filter((u) => u.hasApiKey).length, "WITH KEY", "var(--accent)"),
      stat(users.filter((u) => u.blocked).length, "BLOCKED", users.some((u) => u.blocked) ? "var(--danger)" : "var(--sub)")
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "10px 0 16px" }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontSize: ".8rem", color: "var(--sub)" }, children: "Everyone who has signed in. Revoke a user’s AI key or force them to sign out (also blocks re-login until restored)." }),
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ jsx("input", { className: "form-input", style: { flex: "1 1 160px", minWidth: 0, maxWidth: 240, height: 34 }, placeholder: "Search name or email…", value: q, onChange: (e) => setQ(e.target.value) }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: load, disabled: loading, children: "Refresh" })
      ] })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { style: { padding: 32, display: "flex", justifyContent: "center" }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) }) : rows.length === 0 ? /* @__PURE__ */ jsx("div", { className: "card empty-state", style: { padding: 32 }, children: /* @__PURE__ */ jsx("div", { className: "empty-sub", children: "No users found." }) }) : /* @__PURE__ */ jsx("div", { className: "card", style: { padding: 0, overflow: "hidden" }, children: /* @__PURE__ */ jsx("div", { style: { overflowX: "auto" }, children: /* @__PURE__ */ jsxs("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: ".86rem", minWidth: 720 }, children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { style: { textAlign: "left", color: "var(--sub)", fontSize: ".66rem", letterSpacing: ".06em" }, children: [
        /* @__PURE__ */ jsx("th", { style: { padding: "11px 16px" }, children: "USER" }),
        /* @__PURE__ */ jsx("th", { style: { padding: "11px 16px" }, children: "EMAIL" }),
        /* @__PURE__ */ jsx("th", { style: { padding: "11px 16px" }, children: "API KEY" }),
        /* @__PURE__ */ jsx("th", { style: { padding: "11px 16px" }, children: "LOCATIONS" }),
        /* @__PURE__ */ jsx("th", { style: { padding: "11px 16px" }, children: "LAST SEEN" }),
        /* @__PURE__ */ jsx("th", { style: { padding: "11px 16px", textAlign: "right" }, children: "ACTIONS" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: rows.map((u) => {
        var _a;
        const acting = busy === u.email;
        return /* @__PURE__ */ jsxs("tr", { style: { borderTop: "1px solid var(--border)", opacity: u.blocked ? 0.6 : 1 }, children: [
          /* @__PURE__ */ jsx("td", { style: { padding: "12px 16px" }, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
            /* @__PURE__ */ jsx("span", { style: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: u.blocked ? "var(--danger)" : isOnline(u.lastSeen) ? "#16A34A" : "var(--border)" }, title: u.blocked ? "Blocked" : isOnline(u.lastSeen) ? "Online" : "Offline" }),
            /* @__PURE__ */ jsx("span", { style: { fontWeight: 600 }, children: u.name || "—" }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: ".68rem", fontWeight: 600, color: isOnline(u.lastSeen) && !u.blocked ? "#16A34A" : "var(--sub)" }, children: u.blocked ? "" : isOnline(u.lastSeen) ? "online" : "offline" }),
            u.isAdmin && /* @__PURE__ */ jsx("span", { className: "chip chip-green", style: { fontSize: ".62rem" }, children: "admin" }),
            u.blocked && /* @__PURE__ */ jsx("span", { className: "chip chip-red", style: { fontSize: ".62rem" }, children: "blocked" })
          ] }) }),
          /* @__PURE__ */ jsx("td", { style: { padding: "12px 16px", color: "var(--sub)" }, children: u.email }),
          /* @__PURE__ */ jsx("td", { style: { padding: "12px 16px" }, children: u.hasApiKey ? /* @__PURE__ */ jsxs("span", { style: { display: "inline-flex", alignItems: "center", gap: 6 }, children: [
            /* @__PURE__ */ jsxs("span", { style: { fontFamily: "ui-monospace, monospace", fontSize: ".8rem" }, children: [
              u.provider ? `${u.provider} · ` : "",
              u.keyMasked
            ] }),
            u.keyShared && /* @__PURE__ */ jsx("span", { className: "chip", style: { fontSize: ".6rem", background: "var(--accent-bg, #EFF6FF)", color: "var(--accent)" }, children: "shared" })
          ] }) : /* @__PURE__ */ jsx("span", { style: { color: "var(--sub)" }, children: "—" }) }),
          /* @__PURE__ */ jsx("td", { style: { padding: "12px 16px", color: "var(--sub)" }, children: ((_a = u.locations) == null ? void 0 : _a.length) || 0 }),
          /* @__PURE__ */ jsx("td", { style: { padding: "12px 16px", color: "var(--sub)" }, children: relTime(u.lastSeen) }),
          /* @__PURE__ */ jsx("td", { style: { padding: "10px 16px" }, children: /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }, children: [
            !u.hasApiKey && !u.isAdmin && isOnline(u.lastSeen) && !u.blocked && /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", disabled: acting, style: { color: "var(--accent)" }, onClick: () => shareKey(u), children: "Share my key" }),
            /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", disabled: acting || !u.hasApiKey, style: { color: u.hasApiKey ? "var(--danger)" : "var(--sub)" }, onClick: () => revokeKey(u), children: "Revoke key" }),
            u.blocked ? /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", disabled: acting, onClick: () => toggleBlock(u), children: "Restore access" }) : /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", disabled: acting, style: { color: "var(--danger)" }, onClick: () => toggleBlock(u), children: "Log out" })
          ] }) })
        ] }, u.email);
      }) })
    ] }) }) })
  ] });
}
function AdminPortal() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [step, setStep] = useState(1);
  const [locationId, setLocationId] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const claims = getSessionClaims();
  const signedIn = !!getSessionToken() && !!(claims == null ? void 0 : claims.uid);
  useEffect(() => {
    const id = getLocationId();
    if (id && !signedIn) {
      setLocationId(id);
      if (getSessionToken()) setStep(2);
    }
  }, []);
  async function submitLocation(e) {
    e.preventDefault();
    const id = locationId.trim();
    if (!id) {
      setError("Enter your Location ID");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const r = await fetch("/auth/location-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId: id }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.token) {
        setError(d.message || "This Location ID is not authorized.");
        return;
      }
      setSessionToken(d.token);
      persistLocationId(id);
      setStep(2);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setVerifying(false);
    }
  }
  async function submitEmail(e) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) {
      setError("Enter your admin email");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const r = await fetch("/auth/user-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: addr }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.token) {
        setError(d.message || "That email is not a user on this location.");
        return;
      }
      setSessionToken(d.token);
      setTick((t) => t + 1);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setVerifying(false);
    }
  }
  function signOut() {
    fetch("/auth/logout", { method: "POST", credentials: "include" }).catch(() => {
    });
    localStorage.removeItem("ghl_session");
    localStorage.removeItem("ghl_user_email");
    setStep(1);
    setEmail("");
    setTick((t) => t + 1);
  }
  const shell = (children, wide) => /* @__PURE__ */ jsxs("div", { style: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }, children: [
    /* @__PURE__ */ jsx("div", { style: { borderBottom: "1px solid var(--border)", background: "var(--card)" }, children: /* @__PURE__ */ jsxs("div", { style: { maxWidth: wide ? 1080 : 460, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 10 }, children: [
      /* @__PURE__ */ jsx("span", { style: { width: 30, height: 30, borderRadius: 8, background: "var(--accent)", display: "grid", placeItems: "center", flexShrink: 0 }, children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "#fff", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "17", height: "17", children: [
        /* @__PURE__ */ jsx("path", { d: "M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z" }),
        /* @__PURE__ */ jsx("path", { d: "m9 12 2 2 4-4" })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { style: { fontWeight: 700, letterSpacing: "-.01em" }, children: [
        "Automator ",
        /* @__PURE__ */ jsx("span", { style: { color: "var(--sub)", fontWeight: 600 }, children: "Admin" })
      ] }),
      signedIn && /* @__PURE__ */ jsxs("div", { style: { marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ jsx("span", { style: { fontSize: ".8rem", color: "var(--sub)" }, children: claims == null ? void 0 : claims.email }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-secondary btn-sm", onClick: () => navigate(`/?locationId=${getLocationId()}`), children: "← Dashboard" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-ghost btn-sm", onClick: signOut, children: "Sign out" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx("div", { style: { maxWidth: wide ? 1080 : 460, width: "100%", margin: "0 auto", padding: wide ? "24px" : "48px 24px", flex: 1 }, children })
  ] });
  if (signedIn && (claims == null ? void 0 : claims.adm)) {
    return shell(
      /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("div", { className: "page-title", style: { marginBottom: 14 }, children: "User Administration" }),
        /* @__PURE__ */ jsx(AdminConsole, {})
      ] }),
      true
    );
  }
  if (signedIn && !(claims == null ? void 0 : claims.adm)) {
    return shell(
      /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: 32, textAlign: "center" }, children: [
        /* @__PURE__ */ jsx("div", { className: "empty-title", style: { marginBottom: 6 }, children: "Not an admin account" }),
        /* @__PURE__ */ jsxs("div", { className: "empty-sub", style: { marginBottom: 16 }, children: [
          /* @__PURE__ */ jsx("b", { children: claims == null ? void 0 : claims.email }),
          " doesn’t have admin access. Ask an administrator to add your email, or open the main app."
        ] }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary", onClick: () => navigate(`/?locationId=${getLocationId()}`), children: "Open Automator →" })
      ] })
    );
  }
  const stepDot = (n) => /* @__PURE__ */ jsx("div", { style: { width: 8, height: 8, borderRadius: "50%", background: n === step ? "var(--accent)" : "var(--border)" } });
  return shell(
    /* @__PURE__ */ jsxs("div", { className: "card", style: { padding: "32px 28px" }, children: [
      /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", marginBottom: 22 }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: "1.05rem" }, children: step === 1 ? "Admin sign-in" : "Verify your email" }),
        /* @__PURE__ */ jsxs("div", { style: { marginLeft: "auto", display: "flex", gap: 6 }, children: [
          stepDot(1),
          stepDot(2)
        ] })
      ] }),
      step === 1 ? /* @__PURE__ */ jsxs("form", { onSubmit: submitLocation, children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Location ID" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-input",
              value: locationId,
              autoFocus: true,
              spellCheck: false,
              onChange: (e) => {
                setLocationId(e.target.value);
                setError("");
              },
              placeholder: "e.g. KogOOG0gkaYzCE9gAaWr"
            }
          ),
          error && /* @__PURE__ */ jsx("div", { style: { fontSize: ".8125rem", color: "var(--danger)", marginTop: 6 }, children: error }),
          /* @__PURE__ */ jsx("div", { className: "text-xs text-sub mt-1", children: "Sign in with a location under your installed agency." })
        ] }),
        /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", style: { width: "100%", marginTop: 8 }, disabled: !locationId.trim() || verifying, children: verifying ? "Verifying…" : "Next →" })
      ] }) : /* @__PURE__ */ jsxs("form", { onSubmit: submitEmail, children: [
        /* @__PURE__ */ jsxs("div", { className: "form-group", children: [
          /* @__PURE__ */ jsx("label", { className: "form-label", children: "Admin email" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              className: "form-input",
              type: "email",
              value: email,
              autoFocus: true,
              autoComplete: "email",
              onChange: (e) => {
                setEmail(e.target.value);
                setError("");
              },
              placeholder: "you@youragency.com"
            }
          ),
          error && /* @__PURE__ */ jsx("div", { style: { fontSize: ".8125rem", color: "var(--danger)", marginTop: 6 }, children: error }),
          /* @__PURE__ */ jsx("div", { className: "text-xs text-sub mt-1", children: "Must be an admin email on this location." })
        ] }),
        /* @__PURE__ */ jsx("button", { type: "submit", className: "btn btn-primary", style: { width: "100%", marginTop: 8 }, disabled: !email.trim() || verifying, children: verifying ? "Verifying…" : "Enter admin console →" }),
        /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn-ghost", style: { width: "100%", marginTop: 8 }, onClick: () => {
          setStep(1);
          setError("");
        }, children: "← Back" })
      ] })
    ] })
  );
}
export {
  AdminPortal as default
};
