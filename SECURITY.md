# Security & Environment Guide

How Automator authenticates, the secrets it needs, and the steps to keep them safe.

---

## Required environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production, and Preview if used). Redeploy after any change — env vars only take effect on a new deployment.

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | **Yes** | Signs the session tokens that carry `locationId`, user id/email, and admin flag. Must be a strong random value known only to the server. **If unset, the app falls back to `GHL_CLIENT_SECRET`** — do not rely on that. |
| `GHL_CLIENT_ID` | Yes | GoHighLevel OAuth app client id. |
| `GHL_CLIENT_SECRET` | Yes | GoHighLevel OAuth app secret (code exchange + token refresh). |
| `GHL_REDIRECT_URI` | Yes | OAuth redirect — must be `https://<your-app>/auth/callback`. |
| `GHL_VERSION_ID` | Yes | GHL app version id. |
| `UPSTASH_REDIS_REST_URL` | Yes (prod) | Upstash Redis REST URL. Without it the app uses an in-memory store that resets on restart. |
| `UPSTASH_REDIS_REST_TOKEN` | Yes (prod) | Upstash Redis REST token. |
| `ADMIN_EMAILS` | Optional | Comma-separated admin emails (in addition to the built-in list in `lib/admins.js`). Case-insensitive. |
| `DIAG_KEY` | Optional | Unlocks the diagnostic endpoints without an admin session (`?key=` or `x-diag-key` header). |

---

## Why `SESSION_SECRET` matters

The session token is a signed statement — "this browser is location X, user Y, admin: yes/no." The server re-verifies the signature on every request, so a tampered or hand-crafted token is rejected. The signing key is `SESSION_SECRET`.

If `SESSION_SECRET` is unset, the app signs with `GHL_CLIENT_SECRET`. If that value ever leaks, anyone who has it can **forge a valid session for any location/email, including `adm: true`** — i.e. full data access and the admin console. Always set an independent, secret `SESSION_SECRET`.

Generate one locally (never paste it anywhere shared):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Changing `SESSION_SECRET` invalidates all existing sessions — everyone signs in again. User data and saved AI keys survive (keys are stored per-email, not in the session).

---

## Rotating a leaked secret

If `SESSION_SECRET` or `GHL_CLIENT_SECRET` is exposed:

1. **`SESSION_SECRET`** — generate a new value (command above), update it in Vercel, redeploy. All sessions reset; users re-login.
2. **`GHL_CLIENT_SECRET`** — regenerate it in the **GHL Marketplace app** (Credentials), update `GHL_CLIENT_SECRET` in Vercel, redeploy. If a location's login then fails with a token error, re-run the agency install once to re-consent.

---

## Diagnostic endpoints (admin / DIAG_KEY only)

These expose install/token/location internals and are **not public** — they return `404` unless you pass `?key=<DIAG_KEY>` (or `x-diag-key` header) or are signed in as an admin:

```
/auth/diagnose?locationId=<id>   /auth/env-check        /auth/redis-dump
/auth/token-info                 /auth/agency-locations /auth/last-callback
/auth/last-install               /auth/registry-count
```

`/auth/env-check` reports only booleans (which vars are set) — use it to confirm `SESSION_SECRET: true` after setup.

---

## Access & isolation model

- **Install once on the agency.** The agency OAuth token mints per-location tokens for sub-accounts *that the app is installed on* (enable sub-account distribution in the GHL app, or install per sub-account). A PIT fallback (`/install`) exists for locations not covered by an agency install.
- **Login = Location ID + email.** The email is verified against real GHL users on that location; the AI API key is added later in Settings.
- **Per-user isolation.** Copies, customers, tasks, pipeline, hooks, brand voice, and the Funnel Architect playbook are scoped to `(location × user)`. New users start empty; legacy/unowned data is hidden (recoverable via Settings → Claim Existing Data).
- **Admin console** (`/admin`) is gated server-side by `ADMIN_EMAILS` / the built-in list — the client `adm` flag is cosmetic only.
- **API keys** are stored per user (by email) and are used by that user across all their locations. Admins may share their key with an online user (revocable).

---

## Transport & storage

- Served over HTTPS (Vercel/TLS). Session cookie is `HttpOnly; Secure; SameSite=None`, 30-day TTL, with silent re-auth.
- Persistent data lives in Upstash Redis. Most content has no expiry; brand voice/feedback/sessions and workflow drafts expire on a rolling TTL.
- **Backups:** Settings → Backup & Restore exports everything to a JSON file. That file contains API keys — keep it private.
