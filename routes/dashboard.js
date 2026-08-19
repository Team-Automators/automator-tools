const express   = require('express');
const axios     = require('axios');
const router    = express.Router();
const keyStore  = require('../lib/key-store');
const copyStore = require('../lib/copy-store');
const { TYPES } = require('../lib/copywriter-types');

const GHL_BASE    = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';
const APP_URL     = process.env.APP_URL || 'https://automator-subuser.vercel.app';

router.get('/', async (req, res) => {
  const { locationId } = req.query;
  const safeId = locationId || '';

  let locationName  = '';
  let locationLogo  = '';
  let locationEmail = '';
  let hasPITs       = false;

  let recentCopies = [];

  if (locationId) {
    const [record, copyIdx] = await Promise.all([
      keyStore.get(locationId).catch(() => null),
      copyStore.getCopyIndex(locationId).catch(() => []),
    ]);
    hasPITs     = !!(record?.subLocationApiKey && record?.agencyApiKey);
    recentCopies = copyIdx.slice(0, 8);

    if (record?.subLocationApiKey) {
      try {
        const { data } = await axios.get(`${GHL_BASE}/locations/${locationId}`, {
          headers: { Authorization: `Bearer ${record.subLocationApiKey}`, Version: API_VERSION },
        });
        const loc     = data.location || data;
        locationName  = loc.name     || '';
        locationLogo  = loc.logoUrl  || loc.logo || '';
        locationEmail = loc.email    || '';
      } catch (_) {}
    }
  }

  function relTime(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'Just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 30) return d + 'd ago';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  const recentHtml = recentCopies.length === 0
    ? `<div style="text-align:center;padding:36px 24px;color:var(--sub);font-size:.875rem">
        No copy generated yet. <a href="/dashboard/copywriters?locationId=${safeId}" style="color:var(--accent);font-weight:600">Open Copywriters →</a>
       </div>`
    : recentCopies.map(copy => {
        const t    = TYPES[copy.type] || TYPES.general;
        const link = (copy.customerId && copy.customerId !== '_unsorted')
          ? `/dashboard/library/${copy.customerId}/${copy.id}?locationId=${safeId}`
          : `/dashboard/library/_unsorted/${copy.id}?locationId=${safeId}`;
        const preview = (copy.preview || '').slice(0, 80);
        return `<a class="recent-item" href="${link}">
          <span class="recent-badge" style="background:${t.colorBg};color:${t.color}">${escHtml(t.title.split(' ')[0])}</span>
          <div class="recent-info">
            <div class="recent-title">${escHtml(copy.title || 'Untitled')}</div>
            ${preview ? `<div class="recent-preview">${escHtml(preview)}${copy.preview && copy.preview.length > 80 ? '…' : ''}</div>` : ''}
          </div>
          <div class="recent-meta">
            ${copy.customerName ? `<div class="recent-customer">${escHtml(copy.customerName)}</div>` : ''}
            <div class="recent-date">${relTime(copy.updatedAt || copy.createdAt)}</div>
          </div>
        </a>`;
      }).join('');

  const initials = locationName
    ? locationName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'GL';

  const safeName  = locationName  || 'My Location';
  const safeEmail = locationEmail || '';
  const safeLogo  = locationLogo  || '';

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Team — GHL Automator</title>
  <style>
    :root {
      --sidebar-w: 240px;
      --topnav-h: 56px;
      --bg:        #F8FAFC;
      --card:      #FFFFFF;
      --border:    #E2E8F0;
      --text:      #0F172A;
      --sub:       #64748B;
      --accent:    #2563EB;
      --accent-bg: #EFF6FF;
      --sb-bg:     #0F172A;
      --sb-text:   #94A3B8;
      --sb-active: #F1F5F9;
      --sb-hover:  #1E293B;
      --sb-border: #1E293B;
      --ok-bg:     #DCFCE7;
      --ok-text:   #15803D;
      --warn-bg:   #FEF3C7;
      --warn-text: #92400E;
      --shadow:    0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg:        #0F172A;
        --card:      #1E293B;
        --border:    #334155;
        --text:      #F1F5F9;
        --sub:       #94A3B8;
        --accent-bg: #1E3A5F;
        --sb-bg:     #020617;
        --sb-border: #1E293B;
        --shadow:    0 1px 3px rgba(0,0,0,.3), 0 4px 16px rgba(0,0,0,.2);
      }
    }
    :root[data-theme="light"] {
      --bg:#F8FAFC;--card:#FFFFFF;--border:#E2E8F0;--text:#0F172A;--sub:#64748B;--accent-bg:#EFF6FF;
      --sb-bg:#0F172A;--sb-text:#94A3B8;--sb-active:#F1F5F9;--sb-hover:#1E293B;--sb-border:#1E293B;
      --shadow:0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.04);
    }
    :root[data-theme="dark"] {
      --bg:#0F172A;--card:#1E293B;--border:#334155;--text:#F1F5F9;--sub:#94A3B8;--accent-bg:#1E3A5F;
      --sb-bg:#020617;--sb-border:#1E293B;--shadow:0 1px 3px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.2);
    }

    *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
    }

    /* ── Sidebar ── */
    .sidebar {
      width: var(--sidebar-w);
      min-height: 100vh;
      background: var(--sb-bg);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      border-right: 1px solid var(--sb-border);
      position: fixed;
      top: 0; left: 0; bottom: 0;
      z-index: 50;
    }

    .sb-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 18px 16px;
      border-bottom: 1px solid var(--sb-border);
    }
    .sb-logo-icon {
      width: 32px; height: 32px;
      background: var(--accent);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .sb-logo-icon svg { width: 18px; height: 18px; fill: #fff; }
    .sb-logo-name { font-size: .875rem; font-weight: 700; color: var(--sb-active); letter-spacing: -.01em; }

    .sb-nav {
      flex: 1;
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sb-section-label {
      font-size: .6875rem;
      font-weight: 600;
      color: var(--sb-text);
      text-transform: uppercase;
      letter-spacing: .08em;
      padding: 10px 8px 6px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      font-size: .875rem;
      font-weight: 500;
      color: var(--sb-text);
      text-decoration: none;
      transition: background .12s, color .12s;
      cursor: pointer;
    }
    .nav-item:hover { background: var(--sb-hover); color: var(--sb-active); }
    .nav-item.active { background: rgba(37,99,235,.2); color: #60A5FA; }
    .nav-item svg { width: 18px; height: 18px; flex-shrink: 0; }

    /* ── User section at sidebar bottom ── */
    .sb-user-wrap { position: relative; padding: 10px; border-top: 1px solid var(--sb-border); }
    .sb-user {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: background .12s;
      user-select: none;
    }
    .sb-user:hover { background: var(--sb-hover); }
    .sb-avatar {
      width: 34px; height: 34px;
      border-radius: 8px;
      background: #1E3A5F;
      border: 1px solid rgba(255,255,255,.1);
      flex-shrink: 0;
      overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      font-size: .75rem; font-weight: 700; color: #93C5FD;
    }
    .sb-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .sb-user-info { flex: 1; min-width: 0; }
    .sb-user-name {
      font-size: .8125rem; font-weight: 600; color: var(--sb-active);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sb-user-email {
      font-size: .6875rem; color: var(--sb-text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sb-user-chevron { width: 16px; height: 16px; flex-shrink: 0; color: var(--sb-text); }

    .user-menu {
      position: absolute;
      bottom: calc(100% - 6px);
      left: 10px; right: 10px;
      background: #1E293B;
      border: 1px solid #334155;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,.4);
      padding: 6px;
      display: none;
      z-index: 100;
    }
    .user-menu.open { display: block; }
    .user-menu-item {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 9px 10px;
      border-radius: 7px;
      font-size: .8125rem;
      font-weight: 500;
      color: #CBD5E1;
      text-decoration: none;
      transition: background .1s, color .1s;
    }
    .user-menu-item:hover { background: #334155; color: #F1F5F9; }
    .user-menu-item.danger:hover { background: #450A0A; color: #F87171; }
    .user-menu-item svg { width: 16px; height: 16px; flex-shrink: 0; }
    .menu-divider { height: 1px; background: #334155; margin: 4px 0; }

    /* ── Main area ── */
    .main {
      margin-left: var(--sidebar-w);
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    /* ── Top nav ── */
    .topnav {
      height: var(--topnav-h);
      background: var(--card);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      position: sticky;
      top: 0;
      z-index: 40;
    }
    .topnav-left { display: flex; align-items: center; gap: 8px; }
    .breadcrumb { font-size: .875rem; color: var(--sub); }
    .breadcrumb-sep { color: var(--border); }
    .breadcrumb-current { font-weight: 600; color: var(--text); }
    .topnav-right { display: flex; align-items: center; gap: 10px; }
    .status-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: .75rem; font-weight: 600;
    }
    .status-pill.ok  { background: var(--ok-bg);   color: var(--ok-text); }
    .status-pill.warn{ background: var(--warn-bg);  color: var(--warn-text); }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

    /* ── Content ── */
    .content {
      flex: 1;
      padding: 28px 24px;
    }
    .content-title {
      font-size: 1.125rem; font-weight: 700; color: var(--text);
      letter-spacing: -.02em; margin-bottom: 20px;
    }

    .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 20px; }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      box-shadow: var(--shadow);
    }
    .card-label {
      font-size: .6875rem; font-weight: 700; color: var(--sub);
      text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px;
    }
    .card-value {
      font-size: 1.5rem; font-weight: 700; color: var(--text);
      letter-spacing: -.02em;
    }
    .card-sub { font-size: .8125rem; color: var(--sub); margin-top: 4px; }

    .section-title {
      font-size: .8125rem; font-weight: 700; color: var(--sub);
      text-transform: uppercase; letter-spacing: .07em;
      margin-bottom: 12px; margin-top: 24px;
    }

    .recent-list { display: flex; flex-direction: column; gap: 8px; }
    .recent-item {
      display: flex; align-items: center; gap: 12px;
      background: var(--card); border: 1px solid var(--border);
      border-radius: 10px; padding: 12px 16px;
      text-decoration: none; box-shadow: var(--shadow);
      transition: border-color .12s, box-shadow .12s;
    }
    .recent-item:hover { border-color: var(--accent); box-shadow: 0 4px 16px rgba(37,99,235,.1); }
    .recent-badge {
      padding: 2px 8px; border-radius: 999px;
      font-size: .6875rem; font-weight: 700;
      white-space: nowrap; flex-shrink: 0;
    }
    .recent-info { flex: 1; min-width: 0; }
    .recent-title { font-size: .875rem; font-weight: 600; color: var(--text); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .recent-preview { font-size: .8125rem; color: var(--sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .recent-meta { text-align: right; flex-shrink: 0; min-width: 80px; }
    .recent-customer { font-size: .75rem; font-weight: 600; color: var(--text); }
    .recent-date { font-size: .75rem; color: var(--sub); margin-top: 2px; }

    .loc-chip {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--accent-bg);
      border: 1px solid var(--border);
      border-radius: 7px;
      padding: 5px 10px;
      font-size: .75rem; color: var(--sub);
      font-family: 'SF Mono', 'Fira Code', monospace;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    @media (prefers-reduced-motion: reduce) { * { transition-duration: .001ms !important; } }
  </style>
</head>
<body>

<!-- ── Sidebar ─────────────────────────────── -->
<aside class="sidebar">

  <div class="sb-logo">
    <div class="sb-logo-icon">
      <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <span class="sb-logo-name">Automator</span>
  </div>

  <nav class="sb-nav">
    <div class="sb-section-label">Menu</div>

    <a class="nav-item active" href="/dashboard?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
      <span>Dashboard</span>
    </a>

    <a class="nav-item" href="/dashboard/copywriters?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
      <span>Copywriters</span>
    </a>

    <a class="nav-item" href="/dashboard/library?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
      <span>Library</span>
    </a>

    <a class="nav-item" href="#">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      <span>Team</span>
    </a>

    <a class="nav-item" href="/dashboard/settings?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
      <span>Settings</span>
    </a>

  </nav>

  <!-- User section -->
  <div class="sb-user-wrap">
    <div class="user-menu" id="userMenu">
      <div style="padding:8px 10px 6px;border-bottom:1px solid #334155;margin-bottom:4px">
        <div style="font-size:.8rem;font-weight:600;color:#F1F5F9">${safeName}</div>
        ${safeEmail ? `<div style="font-size:.7rem;color:#64748B;margin-top:1px">${safeEmail}</div>` : ''}
      </div>
      <a class="user-menu-item" href="/install?locationId=${safeId}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
        </svg>
        Settings
      </a>
      <div class="menu-divider"></div>
      <a class="user-menu-item danger" href="/auth/logout?locationId=${safeId}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sign out
      </a>
    </div>

    <div class="sb-user" onclick="toggleUserMenu(event)">
      <div class="sb-avatar">
        ${safeLogo ? `<img src="${safeLogo}" alt="${safeName}"/>` : `<span>${initials}</span>`}
      </div>
      <div class="sb-user-info">
        <div class="sb-user-name">${safeName}</div>
        ${safeEmail ? `<div class="sb-user-email">${safeEmail}</div>` : ''}
      </div>
      <svg class="sb-user-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
      </svg>
    </div>
  </div>

</aside>

<!-- ── Main ─────────────────────────────────── -->
<div class="main">

  <!-- AI key expiry banner -->
  <div id="ai-key-banner" style="display:none;align-items:center;gap:10px;padding:10px 24px;font-size:.8125rem;border-bottom:1px solid">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    <span id="ai-banner-msg"></span>
    <a href="/dashboard/settings?locationId=${safeId}" style="margin-left:auto;font-weight:600;text-decoration:underline;color:inherit">Update in Settings →</a>
    <button onclick="this.parentElement.style.display='none'" style="background:none;border:none;cursor:pointer;font-size:1rem;color:inherit;opacity:.7;margin-left:8px">✕</button>
  </div>

  <!-- Top nav -->
  <header class="topnav">
    <div class="topnav-left">
      <span class="breadcrumb">
        <span>Automator</span>
        <span class="breadcrumb-sep"> / </span>
        <span class="breadcrumb-current">Dashboard</span>
      </span>
    </div>
    <div class="topnav-right">
      ${safeId ? `<div class="loc-chip">${safeId}</div>` : ''}
      <div class="status-pill ${hasPITs ? 'ok' : 'warn'}">
        <span class="status-dot"></span>
        ${hasPITs ? 'Active' : 'Setup required'}
      </div>
    </div>
  </header>

  <!-- Content -->
  <main class="content">
    <div class="content-title">Overview</div>

    <div class="grid-2">
      <div class="card">
        <div class="card-label">Status</div>
        <div class="card-value" style="color:${hasPITs ? 'var(--ok-text)' : 'var(--warn-text)'}">
          ${hasPITs ? 'Connected' : 'Incomplete'}
        </div>
        <div class="card-sub">${hasPITs ? 'PITs verified and stored' : 'Complete setup to activate actions'}</div>
      </div>
      <div class="card">
        <div class="card-label">Location</div>
        <div class="card-value" style="font-size:1.125rem">${safeName}</div>
        <div class="card-sub" style="font-family:monospace;font-size:.75rem">${safeId || '—'}</div>
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:24px;margin-bottom:12px">
      <div class="section-title" style="margin:0">Recent Copy</div>
      <a href="/dashboard/library?locationId=${safeId}" style="font-size:.8125rem;color:var(--accent);text-decoration:none;font-weight:600">View Library →</a>
    </div>
    <div class="recent-list">${recentHtml}</div>

  </main>
</div>

<script>
  function toggleUserMenu(e) {
    e.stopPropagation();
    document.getElementById('userMenu').classList.toggle('open');
  }
  document.addEventListener('click', () => {
    document.getElementById('userMenu').classList.remove('open');
  });

  (function checkAIBanner() {
    try {
      const raw = localStorage.getItem('ghl_ai_config');
      if (!raw) return;
      const c = JSON.parse(raw);
      const days = Math.ceil((c.expiresAt - Date.now()) / 86400000);
      if (days > 3) return;
      const banner = document.getElementById('ai-key-banner');
      const msg    = document.getElementById('ai-banner-msg');
      const pName  = c.provider ? c.provider.charAt(0).toUpperCase() + c.provider.slice(1) : 'AI';
      if (days <= 0) {
        banner.style.background = '#FEE2E2'; banner.style.borderBottomColor = '#EF4444'; banner.style.color = '#991B1B';
        msg.textContent = pName + ' API key has expired — Copywriters are paused.';
      } else {
        banner.style.background = '#FEF3C7'; banner.style.borderBottomColor = '#F59E0B'; banner.style.color = '#92400E';
        msg.textContent = pName + ' API key expires in ' + days + ' day' + (days !== 1 ? 's' : '') + '. Update before it stops working.';
      }
      banner.style.display = 'flex';
    } catch(e) {}
  })();
</script>
</body>
</html>`);
});

module.exports = router;
