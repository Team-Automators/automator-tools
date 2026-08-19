const express   = require('express');
const router    = express.Router();
const copyStore = require('../lib/copy-store');
const { TYPES } = require('../lib/copywriter-types');

// ── Helpers ────────────────────────────────────────────────────────────────────

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
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name) {
  return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function typeBadge(type) {
  const t = TYPES[type] || TYPES.general;
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;font-size:.6875rem;font-weight:700;background:${t.colorBg};color:${t.color}">${escHtml(t.title.split(' ')[0])}</span>`;
}

// ── Shared sidebar ─────────────────────────────────────────────────────────────

function sidebar(safeId, active) {
  return `<aside class="sidebar">
  <div class="sb-logo">
    <div class="sb-logo-icon"><svg viewBox="0 0 24 24" fill="#fff" width="18" height="18"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
    <span class="sb-logo-name">Automator</span>
  </div>
  <nav class="sb-nav">
    <div class="sb-section-label">Menu</div>
    <a class="nav-item ${active==='dashboard'?'active':''}" href="/dashboard?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      <span>Dashboard</span>
    </a>
    <a class="nav-item ${active==='copywriters'?'active':''}" href="/dashboard/copywriters?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      <span>Copywriters</span>
    </a>
    <a class="nav-item ${active==='library'?'active':''}" href="/dashboard/library?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      <span>Library</span>
    </a>
    <a class="nav-item ${active==='team'?'active':''}" href="#">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <span>Team</span>
    </a>
    <a class="nav-item ${active==='settings'?'active':''}" href="/dashboard/settings?locationId=${safeId}">
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
</aside>`;
}

const BASE_CSS = `
  :root{--sidebar-w:240px;--topnav-h:56px;--bg:#F8FAFC;--card:#FFFFFF;--border:#E2E8F0;--text:#0F172A;--sub:#64748B;--accent:#2563EB;--accent-bg:#EFF6FF;--sb-bg:#0F172A;--sb-text:#94A3B8;--sb-active:#F1F5F9;--sb-hover:#1E293B;--sb-border:#1E293B;--shadow:0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.04);--ok:#15803D;--ok-bg:#DCFCE7;--err:#991B1B;--err-bg:#FEE2E2;}
  @media(prefers-color-scheme:dark){:root{--bg:#0F172A;--card:#1E293B;--border:#334155;--text:#F1F5F9;--sub:#94A3B8;--accent-bg:#1E3A5F;--sb-bg:#020617;--sb-border:#1E293B;--shadow:0 1px 3px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.2);--ok-bg:#14532D;--err-bg:#450A0A;}}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex}
  .sidebar{width:var(--sidebar-w);min-height:100vh;background:var(--sb-bg);display:flex;flex-direction:column;flex-shrink:0;border-right:1px solid var(--sb-border);position:fixed;top:0;left:0;bottom:0;z-index:50}
  .sb-logo{display:flex;align-items:center;gap:10px;padding:20px 18px 16px;border-bottom:1px solid var(--sb-border)}
  .sb-logo-icon{width:32px;height:32px;background:#2563EB;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .sb-logo-name{font-size:.875rem;font-weight:700;color:var(--sb-active);letter-spacing:-.01em}
  .sb-nav{flex:1;padding:12px 10px;display:flex;flex-direction:column;gap:2px}
  .sb-section-label{font-size:.6875rem;font-weight:600;color:var(--sb-text);text-transform:uppercase;letter-spacing:.08em;padding:10px 8px 6px}
  .nav-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;font-size:.875rem;font-weight:500;color:var(--sb-text);text-decoration:none;transition:background .12s,color .12s;cursor:pointer}
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
  .main{margin-left:var(--sidebar-w);flex:1;display:flex;flex-direction:column;min-height:100vh}
  .topnav{height:var(--topnav-h);background:var(--card);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:40;flex-shrink:0}
  .topnav-left{display:flex;align-items:center;gap:8px}
  .breadcrumb{font-size:.875rem;color:var(--sub)}
  .breadcrumb-sep{color:var(--border)}
  .breadcrumb-current{font-weight:600;color:var(--text)}
  .content{flex:1;padding:28px 24px}
  .btn{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:9px;font-size:.8125rem;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:opacity .15s,background .1s;text-decoration:none}
  .btn:hover{opacity:.88}
  .btn-primary{background:var(--accent);color:#fff}
  .btn-outline{background:var(--card);border:1px solid var(--border);color:var(--sub)}
  .btn-outline:hover{background:var(--bg);opacity:1;color:var(--text)}
  .btn-danger{background:var(--err-bg);color:var(--err);border:1px solid #FECACA}
  @media(prefers-reduced-motion:reduce){*{transition-duration:.001ms!important}}
`;

// ── GET /dashboard/library ─────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const safeId    = req.query.locationId || '';
  const customers = safeId ? await copyStore.getCustomers(safeId).catch(() => []) : [];
  const idx       = safeId ? await copyStore.getCopyIndex(safeId).catch(() => []) : [];

  const countMap = {};
  const lastMap  = {};
  for (const item of idx) {
    const key = item.customerId || '_unsorted';
    countMap[key] = (countMap[key] || 0) + 1;
    if (!lastMap[key] || item.updatedAt > lastMap[key]) lastMap[key] = item.updatedAt;
  }

  const unsortedCopies = idx.filter(i => !i.customerId || i.customerId === '_unsorted');

  const emptyState = customers.length === 0 && unsortedCopies.length === 0 ? `
    <div style="grid-column:1/-1;text-align:center;padding:60px 24px;color:var(--sub)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="margin:0 auto 16px;display:block;opacity:.35"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      <div style="font-size:1rem;font-weight:600;color:var(--text);margin-bottom:6px">Library is empty</div>
      <div style="font-size:.875rem;margin-bottom:16px">Generate copy in Copywriters and save it here.</div>
      <a href="/dashboard/copywriters?locationId=${safeId}" class="btn btn-primary" style="display:inline-flex">Open Copywriters →</a>
    </div>` : '';

  const custCards = customers.map(c => {
    const count = countMap[c.id] || 0;
    const last  = lastMap[c.id] ? relTime(lastMap[c.id]) : 'No activity';
    const ini   = initials(c.name);
    return `
    <a class="cust-card" href="/dashboard/library/${escHtml(c.id)}?locationId=${safeId}">
      <div class="cust-avatar">${escHtml(ini)}</div>
      <div class="cust-info">
        <div class="cust-name">${escHtml(c.name)}</div>
        ${c.email ? `<div class="cust-email">${escHtml(c.email)}</div>` : ''}
        <div class="cust-meta">${count} ${count === 1 ? 'copy' : 'copies'} · ${last}</div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="color:var(--sub);flex-shrink:0"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
    </a>`;
  }).join('');

  // Unsorted card — shown when there are any unsorted copies
  const unsortedCard = unsortedCopies.length > 0 ? `
    <a class="cust-card" href="/dashboard/library/_unsorted?locationId=${safeId}" style="border-style:dashed;border-color:var(--sub);opacity:.85">
      <div class="cust-avatar" style="background:var(--bg);border:1px solid var(--border);color:var(--sub)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      </div>
      <div class="cust-info">
        <div class="cust-name" style="color:var(--sub)">Unsorted</div>
        <div class="cust-meta">${unsortedCopies.length} ${unsortedCopies.length === 1 ? 'copy' : 'copies'} · Not assigned to a customer</div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="color:var(--sub);flex-shrink:0"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
    </a>` : '';

  const cards = emptyState || (custCards + unsortedCard);

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Library — GHL Automator</title>
  <style>
    ${BASE_CSS}
    .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
    .page-title{font-size:1.125rem;font-weight:700;color:var(--text);letter-spacing:-.02em}
    .cust-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
    .cust-card{display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;text-decoration:none;transition:box-shadow .15s,border-color .15s,transform .1s;box-shadow:var(--shadow)}
    .cust-card:hover{border-color:var(--accent);box-shadow:0 4px 20px rgba(0,0,0,.08);transform:translateY(-2px)}
    .cust-avatar{width:44px;height:44px;border-radius:10px;background:var(--accent-bg);display:flex;align-items:center;justify-content:center;font-size:.875rem;font-weight:700;color:var(--accent);flex-shrink:0}
    .cust-info{flex:1;min-width:0}
    .cust-name{font-size:.9375rem;font-weight:700;color:var(--text);margin-bottom:2px}
    .cust-email{font-size:.75rem;color:var(--sub);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cust-meta{font-size:.75rem;color:var(--sub)}

    /* New customer form */
    .new-form{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;box-shadow:var(--shadow);margin-bottom:20px;display:none}
    .new-form.open{display:block}
    .form-row{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
    input[type=text],input[type=email]{flex:1;min-width:160px;padding:9px 13px;border:1px solid var(--border);border-radius:8px;font-size:.875rem;font-family:inherit;background:var(--bg);color:var(--text);outline:none;transition:border .15s}
    input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,.1)}
    .form-err{font-size:.8125rem;color:var(--err);margin-top:8px;display:none}
  </style>
</head>
<body>
${sidebar(safeId, 'library')}
<div class="main">
  <header class="topnav">
    <div class="topnav-left">
      <span class="breadcrumb">
        <span>Automator</span>
        <span class="breadcrumb-sep"> / </span>
        <span class="breadcrumb-current">Library</span>
      </span>
    </div>
  </header>
  <main class="content">
    <div class="page-header">
      <div class="page-title">Copy Library</div>
      <button class="btn btn-primary" onclick="toggleNewForm()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
        New Customer
      </button>
    </div>

    <div class="new-form" id="newForm">
      <div style="font-size:.875rem;font-weight:600;color:var(--text)">Create Customer Folder</div>
      <div class="form-row">
        <input type="text" id="custName" placeholder="Customer name *" required/>
        <input type="email" id="custEmail" placeholder="Email (optional)"/>
        <button class="btn btn-primary" onclick="createCustomer()">Create</button>
        <button class="btn btn-outline" onclick="toggleNewForm()">Cancel</button>
      </div>
      <div class="form-err" id="formErr"></div>
    </div>

    <div class="cust-grid" id="custGrid">${cards}</div>
  </main>
</div>
<script>
const LOCATION_ID = '${safeId}';

function toggleNewForm() {
  const f = document.getElementById('newForm');
  f.classList.toggle('open');
  if (f.classList.contains('open')) document.getElementById('custName').focus();
  document.getElementById('formErr').style.display = 'none';
}

async function createCustomer() {
  const name  = document.getElementById('custName').value.trim();
  const email = document.getElementById('custEmail').value.trim();
  const err   = document.getElementById('formErr');
  if (!name) { err.textContent = 'Name is required.'; err.style.display = 'block'; return; }
  err.style.display = 'none';

  try {
    const res = await fetch('/api/customers', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ locationId: LOCATION_ID, name, email }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed');
    const c = await res.json();
    window.location.href = '/dashboard/library/' + c.id + '?locationId=' + LOCATION_ID;
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
  }
}

document.getElementById('custName').addEventListener('keydown', e => {
  if (e.key === 'Enter') createCustomer();
});

document.addEventListener('click', e => {
  if (!e.target.closest('.sb-user-wrap')) document.querySelectorAll('.user-menu.open').forEach(m => m.classList.remove('open'));
});
</script>
</body>
</html>`);
});

// ── GET /dashboard/library/:customerId ─────────────────────────────────────────

router.get('/:customerId', async (req, res) => {
  const safeId         = req.query.locationId || '';
  const { customerId } = req.params;
  const isUnsorted     = customerId === '_unsorted';

  const [customers, allIdx] = await Promise.all([
    copyStore.getCustomers(safeId).catch(() => []),
    copyStore.getCopyIndex(safeId).catch(() => []),
  ]);

  let customer, copies;

  if (isUnsorted) {
    customer = { id: '_unsorted', name: 'Unsorted', email: '' };
    copies   = allIdx.filter(i => !i.customerId || i.customerId === '_unsorted');
  } else {
    customer = customers.find(c => c.id === customerId);
    if (!customer) return res.redirect(`/dashboard/library?locationId=${safeId}`);
    copies = allIdx.filter(i => i.customerId === customerId);
  }

  // Group copies by type
  const byType = {};
  for (const copy of copies) {
    if (!byType[copy.type]) byType[copy.type] = [];
    byType[copy.type].push(copy);
  }

  const typeOrder = ['email', 'social', 'ads', 'sales-page', 'webinar', 'blog', 'general'];
  const sortedTypes = [...new Set([...typeOrder, ...Object.keys(byType)])].filter(t => byType[t]);

  const typeSections = sortedTypes.length === 0 ? `
    <div style="text-align:center;padding:60px 24px;color:var(--sub)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="44" height="44" style="margin:0 auto 14px;display:block;opacity:.35"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <div style="font-size:.9375rem;font-weight:600;color:var(--text);margin-bottom:6px">No copy yet</div>
      <div style="font-size:.875rem">Generate copy in Copywriters and save it here.</div>
      <a href="/dashboard/copywriters?locationId=${safeId}" class="btn btn-primary" style="margin-top:16px;display:inline-flex">Go to Copywriters</a>
    </div>` : sortedTypes.map(type => {
    const t    = TYPES[type] || TYPES.general;
    const rows = byType[type].map(copy => `
      <div class="copy-row" id="row-${escHtml(copy.id)}">
        <div class="copy-row-info">
          <div class="copy-row-title">${escHtml(copy.title || 'Untitled')}</div>
          ${copy.preview ? `<div class="copy-row-preview">${escHtml(copy.preview.slice(0, 100))}${copy.preview.length > 100 ? '…' : ''}</div>` : ''}
          <div class="copy-row-meta">${relTime(copy.updatedAt || copy.createdAt)}</div>
        </div>
        <div class="copy-row-actions">
          ${isUnsorted ? `<button class="btn btn-outline" onclick="moveToCustomer('${escHtml(copy.id)}', this)" style="font-size:.75rem">Move to Customer</button>` : ''}
          <a class="btn btn-outline" href="/dashboard/library/${escHtml(customerId)}/${escHtml(copy.id)}?locationId=${safeId}">Open</a>
          <button class="btn btn-danger" onclick="deleteCopy('${escHtml(copy.id)}', this)" style="padding:8px 12px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>`).join('');
    return `
    <div class="type-section">
      <div class="type-header">
        <div class="type-icon" style="background:${t.colorBg};color:${t.color}">${t.icon}</div>
        <div class="type-label" style="color:${t.color}">${escHtml(t.title)}</div>
        <div class="type-count">${byType[type].length}</div>
        <a href="/dashboard/copywriters/${escHtml(type)}?locationId=${safeId}" class="btn btn-outline" style="margin-left:auto;padding:4px 10px;font-size:.75rem">+ New ${escHtml(t.title.split(' ')[0])}</a>
      </div>
      <div class="copy-list">${rows}</div>
    </div>`;
  }).join('');

  const ini = isUnsorted ? null : initials(customer.name);

  // Customers list for "move to" dropdown (excluding _unsorted)
  const moveCustomers = customers.filter(c => c.id !== '_unsorted');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escHtml(customer.name)} — Library</title>
  <style>
    ${BASE_CSS}
    .cust-header{display:flex;align-items:center;gap:14px;margin-bottom:28px}
    .cust-header-avatar{width:52px;height:52px;border-radius:12px;background:var(--accent-bg);display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;color:var(--accent);flex-shrink:0}
    .cust-header-info{flex:1}
    .cust-header-name{font-size:1.125rem;font-weight:700;color:var(--text);letter-spacing:-.02em}
    .cust-header-email{font-size:.8125rem;color:var(--sub);margin-top:2px}
    .type-section{margin-bottom:28px}
    .type-header{display:flex;align-items:center;gap:10px;margin-bottom:12px}
    .type-icon{width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .type-icon svg{width:14px;height:14px}
    .type-label{font-size:.875rem;font-weight:700}
    .type-count{font-size:.75rem;font-weight:600;color:var(--sub);background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:1px 8px}
    .copy-list{display:flex;flex-direction:column;gap:8px}
    .copy-row{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;box-shadow:var(--shadow)}
    .copy-row-info{flex:1;min-width:0}
    .copy-row-title{font-size:.875rem;font-weight:600;color:var(--text);margin-bottom:2px}
    .copy-row-preview{font-size:.8125rem;color:var(--sub);line-height:1.4;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .copy-row-meta{font-size:.75rem;color:var(--sub)}
    .copy-row-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}
    .toast{position:fixed;bottom:24px;right:24px;background:#1E293B;color:#F1F5F9;border-radius:10px;padding:12px 20px;font-size:.875rem;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.4);display:none;z-index:200;animation:slideUp .2s ease}
    @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    /* Move modal */
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;z-index:300;padding:24px}
    .modal-overlay.open{display:flex}
    .modal{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;width:100%;max-width:380px}
    .modal select{width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:.875rem;font-family:inherit;background:var(--bg);color:var(--text);outline:none;margin:12px 0 16px}
    .modal-actions{display:flex;gap:8px}
    .modal-btn{flex:1;padding:9px;border-radius:9px;font-size:.875rem;font-weight:600;cursor:pointer;border:none;font-family:inherit}
    .modal-btn-primary{background:var(--accent);color:#fff}
    .modal-btn-cancel{background:var(--bg);border:1px solid var(--border);color:var(--sub)}
  </style>
</head>
<body>
${sidebar(safeId, 'library')}
<div class="main">
  <header class="topnav">
    <div class="topnav-left">
      <span class="breadcrumb">
        <a href="/dashboard/library?locationId=${safeId}" style="color:var(--sub);text-decoration:none">Library</a>
        <span class="breadcrumb-sep"> / </span>
        <span class="breadcrumb-current">${escHtml(customer.name)}</span>
      </span>
    </div>
    ${!isUnsorted ? `<button class="btn btn-danger" onclick="deleteCustomer()" style="font-size:.8rem;padding:6px 12px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      Delete Customer
    </button>` : ''}
  </header>
  <main class="content">
    <div class="cust-header">
      <div class="cust-header-avatar" style="${isUnsorted ? 'background:var(--bg);border:1px solid var(--border)' : ''}">
        ${isUnsorted
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22" style="color:var(--sub)"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`
          : escHtml(ini)}
      </div>
      <div class="cust-header-info">
        <div class="cust-header-name" ${isUnsorted ? 'style="color:var(--sub)"' : ''}>${escHtml(customer.name)}</div>
        ${!isUnsorted && customer.email ? `<div class="cust-header-email">${escHtml(customer.email)}</div>` : ''}
        ${isUnsorted ? `<div style="font-size:.8125rem;color:var(--sub)">Copies not yet assigned to a customer — <a href="/dashboard/library?locationId=${safeId}" style="color:var(--accent)">Create a customer folder</a> and move them.</div>` : ''}
      </div>
    </div>
    ${typeSections}
  </main>
</div>
<div class="toast" id="toast"></div>

${isUnsorted ? `
<!-- Move to Customer modal -->
<div class="modal-overlay" id="moveModal" onclick="if(event.target===this)closeMoveModal()">
  <div class="modal">
    <div style="font-size:.9375rem;font-weight:700;color:var(--text);margin-bottom:4px">Move to Customer</div>
    <p style="font-size:.8125rem;color:var(--sub)">Select a customer folder to move this copy into.</p>
    <select id="moveSelect">
      <option value="">— Select customer —</option>
      ${moveCustomers.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('')}
    </select>
    <div class="modal-actions">
      <button class="modal-btn modal-btn-primary" onclick="confirmMove()">Move</button>
      <button class="modal-btn modal-btn-cancel" onclick="closeMoveModal()">Cancel</button>
    </div>
  </div>
</div>` : ''}

<script>
const LOCATION_ID   = '${safeId}';
const CUSTOMER_ID   = '${escHtml(customerId)}';
const CUSTOMER_NAME = '${escHtml(customer.name.replace(/'/g, "\\'"))}';

