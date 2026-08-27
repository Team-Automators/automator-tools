// OAuth routes
//
// GET  /auth           → redirect to GHL OAuth
// GET  /auth/callback  → handle GHL redirect, store tokens, go to dashboard
// GET  /auth/logout    → remove tokens for a location

const express    = require('express');
const axios      = require('axios');
const router     = express.Router();
const oauthStore = require('../lib/oauth-store');
const keyStore   = require('../lib/key-store');
const session    = require('../lib/session');
const locationAccess = require('../lib/location-access');
const ghlUsers   = require('../lib/ghl-users');
const admins     = require('../lib/admins');
const userReg    = require('../lib/user-registry');
const block      = require('../lib/user-block-store');
const requireLocation = require('../middleware/require-location');
const { readSessionToken } = require('../middleware/require-location');

// Serialize the session token into an httpOnly cookie (defense-in-depth for
// standalone/Electron use; the client also sends it as a Bearer header so the
// app keeps working when embedded in the GHL iframe where third-party cookies
// may be blocked). SameSite=None; Secure lets it ride inside the iframe too.
function sessionCookie(token) {
  const maxAge = Math.floor(session.TTL_MS / 1000);
  return `ghl_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`;
}
const CLEAR_COOKIE = 'ghl_session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0';

const GHL_OAUTH = 'https://marketplace.gohighlevel.com';
const clean = (v) => (v || '').replace(/^﻿/, '').trim();

