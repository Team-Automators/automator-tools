// POST /install — register both PITs for a sub-location.
//
// Required:
//   locationId       — the sub-location ID on Account 1
//   subLocationApiKey — PIT from Account 1 sub-location (contacts.readonly + contacts.write)
//   agencyApiKey      — PIT from Account 2 agency (locations.write + users.write)
//
// Both keys are verified against GHL before being stored.
//
// Check registration:  GET  /install/:locationId
// Remove registration: DELETE /install/:locationId

const express   = require('express');
const axios     = require('axios');
const router    = express.Router();
const keyStore  = require('../lib/key-store');

const GHL_BASE    = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

const headers = (key) => ({ Authorization: `Bearer ${key}`, Version: API_VERSION });

const APP_URL = process.env.APP_URL || 'https://automator-subuser.vercel.app';

// Create "Team" custom menu for the location if it doesn't already exist
async function upsertTeamMenu(apiKey, locationId) {
  const h = { ...headers(apiKey), 'Content-Type': 'application/json' };

  // Check if Team menu already exists for this location
  try {
    const { data } = await axios.get(`${GHL_BASE}/custom-menus/`, {
      headers: h,
      params: { locationId },
    });
    const menus = data.customMenus || data.menus || (Array.isArray(data) ? data : []);
    const existing = menus.find(m => m.name === 'Team');
    if (existing) {
      console.log('[install] Team menu already exists for locationId:', locationId);
      return existing;
    }
  } catch (err) {
    console.warn('[install] Could not list existing menus:', err.response?.data || err.message);
  }

  // Create Team menu
  const { data } = await axios.post(`${GHL_BASE}/custom-menus/`, {
    name:           'Team',
    url:            `${APP_URL}/dashboard?locationId=${locationId}`,
    icon:           'users',
    locationIds:    [locationId],
    openMode:       'iframe',
    showOnCompany:  false,
    showOnLocation: true,
  }, { headers: h });

  console.log('[install] Team menu created — id:', data.id || data._id);
  return data;
}

// Verify sub-location PIT — must have contacts.readonly
async function verifySubLocationKey(apiKey, locationId) {
  const { data } = await axios.get(`${GHL_BASE}/contacts/`, {
    headers: headers(apiKey),
    params: { locationId, limit: 1 },
  });
  return data;
}

// Verify agency PIT — /users/me returns 404 for agency PITs (no user tied to it)
// A 404 here means the token is valid and agency-level
async function verifyAgencyKey(apiKey) {
  try {
    const { data } = await axios.get(`${GHL_BASE}/users/me`, { headers: headers(apiKey) });
    return { type: 'sub-location', ...data };
  } catch (err) {
    if (err.response?.status === 404) return { type: 'agency' };
    throw err;
  }
}