function toast(msg, ms = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, ms);
}

async function deleteCopy(copyId, btn) {
  if (!confirm('Delete this copy? This cannot be undone.')) return;
  btn.disabled = true;
  try {
    const r = await fetch('/api/copies/' + copyId + '?locationId=' + LOCATION_ID, { method: 'DELETE' });
    if (!r.ok) throw new Error('Failed');
    document.getElementById('row-' + copyId)?.remove();
    toast('Copy deleted');
  } catch { btn.disabled = false; toast('Delete failed'); }
}

async function deleteCustomer() {
  if (!confirm('Delete ' + CUSTOMER_NAME + ' and all their copy history? This cannot be undone.')) return;
  try {
    const copies = ${JSON.stringify(copies.map(c => c.id))};
    await Promise.all(copies.map(id => fetch('/api/copies/' + id + '?locationId=' + LOCATION_ID, { method: 'DELETE' })));
    await fetch('/api/customers/' + CUSTOMER_ID + '?locationId=' + LOCATION_ID, { method: 'DELETE' });
    window.location.href = '/dashboard/library?locationId=' + LOCATION_ID;
  } catch { toast('Delete failed'); }
}

// Move copy to a customer folder (used in Unsorted view)
let _moveCopyId = null;
function moveToCustomer(copyId, btn) {
  _moveCopyId = copyId;
  const modal = document.getElementById('moveModal');
  if (modal) { modal.classList.add('open'); document.getElementById('moveSelect').value = ''; }
}
function closeMoveModal() {
  const modal = document.getElementById('moveModal');
  if (modal) modal.classList.remove('open');
  _moveCopyId = null;
}
async function confirmMove() {
  const sel = document.getElementById('moveSelect');
  const customerId  = sel.value;
  const customerName = sel.selectedOptions[0]?.text || '';
  if (!customerId || !_moveCopyId) return;
  try {
    // Fetch full copy, update customerId, PUT back
    const copyRes = await fetch('/api/copies/' + _moveCopyId);
    if (!copyRes.ok) throw new Error('Failed to fetch copy');
    const copy = await copyRes.json();
    copy.customerId   = customerId;
    copy.customerName = customerName;
    const putRes = await fetch('/api/copies/' + _moveCopyId, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ locationId: LOCATION_ID, messages: copy.messages, customerId, customerName }),
    });
    if (!putRes.ok) throw new Error('Failed to move');
    document.getElementById('row-' + _moveCopyId)?.remove();
    closeMoveModal();
    toast('Moved to ' + customerName + ' ✓');
  } catch (e) { toast('Move failed: ' + e.message); }
}