// A clear post-install confirmation page (agency- or location-aware).
function installedPage({ agency, companyId, locationId }) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const id  = agency ? companyId : (locationId || companyId);
  const idLabel = agency ? 'Agency ID' : 'Location ID';
  const title = agency ? 'Automator is installed on your agency' : 'Automator is connected';
  const body  = agency
    ? 'Every sub-account under this agency can now sign in with its Location ID and email — no per-account install needed.'
    : 'This sub-account is connected. Sign in with its Location ID and email to start.';
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Automator — Installed</title>
<style>
  :root{--bg:#F5F8FC;--card:#FFFFFF;--ink:#0E1A2F;--sub:#58697F;--line:#E3E9F2;--accent:#2563EB;--ok:#17935A;--ok-bg:#E6F5EC;--chip:#F1F5FB}
  @media(prefers-color-scheme:dark){:root{--bg:#0A0F1C;--card:#10192B;--ink:#E9EFF8;--sub:#93A2B8;--line:#223149;--accent:#5B8DEF;--ok:#3FBE83;--ok-bg:#10251C;--chip:#0D1626}}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:44px 40px;max-width:460px;width:100%;text-align:center;box-shadow:0 12px 40px -12px rgba(15,26,47,.18);animation:rise .4s cubic-bezier(.22,.61,.36,1) both}
  @keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  .ring{width:76px;height:76px;border-radius:50%;background:var(--ok-bg);display:flex;align-items:center;justify-content:center;margin:0 auto 24px}
  .check{stroke:var(--ok);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none;stroke-dasharray:30;stroke-dashoffset:30;animation:draw .5s .25s cubic-bezier(.4,0,.2,1) forwards}
  @keyframes draw{to{stroke-dashoffset:0}}
  .brand{display:inline-flex;align-items:center;gap:8px;margin-bottom:22px;color:var(--sub);font-weight:600;font-size:.9rem}
  .bolt{width:26px;height:26px;border-radius:7px;background:var(--accent);display:grid;place-items:center}
  h1{font-size:1.4rem;font-weight:800;letter-spacing:-.02em;margin-bottom:10px;line-height:1.25}
  p.sub{color:var(--sub);font-size:.95rem;line-height:1.6;margin-bottom:24px}
  .chip{display:inline-flex;align-items:center;gap:8px;background:var(--chip);border:1px solid var(--line);border-radius:9px;padding:8px 12px;font-size:.8rem;margin-bottom:26px;max-width:100%;word-break:break-all}
  .chip b{font-size:.64rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--sub);white-space:nowrap}
  .chip code{font-family:'SF Mono',ui-monospace,monospace;color:var(--ink)}
  .btn{display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#fff;text-decoration:none;font-weight:600;font-size:.95rem;padding:12px 26px;border-radius:11px}
  .note{margin-top:16px;font-size:.8rem;color:var(--sub)}
  @media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important}}
</style></head><body>
<div class="card">
  <div class="brand"><span class="bolt"><svg viewBox="0 0 24 24" fill="#fff" width="15" height="15"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></span>Automator</div>
  <div class="ring"><svg width="36" height="36" viewBox="0 0 24 24"><polyline class="check" points="4,13 9,18 20,7"/></svg></div>
  <h1>${esc(title)}</h1>
  <p class="sub">${esc(body)}</p>
  ${id ? `<div class="chip"><b>${esc(idLabel)}</b><code>${esc(id)}</code></div>` : ''}
  <div><a class="btn" href="/login">Go to sign-in →</a></div>
  <div class="note">You can close this tab — the install is saved.</div>
</div></body></html>`;
}

const GHL_API   = 'https://services.leadconnectorhq.com';
const SCOPES    = 'locations.readonly users.readonly users.write contacts.readonly contacts.write locations/customValues.readonly locations/customValues.write locations/tasks.readonly locations/tasks.write recurring-tasks.readonly recurring-tasks.write locations/tags.readonly locations/tags.write locations/templates.readonly oauth.write oauth.readonly conversations.readonly conversations/message.readonly conversations/message.write opportunities.readonly opportunities.write';

// GET /auth — start OAuth flow
router.get('/', (req, res) => {
  const clientId  = clean(process.env.GHL_CLIENT_ID);
  const versionId = clientId.split('-')[0];
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri:  clean(process.env.GHL_REDIRECT_URI),
    client_id:     clientId,
    scope:         SCOPES,
    version_id:    versionId,
  });
  res.redirect(`${GHL_OAUTH}/v2/oauth/chooselocation?${params}`);
});

// Records the outcome of the most recent OAuth callback so we can inspect it
// via GET /auth/last-callback (1h TTL). No secret values are stored.
async function recordCallback(rec) {
  try { await require('../lib/redis').set('ghl:lastcallback', { at: Date.now(), ...rec }, { ex: 3600 }); }
  catch {}
}

// GET /auth/callback — GHL redirects here after user approves
router.get('/callback', async (req, res) => {
  const { code, locationId } = req.query;

  if (!code) {
    await recordCallback({ stage: 'no_code', hasCode: false, locationId: locationId || null, query: Object.keys(req.query) });
    return res.status(400).send('Missing authorization code.');
  }

  await recordCallback({ stage: 'received', hasCode: true, locationId: locationId || null });

  try {
    const { data } = await axios.post(`${GHL_API}/oauth/token`,
      new URLSearchParams({
        client_id:     clean(process.env.GHL_CLIENT_ID),
        client_secret: clean(process.env.GHL_CLIENT_SECRET),
        grant_type:    'authorization_code',
        code,
        redirect_uri:  clean(process.env.GHL_REDIRECT_URI),
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const loc       = locationId || data.locationId || data.location_id;
    const companyId = data.companyId || data.company_id;

    // Company-level install — no locationId, use companyId as identifier
    const storeKey = loc || companyId;

    if (!storeKey) {
      await recordCallback({ stage: 'no_store_key', success: false, tokenKeys: Object.keys(data || {}) });
      return res.status(400).send(`OAuth succeeded but no locationId or companyId returned.<br><pre>${JSON.stringify(data, null, 2)}</pre>`);
    }

    const tokens = { ...data, locationId: loc || null, companyId, expires_at: Date.now() + (data.expires_in || 86400) * 1000 };
    await oauthStore.set(storeKey, tokens);
    await recordCallback({ stage: 'stored', success: true, storeKey, locationId: loc || null, companyId: companyId || null, hasAccess: !!data.access_token, hasRefresh: !!data.refresh_token });

    // Show a clear "Installed ✓" confirmation so an agency install is unambiguous.
    const isAgency = !loc && !!companyId;
    return res.status(200).send(installedPage({ agency: isAgency, companyId, locationId: loc }));
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error_description || err.message;
    await recordCallback({ stage: 'exchange_error', success: false, status: err.response?.status || 0, error: err.response?.data || err.message });
    console.error('[auth] OAuth callback error:', JSON.stringify(err.response?.data || err.message));
    res.status(500).send(`Authentication failed: ${msg}<br><pre>${JSON.stringify(err.response?.data, null, 2)}</pre>`);
  }
});

// GET /auth/token-info — decode the stored agency token to reveal what GHL
// actually granted (authClass + scopes). No secrets returned.
router.get('/token-info', async (req, res) => {
  try {
    const installs = await oauthStore.findAll().catch(() => []);
    const inst = installs.find(i => i.companyId) || installs[0];
    if (!inst) return res.json({ error: 'No agency OAuth install found.' });
    const token = (await oauthStore.getAccessToken(inst.locationId).catch(() => null)) || inst.access_token;
    if (!token) return res.json({ error: 'Could not resolve a token.' });

    let payload = {};
    try {
      const p = String(token).split('.')[1];
      payload = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    } catch (e) {
      return res.json({ error: 'Token is not a decodable JWT', detail: e.message });
    }
    const meta = payload.oauthMeta || {};
    const scopes = meta.scopes || (payload.scope ? String(payload.scope).split(' ') : null);
    res.json({
      authClass:          payload.authClass,          // "Company" (agency) vs "Location"
      authClassId:        payload.authClassId,
      primaryAuthClassId: payload.primaryAuthClassId,
      hasOauthWrite:      Array.isArray(scopes) ? scopes.includes('oauth.write') : null,
      hasOauthReadonly:   Array.isArray(scopes) ? scopes.includes('oauth.readonly') : null,
      scopeCount:         Array.isArray(scopes) ? scopes.length : null,
      scopes,
      versionId:          meta.versionId,
      exp:                payload.exp,
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// GET /auth/agency-locations — list the sub-accounts the agency install can
// actually access (so we can see whether a given Location ID is covered).
router.get('/agency-locations', async (req, res) => {
  try {
    const installs = await oauthStore.findAll().catch(() => []);
    const inst = installs.find(i => i.companyId) || installs[0];
    if (!inst) return res.json({ error: 'No agency OAuth install found.' });

    const companyId = inst.companyId;
    const token = (await oauthStore.getAccessToken(inst.locationId).catch(() => null)) || inst.access_token;
    if (!token) return res.json({ companyId, error: 'Could not resolve a fresh agency token.' });

    try {
      // Paginate through every sub-account (GHL caps each page ~100–250).
      const pageLimit = 100;
      let skip = 0, guard = 0;
      const all = [];
      const H = { Authorization: `Bearer ${token}`, Version: '2021-07-28', Accept: 'application/json' };
      let reportedTotal = null;
      while (guard++ < 200) { // hard stop at 20k
        const { data } = await axios.get(`${GHL_API}/locations/search`, {
          headers: H, params: { companyId, limit: pageLimit, skip }, timeout: 15000,
        });
        const raw = data.locations || data.data || (Array.isArray(data) ? data : []);
        if (data && (data.total ?? data.count) != null) reportedTotal = data.total ?? data.count;
        if (!raw.length) break;
        for (const l of raw) all.push({ id: l.id || l._id, name: l.name || l.businessName || '' });
        if (raw.length < pageLimit) break;
        skip += pageLimit;
      }
      const target = (req.query.locationId || '').trim();
      const matched = target ? all.find(l => l.id === target) || null : undefined;
      res.json({
        companyId,
        count: all.length,
        reportedTotal,
        includesTarget: target ? !!matched : undefined,
        target: target || undefined,
        matched,
        locations: all,
      });
    } catch (e) {
      res.json({
        companyId,
        error: e.response?.status || 0,
        message: e.response?.data?.message || e.response?.data?.error || e.message,
        hint: 'If this 401/403s, the agency token cannot list sub-accounts — the app likely was not installed on sub-accounts, or lacks locations.readonly scope.',
      });
    }
  } catch (e) {
    res.json({ error: e.message });
  }
});

// GET /auth/last-callback — inspect the most recent OAuth callback attempt.
router.get('/last-callback', async (req, res) => {
  try {
    const rec = await require('../lib/redis').get('ghl:lastcallback');
    res.json(rec || { note: 'No callback recorded. GHL has not redirected to /auth/callback yet — meaning the authorize was not completed, or the app’s Redirect URL does not point here.' });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// GET /auth/success — shown after OAuth succeeds, before setup form
router.get('/success', (req, res) => {
  const { locationId, companyId } = req.query;
  const installUrl = locationId && locationId !== 'undefined' ? `/install?locationId=${locationId}` : '/install';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>GHL Automator — Connected</title>
  <style>
    :root{--bg:#F0FDF4;--card:#FFFFFF;--text:#0F172A;--sub:#64748B;--accent:#16A34A;--accent-ring:#DCFCE7;--border:#D1FAE5;--loc-bg:#F0FDF4;--loc-border:#BBF7D0;--loc-text:#15803D;--btn:#1D4ED8;--btn-hover:#1E40AF;--note:#94A3B8;--bar-track:#E2E8F0;--shadow:0 4px 6px -1px rgba(0,0,0,.07),0 10px 40px -4px rgba(0,0,0,.06)}
    @media(prefers-color-scheme:dark){:root{--bg:#0A1628;--card:#111827;--text:#F9FAFB;--sub:#9CA3AF;--accent:#22C55E;--accent-ring:#14532D;--border:#166534;--loc-bg:#052E16;--loc-border:#166534;--loc-text:#4ADE80;--btn:#2563EB;--btn-hover:#3B82F6;--note:#6B7280;--bar-track:#1F2937;--shadow:0 4px 6px -1px rgba(0,0,0,.4),0 10px 40px -4px rgba(0,0,0,.3)}}
    :root[data-theme="light"]{--bg:#F0FDF4;--card:#FFFFFF;--text:#0F172A;--sub:#64748B;--accent:#16A34A;--accent-ring:#DCFCE7;--border:#D1FAE5;--loc-bg:#F0FDF4;--loc-border:#BBF7D0;--loc-text:#15803D;--btn:#1D4ED8;--btn-hover:#1E40AF;--note:#94A3B8;--bar-track:#E2E8F0}
    :root[data-theme="dark"]{--bg:#0A1628;--card:#111827;--text:#F9FAFB;--sub:#9CA3AF;--accent:#22C55E;--accent-ring:#14532D;--border:#166534;--loc-bg:#052E16;--loc-border:#166534;--loc-text:#4ADE80;--btn:#2563EB;--btn-hover:#3B82F6;--note:#6B7280;--bar-track:#1F2937}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;transition:background .3s}
    .card{background:var(--card);border-radius:20px;box-shadow:var(--shadow);padding:52px 44px 44px;max-width:440px;width:100%;text-align:center;animation:rise .45s cubic-bezier(.22,.61,.36,1) both}
    @keyframes rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    .ring{width:80px;height:80px;border-radius:50%;background:var(--accent-ring);display:flex;align-items:center;justify-content:center;margin:0 auto 28px;animation:pop .5s .15s cubic-bezier(.34,1.56,.64,1) both}
    @keyframes pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
    .check-path{stroke:var(--accent);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;fill:none;stroke-dasharray:30;stroke-dashoffset:30;animation:draw .45s .45s cubic-bezier(.4,0,.2,1) forwards}
    @keyframes draw{to{stroke-dashoffset:0}}
    h1{font-size:1.5rem;font-weight:700;color:var(--text);letter-spacing:-.02em;margin-bottom:10px;line-height:1.25}
    .sub{font-size:.9375rem;color:var(--sub);line-height:1.6;margin-bottom:28px}
    .loc-chip{display:inline-flex;align-items:center;gap:8px;background:var(--loc-bg);border:1px solid var(--loc-border);color:var(--loc-text);border-radius:8px;padding:8px 14px;font-family:'SF Mono','Fira Code',monospace;font-size:.8125rem;margin-bottom:32px;max-width:100%;word-break:break-all;line-height:1.4}
    .loc-label{font-family:-apple-system,sans-serif;font-size:.6875rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;opacity:.7;white-space:nowrap}
    hr{height:1px;background:var(--border);border:none;margin-bottom:28px}
    .bar-track{height:3px;background:var(--bar-track);border-radius:999px;overflow:hidden;margin-bottom:28px}
    .bar-fill{height:100%;width:0;background:var(--accent);border-radius:999px;animation:fill 3s .6s linear forwards}
    @keyframes fill{from{width:0}to{width:100%}}
    .btn{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;background:var(--btn);color:#fff;border-radius:10px;font-size:.9375rem;font-weight:600;text-decoration:none;transition:background .15s,transform .1s}
    .btn:hover{background:var(--btn-hover)}
    .btn:active{transform:scale(.98)}
    .arrow{width:16px;height:16px;transition:transform .15s}
    .btn:hover .arrow{transform:translateX(3px)}
    .note{margin-top:16px;font-size:.8125rem;color:var(--note)}
    @media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important}}
  </style>
</head>
<body>
<div class="card">
  <div class="ring">
    <svg width="38" height="38" viewBox="0 0 24 24" aria-hidden="true">
      <polyline class="check-path" points="4,13 9,18 20,7"/>
    </svg>
  </div>
  <h1>Authentication Successful</h1>
  <p class="sub">Your GHL account has been connected.<br>Enter your PITs below to activate the workflow actions.</p>
  ${locationId ? `<div class="loc-chip"><span class="loc-label">Location</span>${locationId}</div>` : ''}
  ${!locationId && companyId ? `<div class="loc-chip"><span class="loc-label">Company</span>${companyId}</div>` : ''}
  <hr>
  <div class="bar-track"><div class="bar-fill"></div></div>
  <a class="btn" href="${installUrl}">
    Continue to Setup
    <svg class="arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
  </a>
  <p class="note">Auto-redirecting in 3 seconds&hellip;</p>
</div>
<script>setTimeout(()=>{window.location.href='${installUrl}'},3000);</script>
</body>
</html>`);
});