// GET /install — web setup wizard (browser) or JSON status (API/GHL server call)
router.get('/', async (req, res) => {
  const { locationId } = req.query;

  // If called by GHL server (not a browser), return JSON
  console.log('=== [install GET] FULL PAYLOAD ===');
  console.log('[install GET] URL:', req.url);
  console.log('[install GET] HEADERS:', JSON.stringify(req.headers, null, 2));
  console.log('[install GET] QUERY:', JSON.stringify(req.query, null, 2));
  console.log('=== [install GET] END PAYLOAD ===');

  const accept = req.headers['accept'] || '';
  const isAPI  = !accept.includes('text/html') || req.headers['user-agent']?.includes('axios');
  if (isAPI) {
    const safeId = Array.isArray(locationId) ? locationId[0] : (!locationId || locationId === 'undefined') ? null : locationId;
    const rec    = safeId ? await keyStore.get(safeId) : null;
    return res.json({
      success:   true,
      locationId: safeId,
      setupUrl:  `https://automator-subuser.vercel.app/install${safeId ? `?locationId=${safeId}` : ''}`,
      hasPITs:   !!(rec?.subLocationApiKey && rec?.agencyApiKey),
      message:   'Open setupUrl in a browser to enter PITs.',
    });
  }

  // Normalize undefined/empty locationId — company-level installs won't have one
  const safeLocationId = (!locationId || locationId === 'undefined') ? '' : locationId;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>GHL Automator — Setup</title>
  <style>
    :root{--bg:#F1F5F9;--card:#FFFFFF;--text:#0F172A;--sub:#64748B;--section-bg:#F8FAFC;--section-border:#E2E8F0;--label:#374151;--hint:#9CA3AF;--input-bg:#FFFFFF;--input-border:#E2E8F0;--input-focus:#2563EB;--input-ring:rgba(37,99,235,.12);--accent:#2563EB;--accent-label:#1E40AF;--btn:#2563EB;--btn-hover:#1D4ED8;--btn-disabled:#93C5FD;--msg-ok-bg:#DCFCE7;--msg-ok:#15803D;--msg-err-bg:#FEE2E2;--msg-err:#DC2626;--ep-bg:#F8FAFC;--ep-border:#E2E8F0;--ep-name:#374151;--badge-ok-bg:#DCFCE7;--badge-ok:#15803D;--badge-err-bg:#FEE2E2;--badge-err:#DC2626;--shadow:0 4px 6px -1px rgba(0,0,0,.07),0 10px 40px -4px rgba(0,0,0,.06)}
    @media(prefers-color-scheme:dark){:root{--bg:#0F172A;--card:#1E293B;--text:#F1F5F9;--sub:#94A3B8;--section-bg:#0F172A;--section-border:#334155;--label:#CBD5E1;--hint:#64748B;--input-bg:#0F172A;--input-border:#334155;--input-focus:#3B82F6;--input-ring:rgba(59,130,246,.15);--accent:#60A5FA;--accent-label:#93C5FD;--btn:#2563EB;--btn-hover:#3B82F6;--btn-disabled:#1E3A5F;--msg-ok-bg:#052E16;--msg-ok:#4ADE80;--msg-err-bg:#450A0A;--msg-err:#F87171;--ep-bg:#0F172A;--ep-border:#334155;--ep-name:#CBD5E1;--badge-ok-bg:#052E16;--badge-ok:#4ADE80;--badge-err-bg:#450A0A;--badge-err:#F87171;--shadow:0 4px 6px -1px rgba(0,0,0,.4),0 10px 40px -4px rgba(0,0,0,.3)}}
    :root[data-theme="light"]{--bg:#F1F5F9;--card:#FFFFFF;--text:#0F172A;--sub:#64748B;--section-bg:#F8FAFC;--section-border:#E2E8F0;--label:#374151;--hint:#9CA3AF;--input-bg:#FFFFFF;--input-border:#E2E8F0;--input-focus:#2563EB;--input-ring:rgba(37,99,235,.12);--accent:#2563EB;--accent-label:#1E40AF;--btn:#2563EB;--btn-hover:#1D4ED8;--btn-disabled:#93C5FD;--msg-ok-bg:#DCFCE7;--msg-ok:#15803D;--msg-err-bg:#FEE2E2;--msg-err:#DC2626;--ep-bg:#F8FAFC;--ep-border:#E2E8F0;--ep-name:#374151;--badge-ok-bg:#DCFCE7;--badge-ok:#15803D;--badge-err-bg:#FEE2E2;--badge-err:#DC2626}
    :root[data-theme="dark"]{--bg:#0F172A;--card:#1E293B;--text:#F1F5F9;--sub:#94A3B8;--section-bg:#0F172A;--section-border:#334155;--label:#CBD5E1;--hint:#64748B;--input-bg:#0F172A;--input-border:#334155;--input-focus:#3B82F6;--input-ring:rgba(59,130,246,.15);--accent:#60A5FA;--accent-label:#93C5FD;--btn:#2563EB;--btn-hover:#3B82F6;--btn-disabled:#1E3A5F;--msg-ok-bg:#052E16;--msg-ok:#4ADE80;--msg-err-bg:#450A0A;--msg-err:#F87171;--ep-bg:#0F172A;--ep-border:#334155;--ep-name:#CBD5E1;--badge-ok-bg:#052E16;--badge-ok:#4ADE80;--badge-err-bg:#450A0A;--badge-err:#F87171}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;transition:background .3s}
    .card{background:var(--card);border-radius:20px;box-shadow:var(--shadow);padding:40px;max-width:520px;width:100%;animation:rise .4s cubic-bezier(.22,.61,.36,1) both}
    @keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    .head{margin-bottom:28px}
    h1{font-size:1.25rem;font-weight:700;color:var(--text);letter-spacing:-.02em;margin-bottom:6px}
    .sub{font-size:.875rem;color:var(--sub);line-height:1.55}
    .section{background:var(--section-bg);border-radius:12px;padding:18px;margin-bottom:14px;border:1px solid var(--section-border)}
    .section-title{font-size:.6875rem;font-weight:700;color:var(--accent-label);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px}
    .field{margin-bottom:12px}
    .field:last-child{margin-bottom:0}
    label{display:block;font-size:.8125rem;font-weight:600;color:var(--label);margin-bottom:4px}
    .hint{font-size:.75rem;color:var(--hint);margin-bottom:6px;line-height:1.4}
    input{width:100%;padding:9px 12px;border:1px solid var(--input-border);border-radius:8px;font-size:.875rem;font-family:'SF Mono','Fira Code',monospace;outline:none;transition:border .15s,box-shadow .15s;background:var(--input-bg);color:var(--text)}
    input:focus{border-color:var(--input-focus);box-shadow:0 0 0 3px var(--input-ring)}
    .btn{width:100%;padding:11px;background:var(--btn);color:#fff;border:none;border-radius:10px;font-size:.9375rem;font-weight:600;cursor:pointer;margin-top:6px;transition:background .15s,transform .1s;font-family:inherit}
    .btn:hover{background:var(--btn-hover)}
    .btn:active{transform:scale(.99)}
    .btn:disabled{background:var(--btn-disabled);cursor:not-allowed;transform:none}
    #msg{margin-top:14px;padding:11px 15px;border-radius:9px;font-size:.875rem;display:none;font-weight:500}
    #msg.ok{background:var(--msg-ok-bg);color:var(--msg-ok)}
    #msg.err{background:var(--msg-err-bg);color:var(--msg-err)}
    #endpoints{margin-top:18px;display:none}
    .ep-title{font-size:.6875rem;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px}
    .ep{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-radius:9px;background:var(--ep-bg);border:1px solid var(--ep-border);margin-bottom:8px}
    .ep:last-child{margin-bottom:0}
    .ep-name{font-size:.8rem;font-weight:600;color:var(--ep-name);font-family:'SF Mono','Fira Code',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ep-badge{font-size:.6875rem;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap;flex-shrink:0}
    .ep-badge.ok{background:var(--badge-ok-bg);color:var(--badge-ok)}
    .ep-badge.err{background:var(--badge-err-bg);color:var(--badge-err)}
    .ep-badge.pending{background:var(--section-bg);color:var(--hint)}
    @media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important}}
  </style>
</head>
<body>
<div class="card">
  <div class="head">
    <h1>GHL Automator Setup</h1>
    <p class="sub">Enter your credentials to activate the three workflow actions.</p>
  </div>

  <div class="section">
    <div class="section-title">Account 1 — Origin</div>
    <div class="field">
      <label>Location</label>
      <p class="hint">Found in GHL → Settings → Business Info</p>
      <input id="locationId" placeholder="e.g. KogOOG0gkaYzCE9gAaWr" value="${safeLocationId}"/>
    </div>
    <div class="field">
      <label>Origin PIT</label>
      <p class="hint">Requires: contacts.readonly, contacts.write</p>
      <input id="subPit" type="password" placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off"/>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Account 2 — HIPPA</div>
    <div class="field">
      <label>HIPPA PIT</label>
      <p class="hint">Requires: locations.write, users.write, users.readonly</p>
      <input id="agencyPit" type="password" placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off"/>
    </div>
  </div>

  <button class="btn" id="btn" onclick="save()">Save &amp; Activate</button>
  <div id="msg"></div>

  <div id="endpoints">
    <p class="ep-title" style="margin-top:18px">Endpoint Status</p>
    <div class="ep">
      <span class="ep-name">POST /action/create-location</span>
      <span class="ep-badge pending" id="badge-create-location">—</span>
    </div>
    <div class="ep">
      <span class="ep-name">POST /action/create-user</span>
      <span class="ep-badge pending" id="badge-create-user">—</span>
    </div>
    <div class="ep">
      <span class="ep-name">POST /action/update-contact</span>
      <span class="ep-badge pending" id="badge-update-contact">—</span>
    </div>
  </div>
</div>

<script>
async function save() {
  const locationId = document.getElementById('locationId').value.trim();
  const subPit     = document.getElementById('subPit').value.trim();
  const agencyPit  = document.getElementById('agencyPit').value.trim();
  const btn        = document.getElementById('btn');

  if (!locationId) { show('err', 'Location ID is missing. Open this page from GHL using: /install?locationId=YOUR_LOCATION_ID'); return; }
  if (!subPit || !agencyPit) { show('err', 'Both Origin PIT and HIPPA PIT are required.'); return; }

  btn.disabled = true;
  btn.textContent = 'Verifying…';
  hide();

  try {
    const r    = await fetch('/install', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId, subLocationApiKey: subPit, agencyApiKey: agencyPit }) });
    const data = await r.json();

    if (data.success) {
      show('ok', 'Setup complete — PITs saved. Redirecting back to GHL...');
      if (data.endpoints) {
        document.getElementById('endpoints').style.display = 'block';
        for (const [name, info] of Object.entries(data.endpoints)) {
          const badge = document.getElementById('badge-' + name);
          if (!badge) continue;
          badge.textContent = info.ready ? 'AUTHENTICATED' : 'FAILED';
          badge.className   = 'ep-badge ' + (info.ready ? 'ok' : 'err');
          badge.closest('.ep').title = info.note || '';
        }
      }
      // Redirect back to GHL integration page after 2 seconds
      setTimeout(() => {
        window.location.href = 'https://app.automator.ai/v2/location/' + locationId + '/integration/6a4ec7159117a4acffc4a62c/versions/6a553cb5d89e88f38ac42429?app_from=installedApps&view=agency';
      }, 2000);
    } else {
      show('err', data.error || 'Setup failed.');
    }
  } catch (e) {
    show('err', 'Request failed: ' + e.message);
  }

  btn.disabled = false;
  btn.textContent = 'Save & Activate';
}

function show(type, text) {
  const el = document.getElementById('msg');
  el.className = type; el.textContent = text; el.style.display = 'block';
}
function hide() { const el = document.getElementById('msg'); el.style.display = 'none'; }
</script>
</body>
</html>`);
});

// POST /install/debug — see exactly what GHL sends
router.post('/debug', (req, res) => {
  console.log('[install/debug]', JSON.stringify({ headers: req.headers, body: req.body }));
  res.json({ method: req.method, headers: req.headers, body: req.body });
});

// POST /install — called by GHL External Auth when user connects the integration.
// Stores locationId + PITs in Redis so action endpoints can look them up.
router.post('/', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const merged = { ...req.query, ...req.body };

  console.log('=== [install POST] FULL PAYLOAD ===');
  console.log('[install POST] HEADERS:', JSON.stringify(req.headers, null, 2));
  console.log('[install POST] BODY:', JSON.stringify(req.body, null, 2));
  console.log('[install POST] QUERY:', JSON.stringify(req.query, null, 2));
  console.log('=== [install POST] END PAYLOAD ===');

  const toStr      = (v) => Array.isArray(v) ? v[0] : (typeof v === 'string' ? v : null);
  const locationId        = toStr(merged.locationId || merged.location_id);
  const companyId         = toStr(merged.companyId);
  const subLocationApiKey = toStr(merged.subLocationApiKey);
  const agencyApiKey      = toStr(merged.agencyApiKey);

  console.log('[install POST] locationId:', locationId, '| companyId:', companyId, '| subLocationApiKey:', !!subLocationApiKey, '| agencyApiKey:', !!agencyApiKey);

  if (!locationId || !subLocationApiKey || !agencyApiKey) {
    const missing = [];
    if (!locationId)        missing.push('locationId');
    if (!subLocationApiKey) missing.push('subLocationApiKey');
    if (!agencyApiKey)      missing.push('agencyApiKey');
    console.error('[install POST] Missing required fields:', missing.join(', '));
    return res.json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
  }

  try {
    await keyStore.set(locationId, subLocationApiKey, agencyApiKey, companyId);
    console.log('[install POST] PITs stored in Redis for locationId:', locationId);
  } catch (err) {
    console.error('[install POST] Failed to store PITs in Redis:', err.message);
    return res.json({ success: false, error: 'Failed to store PITs. Please try again.' });
  }

  // Create Team custom menu if it doesn't exist
  try {
    await upsertTeamMenu(agencyApiKey, locationId);
  } catch (err) {
    console.error('[install POST] Failed to create Team menu:', err.response?.data || err.message);
    // Non-fatal — PITs already stored, just log the error
  }

  return res.json({
    success:  true,
    received: { locationId, companyId },
    result:   { message: 'PITs stored and Team menu activated for this location.' },
  });
});


module.exports = router;