document.addEventListener('click', e => {
  if (!e.target.closest('.sb-user-wrap')) document.querySelectorAll('.user-menu.open').forEach(m => m.classList.remove('open'));
});
</script>
</body>
</html>`);
});

// ── GET /dashboard/library/:customerId/:copyId ─────────────────────────────────

router.get('/:customerId/:copyId', async (req, res) => {
  const safeId               = req.query.locationId || '';
  const { customerId, copyId } = req.params;

  const copy = await copyStore.getCopy(copyId).catch(() => null);
  if (!copy || copy.locationId !== safeId) {
    return res.redirect(`/dashboard/library/${customerId}?locationId=${safeId}`);
  }

  const isUnsortedChat = customerId === '_unsorted';
  const customers = isUnsortedChat ? [] : await copyStore.getCustomers(safeId).catch(() => []);
  const customer  = isUnsortedChat
    ? { id: '_unsorted', name: 'Unsorted', email: '' }
    : customers.find(c => c.id === customerId);

  const typeInfo = TYPES[copy.type] || TYPES.general;

  const safeMessages = JSON.stringify(copy.messages || [])
    .replace(/<\/script>/gi, '<\\/script>');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escHtml(copy.title || 'Conversation')} — Library</title>
  <style>
    ${BASE_CSS}
    :root{--cw-color:${typeInfo.color};--cw-bg:${typeInfo.colorBg}}
    body{overflow:hidden}
    .main{display:flex;flex-direction:column;height:100vh;overflow:hidden}
    .topnav{flex-shrink:0}
    .chat-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden}
    .chat-messages{flex:1;overflow-y:auto;padding:24px 32px;display:flex;flex-direction:column;gap:16px;scroll-behavior:smooth}
    .msg{display:flex;gap:12px;max-width:820px;animation:fadeUp .2s ease both}
    @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    .msg.user{align-self:flex-end;flex-direction:row-reverse}
    .msg-avatar{width:34px;height:34px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700}
    .msg.ai .msg-avatar{background:var(--cw-bg);color:var(--cw-color)}
    .msg.ai .msg-avatar svg{width:16px;height:16px}
    .msg.user .msg-avatar{background:#1E293B;color:#93C5FD;font-size:.7rem}
    .msg-bubble{padding:12px 16px;border-radius:12px;font-size:.9rem;line-height:1.7;max-width:680px;white-space:pre-wrap;word-break:break-word}
    .msg.ai .msg-bubble{background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px 12px 12px 12px}
    .msg.user .msg-bubble{background:var(--cw-color);color:#fff;border-radius:12px 4px 12px 12px}
    .msg.ai .msg-bubble.streaming::after{content:'▋';animation:blink .8s step-start infinite;color:var(--cw-color)}
    @keyframes blink{50%{opacity:0}}
    .copy-btn{display:inline-flex;align-items:center;gap:5px;margin-top:10px;padding:5px 12px;border-radius:7px;font-size:.75rem;font-weight:600;cursor:pointer;border:1px solid var(--border);background:var(--bg);color:var(--sub);font-family:inherit;transition:background .1s,color .1s}
    .copy-btn:hover{background:var(--cw-bg);color:var(--cw-color);border-color:var(--cw-color)}
    .copy-btn svg{width:13px;height:13px}
    .chat-input-wrap{flex-shrink:0;border-top:1px solid var(--border);background:var(--card);padding:16px 32px}
    .chat-input-row{display:flex;gap:10px;align-items:flex-end;max-width:820px}
    .chat-input{flex:1;padding:11px 14px;border:1px solid var(--border);border-radius:10px;font-size:.9rem;font-family:inherit;outline:none;background:var(--bg);color:var(--text);resize:none;max-height:160px;min-height:44px;line-height:1.5;transition:border .15s,box-shadow .15s;overflow-y:auto}
    .chat-input:focus{border-color:var(--cw-color);box-shadow:0 0 0 3px color-mix(in srgb,var(--cw-color) 12%,transparent)}
    .send-btn{width:42px;height:42px;border-radius:10px;background:var(--cw-color);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .15s;color:#fff}
    .send-btn:hover{opacity:.88}
    .send-btn:disabled{opacity:.4;cursor:not-allowed}
    .send-btn svg{width:18px;height:18px}
    .typing-dots{display:inline-flex;gap:5px;align-items:center;padding:4px 2px}
    .typing-dots span{width:7px;height:7px;border-radius:50%;background:var(--cw-color);opacity:.3;animation:dotPulse 1.3s ease-in-out infinite}
    .typing-dots span:nth-child(2){animation-delay:.18s}
    .typing-dots span:nth-child(3){animation-delay:.36s}
    @keyframes dotPulse{0%,80%,100%{opacity:.3;transform:scale(.72)}40%{opacity:1;transform:scale(1.05)}}
    .save-indicator{font-size:.75rem;color:var(--sub);display:none;align-items:center;gap:5px}
    .save-indicator.saving{display:inline-flex;color:var(--sub)}
    .save-indicator.saved{display:inline-flex;color:var(--ok)}
    .toast{position:fixed;bottom:24px;right:24px;background:#1E293B;color:#F1F5F9;border-radius:10px;padding:12px 20px;font-size:.875rem;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.4);display:none;z-index:200;animation:slideUp .2s ease}
    @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  </style>
</head>
<body>
${sidebar(safeId, 'library')}
<div class="main">
  <header class="topnav">
    <div class="topnav-left">
      <span class="breadcrumb">
        <a href="/dashboard/library?locationId=${safeId}" style="color:var(--sub);text-decoration:none">Library</a>
        <span class="breadcrumb-sep"> / </span>
        <a href="/dashboard/library/${escHtml(customerId)}?locationId=${safeId}" style="color:var(--sub);text-decoration:none">${escHtml(customer ? customer.name : 'Customer')}</a>
        <span class="breadcrumb-sep"> / </span>
        <span class="breadcrumb-current">${escHtml(copy.title || typeInfo.title)}</span>
      </span>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <span class="save-indicator" id="saveIndicator">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>
        <span id="saveLabel">Saved</span>
      </span>
      <a href="/dashboard/copywriters/${escHtml(copy.type)}?locationId=${safeId}" style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:8px;font-size:.75rem;font-weight:600;border:1px solid var(--border);background:var(--card);color:var(--sub);text-decoration:none;transition:background .1s" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='var(--card)'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M12 5v14M5 12h14"/></svg>
        New ${escHtml(typeInfo.title.split(' ')[0])} Chat
      </a>
      <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:.75rem;font-weight:700;background:${typeInfo.colorBg};color:${typeInfo.color}">${escHtml(typeInfo.title)}</span>
    </div>
  </header>
  <div class="chat-wrap">
    <div class="chat-messages" id="messages"></div>
    <div class="chat-input-wrap">
      <div class="chat-input-row">
        <textarea class="chat-input" id="input" placeholder="Continue the conversation…" rows="1"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}"
          oninput="autoResize(this)"></textarea>
        <button class="send-btn" id="sendBtn" onclick="send()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
const TYPE        = '${escHtml(copy.type)}';
const ICON        = \`${typeInfo.icon}\`;
const LOCATION_ID = '${safeId}';
const COPY_ID     = '${escHtml(copyId)}';
let messages  = ${safeMessages};
let streaming = false;

function loadAIConfig() {
  try {
    const raw = localStorage.getItem('ghl_ai_config');
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (Date.now() > c.expiresAt) return { ...c, expired: true };
    return c;
  } catch { return null; }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

function scrollBottom() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

function addMessage(role, text, isStreaming = false) {
  const wrap   = document.getElementById('messages');
  const div    = document.createElement('div');
  div.className = 'msg ' + role;
  const avatar  = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.innerHTML = role === 'ai' ? ICON : 'You';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble' + (isStreaming ? ' streaming' : '');
  bubble.textContent = text;
  div.appendChild(avatar);
  div.appendChild(bubble);
  wrap.appendChild(div);
  scrollBottom();
  return bubble;
}

function addCopyBtn(bubble) {
  const btn = document.createElement('div');
  btn.innerHTML = \`<br><button class="copy-btn" onclick="copyText(this)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
    Copy to clipboard
  </button>\`;
  bubble.appendChild(btn);
}

function copyText(btn) {
  const bubble = btn.closest('.msg-bubble');
  const text = bubble.innerText.replace('Copy to clipboard','').trim();
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.innerHTML = \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy to clipboard\`; }, 2000);
  });
}

function addTypingMessage() {
  const wrap = document.getElementById('messages');
  const div  = document.createElement('div');
  div.className = 'msg ai';
  const av = document.createElement('div');
  av.className = 'msg-avatar';
  av.innerHTML = ICON;
  const bub = document.createElement('div');
  bub.className = 'msg-bubble streaming';
  bub.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  div.appendChild(av);
  div.appendChild(bub);
  wrap.appendChild(div);
  scrollBottom();
  return { msgEl: div, bubble: bub };
}

function setSaveStatus(status) {
  const el    = document.getElementById('saveIndicator');
  const label = document.getElementById('saveLabel');
  el.className = 'save-indicator ' + status;
  label.textContent = status === 'saving' ? 'Saving…' : 'Saved';
}

async function autoSave() {
  setSaveStatus('saving');
  try {
    await fetch('/api/copies/' + COPY_ID, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ locationId: LOCATION_ID, messages }),
    });
    setSaveStatus('saved');
    setTimeout(() => { document.getElementById('saveIndicator').style.display = 'none'; }, 3000);
  } catch { setSaveStatus('saved'); }
}

function toast(msg, ms = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, ms);
}

async function send() {
  const input = document.getElementById('input');
  const text  = input.value.trim();
  if (!text || streaming) return;
  input.value = '';
  input.style.height = 'auto';
  messages.push({ role: 'user', content: text });
  addMessage('user', text);
  await callAI();
}

async function callAI() {
  streaming = true;
  document.getElementById('sendBtn').disabled = true;

  const aiCfg = loadAIConfig();
  if (!aiCfg) {
    const b = addMessage('ai', '');
    b.innerHTML = 'No AI provider configured.';
    const a = document.createElement('a');
    a.href = '/dashboard/settings?locationId=' + LOCATION_ID;
    a.textContent = ' Set up your API key in Settings →';
    a.style.cssText = 'color:var(--cw-color);text-decoration:underline;font-weight:600;display:block;margin-top:6px';
    b.appendChild(a);
    streaming = false;
    document.getElementById('sendBtn').disabled = false;
    return;
  }
  if (aiCfg.expired) {
    const b = addMessage('ai', '');
    b.innerHTML = 'Your API key has expired.';
    const a = document.createElement('a');
    a.href = '/dashboard/settings?locationId=' + LOCATION_ID;
    a.textContent = ' Update it in Settings →';
    a.style.cssText = 'color:var(--cw-color);text-decoration:underline;font-weight:600;display:block;margin-top:6px';
    b.appendChild(a);
    streaming = false;
    document.getElementById('sendBtn').disabled = false;
    return;
  }

  const { msgEl: typingMsg } = addTypingMessage();
  let realBubble = null;
  let full = '';

  try {
    const res = await fetch('/copywrite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type: TYPE, messages, provider: aiCfg.provider, apiKey: aiCfg.apiKey }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Connection failed' }));
      typingMsg.remove();
      addMessage('ai', err.error || 'Something went wrong');
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split('\\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { typingMsg.remove(); addMessage('ai', parsed.error); return; }
          const text = parsed.text || '';
          if (text) {
            if (!realBubble) { typingMsg.remove(); realBubble = addMessage('ai', '', true); }
            full += text;
            realBubble.textContent = full;
            scrollBottom();
          }
        } catch {}
      }
    }

    if (realBubble) {
      realBubble.classList.remove('streaming');
      messages.push({ role: 'assistant', content: full });
      if (full.length > 60) addCopyBtn(realBubble);
      await autoSave();
    } else {
      typingMsg.remove();
    }
  } finally {
    streaming = false;
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('input').focus();
  }
}

// Render saved messages on load
function renderHistory() {
  for (const m of messages) {
    addMessage(m.role === 'assistant' ? 'ai' : 'user', m.content);
  }
  // Add copy buttons to long AI messages
  const msgs = document.getElementById('messages');
  const aiMsgs = msgs.querySelectorAll('.msg.ai .msg-bubble');
  aiMsgs.forEach(b => { if (b.textContent.length > 60) addCopyBtn(b); });
}

renderHistory();

document.addEventListener('click', e => {
  if (!e.target.closest('.sb-user-wrap')) document.querySelectorAll('.user-menu.open').forEach(m => m.classList.remove('open'));
});
</script>
</body>
</html>`);
});

module.exports = router;