// POST /auth/location-login  { locationId }
// Verifies the location belongs to an agency that installed the app (live GHL
// check), then issues a session token bound to that locationId.
router.post('/location-login', async (req, res) => {
  const locationId = (req.body?.locationId || '').trim();
  if (!locationId) return res.status(400).json({ error: 'locationId required' });

  let access;
  try {
    access = await locationAccess.verify(locationId);
  } catch (err) {
    console.error('[auth] location-login verify error:', err.message);
    return res.status(502).json({ error: 'verification_failed', message: 'Could not verify with GHL. Try again.' });
  }

  if (!access.ok) {
    if (access.transient) {
      return res.status(502).json({ error: 'verification_failed', message: 'Could not reach GHL to verify. Try again.' });
    }
    return res.status(403).json({
      error: 'not_authorized',
      message: 'This Location ID is not under an agency that has installed Automator. Install the app on your agency account first.',
    });
  }

  const token = session.sign({ lid: locationId, cid: access.companyId || '' });
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.json({ ok: true, token, locationId, companyId: access.companyId || '' });
});

// POST /auth/user-login  { email }
// Verifies the email is a real GHL user on the session's location, then issues
// a session that also carries the user identity (uid/email) for per-user scoping.
router.post('/user-login', requireLocation, async (req, res) => {
  const email = (req.body?.email || '').trim();
  if (!email) return res.status(400).json({ error: 'email required' });

  let result;
  try {
    result = await ghlUsers.findUserByEmail(req.locationId, email);
  } catch (err) {
    console.error('[auth] user-login lookup error:', err.message);
    return res.status(502).json({ error: 'lookup_failed', message: 'Could not verify with GHL. Try again.' });
  }

  if (!result.ok) {
    if (result.reason === 'users_unavailable') {
      return res.status(502).json({ error: 'users_unavailable', message: 'Could not reach GHL to verify users. Try again.' });
    }
    return res.status(403).json({ error: 'not_a_user', message: 'That email is not a user on this location.' });
  }

  // Blocked by an admin — deny sign-in.
  if (await block.isBlocked(result.user.email).catch(() => false)) {
    return res.status(403).json({ error: 'access_revoked', message: 'Your access has been revoked. Contact your administrator.' });
  }

  // Remember this user for the admin console.
  userReg.record(result.user.email, { name: result.user.name, locationId: req.locationId }).catch(() => {});

  const token = session.sign({
    lid:   req.locationId,
    cid:   req.companyId || '',
    uid:   result.user.id,
    email: result.user.email,
    name:  result.user.name,
    adm:   admins.isAdmin(result.user.email),   // drives the Admin console visibility
  });
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.json({ ok: true, token, user: result.user });
});

