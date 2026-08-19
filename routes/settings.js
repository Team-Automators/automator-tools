const express   = require('express');
const router    = express.Router();
const { PROVIDERS } = require('../lib/ai-providers');

const PROVIDERS_CLIENT = JSON.stringify(
  PROVIDERS.map(({ id, name, color, placeholder, defaultModel }) =>
    ({ id, name, color, placeholder, defaultModel })
  )
);

const providerOptions = PROVIDERS.map(p =>
  `<option value="${p.id}">${p.name}</option>`
).join('\n            ');

router.get('/', (req, res) => {
  const safeId = req.query.locationId || '';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Settings — GHL Automator</title>
  <style>
    :root {
      --sidebar-w:240px;--topnav-h:56px;
      --bg:#F8FAFC;--card:#FFFFFF;--border:#E2E8F0;--text:#0F172A;--sub:#64748B;
      --accent:#2563EB;--accent-bg:#EFF6FF;
      --sb-bg:#0F172A;--sb-text:#94A3B8;--sb-active:#F1F5F9;--sb-hover:#1E293B;--sb-border:#1E293B;
      --shadow:0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.04);
      --ok:#15803D;--ok-bg:#DCFCE7;--warn:#92400E;--warn-bg:#FEF3C7;--err:#991B1B;--err-bg:#FEE2E2;
    }
    @media(prefers-color-scheme:dark){:root{
      --bg:#0F172A;--card:#1E293B;--border:#334155;--text:#F1F5F9;--sub:#94A3B8;
      --accent-bg:#1E3A5F;--sb-bg:#020617;--sb-border:#1E293B;
      --shadow:0 1px 3px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.2);
      --ok-bg:#14532D;--warn-bg:#451A03;--err-bg:#450A0A;
    }}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex}

    /* Sidebar */
    .sidebar{width:var(--sidebar-w);min-height:100vh;background:var(--sb-bg);display:flex;flex-direction:column;flex-shrink:0;border-right:1px solid var(--sb-border);position:fixed;top:0;left:0;bottom:0;z-index:50}
    .sb-logo{display:flex;align-items:center;gap:10px;padding:20px 18px 16px;border-bottom:1px solid var(--sb-border)}
    .sb-logo-icon{width:32px;height:32px;background:#2563EB;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .sb-logo-name{font-size:.875rem;font-weight:700;color:var(--sb-active);letter-spacing:-.01em}
    .sb-nav{flex:1;padding:12px 10px;display:flex;flex-direction:column;gap:2px}
    .sb-section-label{font-size:.6875rem;font-weight:600;color:var(--sb-text);text-transform:uppercase;letter-spacing:.08em;padding:10px 8px 6px}
    .nav-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;font-size:.875rem;font-weight:500;color:var(--sb-text);text-decoration:none;transition:background .12s,color .12s}
    .nav-item:hover{background:var(--sb-hover);color:var(--sb-active)}
    .nav-item.active{background:rgba(37,99,235,.2);color:#60A5FA}
    .sb-user-wrap{position:relative;padding:10px;border-top:1px solid var(--sb-border)}
    .sb-user{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background .12s;user-select:none}
    .sb-user:hover{background:var(--sb-hover)}
    .sb-avatar{width:34px;height:34px;border-radius:8px;background:#1E3A5F;border:1px solid rgba(255,255,255,.1);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:#93C5FD}
    .sb-user-name{font-size:.8125rem;font-weight:600;color:var(--sb-active)}
    .user-menu{position:absolute;bottom:calc(100% - 6px);left:10px;right:10px;background:#1E293B;border:1px solid #334155;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.4);padding:6px;display:none;z-index:100}
    .user-menu.open{display:block}
    .user-menu-item{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:7px;font-size:.8125rem;font-weight:500;color:#CBD5E1;text-decoration:none;transition:background .1s,color .1s}
    .user-menu-item.danger:hover{background:#450A0A;color:#F87171}

    /* Main */
    .main{margin-left:var(--sidebar-w);flex:1;display:flex;flex-direction:column;min-height:100vh}
    .topnav{height:var(--topnav-h);background:var(--card);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 24px;position:sticky;top:0;z-index:40}
    .breadcrumb{font-size:.875rem;color:var(--sub)}
    .breadcrumb-current{font-weight:600;color:var(--text)}
    .content{flex:1;padding:28px 24px;max-width:680px}
    .page-title{font-size:1.125rem;font-weight:700;color:var(--text);letter-spacing:-.02em;margin-bottom:4px}
    .page-sub{font-size:.875rem;color:var(--sub);margin-bottom:28px}

    /* Expiry banner */
    .ai-banner{display:none;align-items:center;gap:10px;padding:10px 24px;font-size:.8125rem;border-bottom:1px solid}
    .ai-banner.warn{background:var(--warn-bg);border-color:#F59E0B;color:var(--warn)}
    .ai-banner.err{background:var(--err-bg);border-color:#EF4444;color:var(--err)}
    .ai-banner a{font-weight:600;color:inherit;text-decoration:underline;margin-left:auto}
    .ai-banner-close{background:none;border:none;cursor:pointer;font-size:1rem;color:inherit;margin-left:8px;opacity:.7}

    /* Cards */
    .settings-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;box-shadow:var(--shadow);margin-bottom:16px}
    .card-title{font-size:.9375rem;font-weight:700;color:var(--text);margin-bottom:4px}
    .card-sub{font-size:.8125rem;color:var(--sub);margin-bottom:20px}

    /* Connected state */
    .connected-row{display:flex;align-items:center;gap:12px;margin-bottom:16px}
    .provider-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .provider-label{font-size:.9375rem;font-weight:700;color:var(--text)}
    .connected-badge{display:inline-flex;align-items:center;gap:5px;padding:2px 10px 2px 6px;border-radius:999px;font-size:.75rem;font-weight:600;background:var(--ok-bg);color:var(--ok)}
    .connected-badge svg{width:12px;height:12px}
    .key-masked{font-family:'SF Mono','Fira Code',monospace;font-size:.8125rem;color:var(--sub);background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:6px 12px;display:inline-block;margin-bottom:14px}
    .expiry-bar-wrap{margin-bottom:6px}
    .expiry-bar-track{height:6px;background:var(--border);border-radius:999px;overflow:hidden}
    .expiry-bar-fill{height:100%;border-radius:999px;transition:width .3s}
    .expiry-label{font-size:.75rem;color:var(--sub);margin-top:5px}
    .expiry-label.warn{color:var(--warn);font-weight:600}
    .expiry-label.err{color:var(--err);font-weight:600}
    .connected-actions{display:flex;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)}

    /* Form */
    .form-group{margin-bottom:16px}
    label{display:block;font-size:.8125rem;font-weight:600;color:var(--sub);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em}
    label a{font-weight:500;text-transform:none;color:var(--accent);text-decoration:none;letter-spacing:0;margin-left:6px}
    label a:hover{text-decoration:underline}
    select,input[type=text],input[type=password]{width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:9px;font-size:.9rem;font-family:inherit;background:var(--bg);color:var(--text);outline:none;transition:border .15s,box-shadow .15s;-webkit-appearance:none}
    select:focus,input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,.12)}
    .key-input-wrap{position:relative}
    .key-input-wrap input{padding-right:72px}
    .toggle-vis{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:1px solid var(--border);border-radius:6px;padding:3px 10px;font-size:.75rem;font-weight:600;cursor:pointer;color:var(--sub);font-family:inherit;transition:background .1s}
    .toggle-vis:hover{background:var(--bg);color:var(--text)}
    .key-hint{font-size:.75rem;color:var(--sub);margin-top:5px;min-height:18px}
    .key-note{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;background:var(--accent-bg);border-radius:8px;font-size:.8rem;color:var(--sub);margin-bottom:16px}
    .form-msg{padding:10px 14px;border-radius:8px;font-size:.8125rem;font-weight:600;margin-bottom:12px;display:none}
    .form-msg.err{background:var(--err-bg);color:var(--err)}
    .form-msg.ok{background:var(--ok-bg);color:var(--ok)}

    /* Buttons */
    .btn{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:9px;font-size:.875rem;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:opacity .15s,background .1s}
    .btn:hover{opacity:.88}
    .btn:disabled{opacity:.45;cursor:not-allowed}
    .btn-primary{background:var(--accent);color:#fff}
    .btn-outline{background:var(--card);border:1px solid var(--border);color:var(--text)}
    .btn-outline:hover{background:var(--bg);opacity:1}
    .btn-danger{background:var(--err-bg);color:var(--err);border:1px solid #FECACA}
    .btn-danger:hover{background:#FEE2E2;opacity:1}

    @media(prefers-reduced-motion:reduce){*{transition-duration:.001ms!important}}
  </style>
</head>
<body>

<!-- Sidebar -->
<aside class="sidebar">
  <div class="sb-logo">
    <div class="sb-logo-icon">
      <svg viewBox="0 0 24 24" fill="#fff" width="18" height="18"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <span class="sb-logo-name">Automator</span>
  </div>
  <nav class="sb-nav">
    <div class="sb-section-label">Menu</div>
    <a class="nav-item" href="/dashboard?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      <span>Dashboard</span>
    </a>
    <a class="nav-item" href="/dashboard/copywriters?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      <span>Copywriters</span>
    </a>
    <a class="nav-item" href="/dashboard/library?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      <span>Library</span>
    </a>
    <a class="nav-item" href="#">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <span>Team</span>
    </a>
    <a class="nav-item active" href="/dashboard/settings?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      <span>Settings</span>
    </a>
  </nav>
  <div class="sb-user-wrap">
    <div class="sb-user" onclick="this.closest('.sb-user-wrap').querySelector('.user-menu').classList.toggle('open')">
      <div class="sb-avatar"><span>GL</span></div>
      <div style="flex:1;min-width:0"><div class="sb-user-name">My Location</div></div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
    </div>
    <div class="user-menu">
      <a class="user-menu-item danger" href="/auth/logout?locationId=${safeId}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Sign out
      </a>
    </div>
  </div>
</aside>

<!-- Main -->
<div class="main">

  <!-- Expiry banner -->
  <div class="ai-banner" id="ai-key-banner">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    <span id="ai-banner-msg"></span>
    <a href="/dashboard/settings?locationId=${safeId}">Update in Settings →</a>
    <button class="ai-banner-close" onclick="document.getElementById('ai-key-banner').style.display='none'">✕</button>
  </div>

  <header class="topnav">
    <span class="breadcrumb">
      <span>Automator</span>
      <span style="color:var(--border)"> / </span>
      <span class="breadcrumb-current">Settings</span>
    </span>
  </header>

  <main class="content">
    <div class="page-title">Settings</div>
    <p class="page-sub">Manage your AI provider and API keys for Copywriters.</p>

    <!-- Connected status card (shown by JS when a key exists) -->
    <div class="settings-card" id="connected-card" style="display:none">
      <div class="card-title">Connected Provider</div>
      <p class="card-sub">Your current AI configuration</p>

      <div class="connected-row">
        <div class="provider-dot" id="conn-dot"></div>
        <span class="provider-label" id="conn-name"></span>
        <span class="connected-badge" id="conn-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Connected
        </span>
      </div>

      <div class="key-masked" id="conn-key"></div>

      <div class="expiry-bar-wrap">
        <div class="expiry-bar-track">
          <div class="expiry-bar-fill" id="conn-bar" style="width:100%"></div>
        </div>
        <div class="expiry-label" id="conn-expiry-label"></div>
      </div>

      <div class="connected-actions">
        <button class="btn btn-outline" onclick="showUpdateForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>
          Update Key
        </button>
        <button class="btn btn-danger" onclick="disconnect()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Disconnect
        </button>
      </div>
    </div>

    <!-- Connect / Update form -->
    <div class="settings-card" id="connect-card">
      <div class="card-title" id="form-title">Connect AI Provider</div>
      <p class="card-sub" id="form-sub">Choose a provider and paste your API key. Stored locally — never sent to our servers.</p>

      <div class="form-msg" id="form-msg"></div>

      <div class="form-group">
        <label>Provider</label>
        <select id="provider-select" onchange="onProviderChange()">
          <option value="">— Select provider —</option>
          ${providerOptions}
        </select>
      </div>

      <div class="form-group">
        <label>
          API Key
          <a id="get-key-link" href="#" target="_blank" style="display:none">Get key →</a>
        </label>
        <div class="key-input-wrap">
          <input type="password" id="api-key-input" placeholder="Paste your API key here" autocomplete="off"/>
          <button type="button" class="toggle-vis" id="toggle-vis" onclick="toggleVis()">Show</button>
        </div>
        <div class="key-hint" id="key-hint"></div>
      </div>

      <div class="key-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" style="flex-shrink:0;margin-top:1px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Stored in your browser's localStorage for 15 days. Not transmitted to or stored on our servers.
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" id="connect-btn" onclick="connect()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Connect Provider
        </button>
        <button class="btn btn-outline" id="cancel-update-btn" onclick="cancelUpdate()" style="display:none">Cancel</button>
      </div>
    </div>

  </main>
</div>

<script>
const LOCATION_ID = '${safeId}';
const STORAGE_KEY = 'ghl_ai_config';
const EXPIRY_MS   = 15 * 24 * 60 * 60 * 1000;
const WARN_DAYS   = 3;

const PROVIDERS = ${PROVIDERS_CLIENT};

const DOCS_LINKS = {
  claude:     'https://console.anthropic.com/account/keys',
  openai:     'https://platform.openai.com/api-keys',
  groq:       'https://console.groq.com/keys',
  gemini:     'https://aistudio.google.com/app/apikey',
  mistral:    'https://console.mistral.ai/api-keys/',
  perplexity: 'https://www.perplexity.ai/settings/api',
  together:   'https://api.together.ai/settings/api-keys',
  deepseek:   'https://platform.deepseek.com/api_keys',
  xai:        'https://console.x.ai/',
  cohere:     'https://dashboard.cohere.com/api-keys',
};

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveConfig(provider, apiKey) {
  const now = Date.now();
  const cfg = { provider, apiKey, connectedAt: now, expiresAt: now + EXPIRY_MS };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  return cfg;
}

function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

function maskKey(k) {
  if (!k) return '';
  if (k.length <= 8) return '•'.repeat(k.length);
  return k.slice(0, 6) + '•'.repeat(Math.min(k.length - 10, 20)) + k.slice(-4);
}

function daysLeft(cfg) {
  return Math.ceil((cfg.expiresAt - Date.now()) / 86400000);
}

// ── Render connected status ───────────────────────────────────────────────────

function renderStatus() {
  const cfg    = loadConfig();
  const cc     = document.getElementById('connected-card');
  const fc     = document.getElementById('connect-card');
  const ft     = document.getElementById('form-title');
  const fs     = document.getElementById('form-sub');
  const cancel = document.getElementById('cancel-update-btn');

  if (!cfg) {
    cc.style.display = 'none';
    fc.style.display = 'block';
    ft.textContent = 'Connect AI Provider';
    fs.textContent = 'Choose a provider and paste your API key. Stored locally — never sent to our servers.';
    cancel.style.display = 'none';
    return;
  }

  const p    = PROVIDERS.find(x => x.id === cfg.provider) || { name: cfg.provider, color: '#64748B' };
  const days = daysLeft(cfg);
  const pct  = Math.max(0, Math.min(100, (days / 15) * 100));

  document.getElementById('conn-dot').style.background  = p.color;
  document.getElementById('conn-name').textContent       = p.name;
  document.getElementById('conn-key').textContent        = maskKey(cfg.apiKey);

  const bar = document.getElementById('conn-bar');
  bar.style.width      = pct + '%';
  bar.style.background = days <= 0 ? '#EF4444' : days <= WARN_DAYS ? '#F59E0B' : '#22C55E';

  const lbl = document.getElementById('conn-expiry-label');
  const expDate = new Date(cfg.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  if (days <= 0) {
    lbl.textContent = 'Expired — update your key below';
    lbl.className = 'expiry-label err';
  } else if (days <= WARN_DAYS) {
    lbl.textContent = days + ' day' + (days !== 1 ? 's' : '') + ' remaining · Expires ' + expDate;
    lbl.className = 'expiry-label warn';
  } else {
    lbl.textContent = days + ' days remaining · Expires ' + expDate;
    lbl.className = 'expiry-label';
  }

  const badge = document.getElementById('conn-badge');
  if (days <= 0) {
    badge.style.background = '#FEE2E2'; badge.style.color = '#991B1B';
    badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Expired';
  } else if (days <= WARN_DAYS) {
    badge.style.background = '#FEF3C7'; badge.style.color = '#92400E';
    badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Expiring soon';
  } else {
    badge.style.background = '#DCFCE7'; badge.style.color = '#15803D';
    badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg> Connected';
  }

  cc.style.display = 'block';

  // Show update form inline when expired or near-expiry
  if (days <= WARN_DAYS) {
    fc.style.display = 'block';
    ft.textContent = days <= 0 ? 'Replace Expired Key' : 'Update Key';
    fs.textContent = 'Enter a new API key to replace the current one.';
    cancel.style.display = 'none';
  } else {
    fc.style.display = 'none';
    cancel.style.display = 'none';
  }

  // Prefill provider in dropdown
  document.getElementById('provider-select').value = cfg.provider || '';
  onProviderChange();
}

// ── Expiry banner ─────────────────────────────────────────────────────────────

function checkBanner() {
  const cfg = loadConfig();
  const banner = document.getElementById('ai-key-banner');
  const msg    = document.getElementById('ai-banner-msg');
  if (!cfg) return;
  const days = daysLeft(cfg);
  const pName = (PROVIDERS.find(x => x.id === cfg.provider) || { name: cfg.provider }).name;
  if (days <= 0) {
    banner.className = 'ai-banner err';
    msg.textContent  = pName + ' API key has expired — copy generation is paused.';
    banner.style.display = 'flex';
  } else if (days <= WARN_DAYS) {
    banner.className = 'ai-banner warn';
    msg.textContent  = pName + ' API key expires in ' + days + ' day' + (days !== 1 ? 's' : '') + '. Update it before it stops working.';
    banner.style.display = 'flex';
  }
}

// ── Form interactions ─────────────────────────────────────────────────────────

function onProviderChange() {
  const sel  = document.getElementById('provider-select').value;
  const p    = PROVIDERS.find(x => x.id === sel);
  const hint = document.getElementById('key-hint');
  const link = document.getElementById('get-key-link');
  const inp  = document.getElementById('api-key-input');

  if (p) {
    inp.placeholder = p.placeholder || 'Paste your API key here';
    hint.textContent = 'Default model: ' + p.defaultModel;
    if (DOCS_LINKS[sel]) {
      link.href = DOCS_LINKS[sel];
      link.style.display = 'inline';
    } else {
      link.style.display = 'none';
    }
  } else {
    inp.placeholder = 'Paste your API key here';
    hint.textContent = '';
    link.style.display = 'none';
  }
}

function toggleVis() {
  const inp = document.getElementById('api-key-input');
  const btn = document.getElementById('toggle-vis');
  const isPassword = inp.type === 'password';
  inp.type = isPassword ? 'text' : 'password';
  btn.textContent = isPassword ? 'Hide' : 'Show';
}

function showMsg(text, type) {
  const el = document.getElementById('form-msg');
  el.textContent = text;
  el.className = 'form-msg ' + type;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function connect() {
  const provider = document.getElementById('provider-select').value;
  const apiKey   = document.getElementById('api-key-input').value.trim();

  if (!provider)    { showMsg('Please select a provider.', 'err'); return; }
  if (!apiKey)      { showMsg('Please enter your API key.', 'err'); return; }
  if (apiKey.length < 8) { showMsg('API key looks too short — double-check it.', 'err'); return; }

  saveConfig(provider, apiKey);
  document.getElementById('api-key-input').value = '';
  showMsg('Connected! Your key is stored for 15 days.', 'ok');
  renderStatus();
}

function disconnect() {
  if (!confirm('Remove the stored API key? You will need to reconnect to use Copywriters.')) return;
  clearConfig();
  renderStatus();
}

function showUpdateForm() {
  const fc  = document.getElementById('connect-card');
  const ft  = document.getElementById('form-title');
  const fs  = document.getElementById('form-sub');
  const btn = document.getElementById('cancel-update-btn');
  fc.style.display = 'block';
  ft.textContent = 'Update Key';
  fs.textContent = 'Enter a new API key to replace the current one.';
  btn.style.display = 'inline-flex';
  fc.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelUpdate() {
  const fc  = document.getElementById('connect-card');
  const btn = document.getElementById('cancel-update-btn');
  fc.style.display = 'none';
  btn.style.display = 'none';
}

// ── Init ──────────────────────────────────────────────────────────────────────

renderStatus();
checkBanner();

document.addEventListener('click', e => {
  if (!e.target.closest('.sb-user-wrap'))
    document.querySelectorAll('.user-menu.open').forEach(m => m.classList.remove('open'));
});
</script>
</body>
</html>`);
});

module.exports = router;
