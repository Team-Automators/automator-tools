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
  try { require('../lib/redis').set('ghl:lastcallback', { at: Date.now(), ...rec }, { ex: 3600 }); }
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

    // Redirect directly to GHL integration page after OAuth
    const clientId  = clean(process.env.GHL_CLIENT_ID).split('-')[0];
    const versionId = clean(process.env.GHL_VERSION_ID);
    const dest      = loc || companyId;
    return res.redirect(
      `https://app.automator.ai/v2/location/${dest}/integration/${clientId}/versions/${versionId}?app_from=installedApps&view=agency`
    );
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error_description || err.message;
    await recordCallback({ stage: 'exchange_error', success: false, status: err.response?.status || 0, error: err.response?.data || err.message });
    console.error('[auth] OAuth callback error:', JSON.stringify(err.response?.data || err.message));
    res.status(500).send(`Authentication failed: ${msg}<br><pre>${JSON.stringify(err.response?.data, null, 2)}</pre>`);
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
    locationId,
    agencyOAuthInstalls:     installs.length,
    hasDirectOAuthInstall:   !!oauthDirect,
    hasPitRecord:            hasPit,
    canMintLocationToken:    canMint,
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

// GET /auth/session — report whether the caller holds a valid session
router.get('/session', (req, res) => {
  const claims = session.verify(readSessionToken(req));
  if (!claims?.lid) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, locationId: claims.lid, companyId: claims.cid || '' });
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