// GET /auth/diagnose?locationId=xxx — public auth diagnostic (no secrets).
// Explains WHY a location can or cannot authenticate.
router.get('/diagnose', async (req, res) => {
  const locationId = (req.query.locationId || '').trim();
  if (!locationId) return res.status(400).json({ error: 'locationId query param required' });

  const [oauthDirect, installs, pit] = await Promise.all([
    oauthStore.get(locationId).catch(() => null),
    oauthStore.findAll().catch(() => []),
    keyStore.get(locationId).catch(() => null),
  ]);

  let canMint = false;
  try { canMint = !!(await locationAccess.getLocationToken(locationId)); } catch {}

  // Deep per-install mint diagnostics — distinguishes "refresh token dead" from
  // "location not under this agency" from "code not deployed yet".
  const agencyMintDetail = [];
  for (const inst of installs) {
    const d = {
      companyId:        inst.companyId || null,
      installKey:       inst.locationId || null,
      hasRefreshToken:  !!inst.refresh_token,
      storedTokenExpired: inst.expires_at ? Date.now() >= inst.expires_at : null,
    };
    let agencyToken = null;
    try {
      agencyToken = await oauthStore.getAccessToken(inst.locationId).catch(() => null);
      d.refreshOk = !!agencyToken;               // false ⇒ refresh token is dead
    } catch (e) { d.refreshOk = false; d.refreshErr = e.message; }
    if (!agencyToken) agencyToken = inst.access_token || null;
    if (agencyToken) {
      try {
        await locationAccess.mintLocationToken(agencyToken, inst.companyId, locationId);
        d.mint = 'ok';
      } catch (e) {
        d.mint = 'fail';
        d.mintStatus = e.response?.status || 0;   // 401 ⇒ token bad; 4xx ⇒ loc not under agency
        d.mintMsg = (e.response?.data?.message || e.message || '').slice(0, 140);
      }
    } else { d.mint = 'no-token'; }
    agencyMintDetail.push(d);
  }

  let auth = { ok: false };
  try { auth = await locationAccess.authenticateLocation(locationId); } catch (e) { auth = { ok: false, error: e.message }; }

  const hasPit = !!(pit?.subLocationApiKey && pit?.agencyApiKey);

  const verdict = auth.ok
    ? `AUTHORIZED (via ${auth.via || 'unknown'}) — login/generation should work. If it fails, re-login so a fresh session token is issued.`
    : auth.transient
      ? 'GHL UNREACHABLE — transient error while validating. Retry.'
      : auth.pitTried
        ? `PIT REJECTED BY GHL (status ${auth.status || '?'}) — the stored Private Integration Tokens are invalid, expired, or lack the required scope. Re-enter valid PITs at /install?locationId=${locationId}.`
        : (installs.length === 0 && !oauthDirect && !hasPit)
          ? 'NO CREDENTIALS — no OAuth install and no stored PITs for this location. Set up the app (OAuth via /auth, or PITs via /install).'
          : 'NOT AUTHORIZED — this location is not under any installed agency.';

  res.json({
    buildMarker:             'mint-refresh-2026-08-24',  // confirms this build is live
    locationId,
    agencyOAuthInstalls:     installs.length,
    hasDirectOAuthInstall:   !!oauthDirect,
    hasPitRecord:            hasPit,
    canMintLocationToken:    canMint,
    agencyMintDetail,
    fullyAuthenticates:      !!auth.ok,
    authMethod:              auth.via || null,
    pitAttempted:            !!auth.pitTried,
    ghlValidationStatus:     auth.status || null,
    transient:               !!auth.transient,
    verdict,
  });
});

