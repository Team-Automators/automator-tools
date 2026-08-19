const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const BASE        = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

// GET /test — browser form
router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Test GHL Connection</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
    .card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:2.5rem;width:100%;max-width:520px}
    h1{font-size:1.25rem;font-weight:700;margin-bottom:.35rem}
    p{font-size:.875rem;color:#64748b;margin-bottom:1.75rem}
    label{display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:.4rem}
    input{width:100%;padding:.6rem .85rem;border:1px solid #e2e8f0;border-radius:8px;font-size:.9rem;font-family:monospace;outline:none;transition:border .15s}
    input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
    button{margin-top:1rem;width:100%;padding:.7rem;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:.95rem;font-weight:600;cursor:pointer;transition:background .15s}
    button:hover{background:#1d4ed8}
    button:disabled{background:#93c5fd;cursor:not-allowed}
    #result{margin-top:1.5rem;display:none}
    .tag{display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .75rem;border-radius:999px;font-size:.8rem;font-weight:600;margin-bottom:1rem}
    .tag.ok{background:#dcfce7;color:#16a34a}
    .tag.fail{background:#fee2e2;color:#dc2626}
    table{width:100%;border-collapse:collapse;font-size:.85rem}
    td{padding:.45rem .5rem;border-bottom:1px solid #f1f5f9;vertical-align:top}
    td:first-child{font-weight:600;color:#64748b;width:130px;white-space:nowrap}
    td:last-child{font-family:monospace;color:#111;word-break:break-all}
    .err-box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:1rem;font-size:.85rem;color:#dc2626}
  </style>
</head>
<body>
<div class="card">
  <h1>Test GHL Connection</h1>
  <p>Enter your Private Integration Token (PIT) to verify it works.</p>

  <label for="pit">Private Integration Token</label>
  <input type="password" id="pit" placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off"/>
  <button id="btn" onclick="testKey()">Test Connection</button>

  <div id="result"></div>
</div>

<script>
async function testKey() {
  const key = document.getElementById('pit').value.trim();
  const btn = document.getElementById('btn');
  const out = document.getElementById('result');

  if (!key) { alert('Please enter your PIT first.'); return; }

  btn.disabled = true;
  btn.textContent = 'Testing…';
  out.style.display = 'none';

  try {
    const res = await fetch('/verify', {
      headers: { Authorization: 'Bearer ' + key }
    });
    const data = await res.json();

    if (data.connected) {
      out.innerHTML = \`
        <div class="tag ok">&#10003; Connected</div>
        <table>
          <tr><td>User ID</td><td>\${data.userId || '—'}</td></tr>
          <tr><td>Name</td><td>\${data.name || '—'}</td></tr>
          <tr><td>Email</td><td>\${data.email || '—'}</td></tr>
          <tr><td>Type</td><td>\${data.type || '—'}</td></tr>
          <tr><td>Role</td><td>\${data.role || '—'}</td></tr>
          <tr><td>Company ID</td><td>\${data.companyId || '—'}</td></tr>
          <tr><td>Locations</td><td>\${(data.locationIds||[]).join(', ') || '—'}</td></tr>
        </table>\`;
    } else {
      out.innerHTML = \`
        <div class="tag fail">&#10007; Failed</div>
        <div class="err-box">\${data.error || 'Unknown error'}</div>\`;
    }
  } catch(e) {
    out.innerHTML = \`<div class="err-box">Request failed: \${e.message}</div>\`;
  }

  out.style.display = 'block';
  btn.disabled = false;
  btn.textContent = 'Test Connection';
}

document.getElementById('pit').addEventListener('keydown', e => {
  if (e.key === 'Enter') testKey();
});
</script>
</body>
</html>`);
});

// POST /test — { "pit": "pit-xxx" } → runs verify and returns result
router.post('/', async (req, res) => {
  const pit = req.body?.pit || req.body?.apiKey;
  if (!pit) return res.status(400).json({ error: 'Missing pit in request body' });

  try {
    const client = axios.create({ baseURL: BASE });
    // Try agency PIT first
    let response;
    try {
      response = await client.get('/users/me', {
        headers: { Authorization: `Bearer ${pit}`, Version: API_VERSION },
      });
      const u = response.data.users?.[0] || response.data;
      return res.json({
        connected: true,
        type: 'agency',
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        companyId: u.companyId,
        locationIds: u.locationIds || [],
      });
    } catch (e) {
      if (e.response?.status === 404) {
        // Agency PIT — no user tied to it
        return res.json({ connected: true, type: 'agency', note: 'Agency PIT — no user attached' });
      }
      if (e.response?.status !== 401) throw e;
    }

    // Fallback: sub-location PIT — call contacts
    response = await client.get('/contacts/', {
      headers: { Authorization: `Bearer ${pit}`, Version: API_VERSION },
      params: { limit: 1 },
    });
    return res.json({ connected: true, type: 'sub-location' });
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || err.message;
    res.status(status).json({ connected: false, error: message });
  }
});

module.exports = router;