// GET /auth/env-check?locationId=xxx[&key=DIAG_KEY]
// Reports (from inside the deployment, where creds live) whether the required
// env vars are set and what Redis actually holds for a location. No secret
// values are returned — only booleans + the public redirect URI.
router.get('/env-check', async (req, res) => {
  // Optional lock: if DIAG_KEY is set, require it. Otherwise open (booleans only).
  if (process.env.DIAG_KEY && req.query.key !== process.env.DIAG_KEY) {
    return res.status(403).json({ error: 'forbidden — pass ?key=<DIAG_KEY>' });
  }

  const has = (v) => !!(process.env[v] && String(process.env[v]).trim());
  const envPresent = {
    GHL_CLIENT_ID:            has('GHL_CLIENT_ID'),
    GHL_CLIENT_SECRET:        has('GHL_CLIENT_SECRET'),
    GHL_REDIRECT_URI:         has('GHL_REDIRECT_URI'),
    GHL_VERSION_ID:           has('GHL_VERSION_ID'),
    UPSTASH_REDIS_REST_URL:   has('UPSTASH_REDIS_REST_URL'),
    UPSTASH_REDIS_REST_TOKEN: has('UPSTASH_REDIS_REST_TOKEN'),
    SESSION_SECRET:           has('SESSION_SECRET'),
    VERCEL:                   has('VERCEL'),
  };

  // Redis connectivity + what's stored for this location (existence only).
  let redisConnected = false;
  let oauthInstallCount = null;
  const forLocation = {};
  const locationId = (req.query.locationId || '').trim();
  try {
    const redis = require('../lib/redis');
    const installs = await oauthStore.findAll();      // exercises a real scan/read
    oauthInstallCount = installs.length;
    redisConnected = true;
    if (locationId) {
      const [oauthTok, pit, aicfg, locTok] = await Promise.all([
        redis.get(`ghl:tokens:${locationId}`).catch(() => null),
        redis.get(`ghl:keys:${locationId}`).catch(() => null),
        redis.get(`aiconfig:${locationId}`).catch(() => null),
        redis.get(`ghl:loctoken:${locationId}`).catch(() => null),
      ]);
      forLocation.hasOAuthToken     = !!(oauthTok && oauthTok.access_token);
      forLocation.hasRefreshToken   = !!(oauthTok && oauthTok.refresh_token);
      forLocation.hasPitRecord      = !!(pit && pit.subLocationApiKey && pit.agencyApiKey);
      forLocation.hasAiConfig       = !!aicfg;
      forLocation.hasCachedLocToken = !!locTok;
    }
  } catch (e) {
    forLocation.error = e.message;
  }

  res.json({
    envPresent,
    ghlRedirectUri: process.env.GHL_REDIRECT_URI || null, // public callback URL — compare to marketplace config
    redisConnected,
    oauthInstallCount,
    locationId: locationId || null,
    forLocation,
  });
});

// GET /auth/redis-dump[?key=DIAG_KEY]
// Full inventory of what's stored in Redis, grouped by namespace. Counts are
// always shown; the actual IDs are included only when a valid key is passed
// (DIAG_KEY, SESSION_SECRET, or GHL_CLIENT_SECRET). No secret values returned.
router.get('/redis-dump', async (req, res) => {
  const provided = req.query.key || req.headers['x-diag-key'] || '';
  const gate     = clean(process.env.DIAG_KEY) || clean(process.env.SESSION_SECRET) || clean(process.env.GHL_CLIENT_SECRET);
  const authed   = !!gate && provided === gate;

  const patterns = [
    'ghl:tokens:*',    // OAuth installs
    'ghl:keys:*',      // PIT records
    'ghl:loctoken:*',  // cached location tokens
    'aiconfig:*',      // AI provider config + ClickUp key
    'locinfo2:*',      // cached location info
    'hooks:*', 'hook_token:*',
    'cust:*', 'copyidx:*', 'copy:*',
    'wf:drafts:idx:*', 'wf:draft:*',
  ];

  const redis = require('../lib/redis');
  const namespaces = {};
  for (const pattern of patterns) {
    const prefix = pattern.replace('*', '');
    let cursor = 0;
    const keys = [];
    try {
      do {
        const [next, batch] = await redis.scan(cursor, { match: pattern, count: 200 });
        cursor = Number(next);
        keys.push(...(batch || []));
      } while (cursor !== 0 && keys.length < 1000);
      namespaces[prefix] = { count: keys.length };
      if (authed) namespaces[prefix].ids = keys.map(k => k.replace(prefix, '')).slice(0, 100);
    } catch (e) {
      namespaces[prefix] = { error: e.message };
    }
  }

  res.json({ authed, hint: authed ? 'IDs included' : 'pass ?key=<GHL_CLIENT_SECRET or SESSION_SECRET/DIAG_KEY> to see IDs', namespaces });
});

// GET /auth/last-install — inspect the most recent External Auth POST from GHL
// (field names + masked value shapes). Used to match /install to GHL's payload.
router.get('/last-install', async (req, res) => {
  try {
    const rec = await require('../lib/redis').get('ghl:lastinstall');
    res.json(rec || { note: 'No External Auth POST recorded yet. If install fails before this fills, GHL may not be reaching POST /install at all.' });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// GET /auth/session — report whether the caller holds a valid session
router.get('/session', (req, res) => {
  const claims = session.verify(readSessionToken(req));
  if (!claims?.lid) return res.status(401).json({ authenticated: false });
  res.json({
    authenticated: true,
    locationId: claims.lid,
    companyId:  claims.cid || '',
    userId:     claims.uid || null,
    email:      claims.email || null,
    name:       claims.name || null,
  });
});

// GET|POST /auth/logout — clear the session cookie (and optionally OAuth tokens)
router.get('/logout', async (req, res) => {
  const { locationId } = req.query;
  if (locationId) await oauthStore.del(locationId);
  res.setHeader('Set-Cookie', CLEAR_COOKIE);
  res.redirect('/');
});
router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', CLEAR_COOKIE);
  res.json({ ok: true });
});

module.exports = router;
