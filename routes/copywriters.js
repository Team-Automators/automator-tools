const express = require('express');
const router  = express.Router();
const { TYPES } = require('../lib/copywriter-types');

const APP_URL = process.env.APP_URL || 'https://automator-subuser.vercel.app';

// ── Shared layout helpers ──────────────────────────────────────────────────────

function sidebar(safeId, activePage) {
  return `
<aside class="sidebar">
  <div class="sb-logo">
    <div class="sb-logo-icon">
      <svg viewBox="0 0 24 24" fill="#fff" width="18" height="18"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <span class="sb-logo-name">Automator</span>
  </div>
  <nav class="sb-nav">
    <div class="sb-section-label">Menu</div>
    <a class="nav-item ${activePage === 'dashboard' ? 'active' : ''}" href="/dashboard?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      <span>Dashboard</span>
    </a>
    <a class="nav-item ${activePage === 'copywriters' ? 'active' : ''}" href="/dashboard/copywriters?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      <span>Copywriters</span>
    </a>
    <a class="nav-item ${activePage === 'library' ? 'active' : ''}" href="/dashboard/library?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      <span>Library</span>
    </a>
    <a class="nav-item ${activePage === 'team' ? 'active' : ''}" href="#">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <span>Team</span>
    </a>
    <a class="nav-item ${activePage === 'settings' ? 'active' : ''}" href="/dashboard/settings?locationId=${safeId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      <span>Settings</span>
    </a>
  </nav>
  <div class="sb-user-wrap">
    <div class="sb-user" onclick="this.closest('.sb-user-wrap').querySelector('.user-menu').classList.toggle('open')">
      <div class="sb-avatar"><span>GL</span></div>
      <div class="sb-user-info"><div class="sb-user-name">My Location</div></div>
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

const BASE_STYLES = `
  :root {
    --sidebar-w:240px;--topnav-h:56px;
    --bg:#F8FAFC;--card:#FFFFFF;--border:#E2E8F0;--text:#0F172A;--sub:#64748B;
    --accent:#2563EB;--accent-bg:#EFF6FF;
    --sb-bg:#0F172A;--sb-text:#94A3B8;--sb-active:#F1F5F9;--sb-hover:#1E293B;--sb-border:#1E293B;
    --shadow:0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.04);
  }
  @media(prefers-color-scheme:dark){:root{--bg:#0F172A;--card:#1E293B;--border:#334155;--text:#F1F5F9;--sub:#94A3B8;--accent-bg:#1E3A5F;--sb-bg:#020617;--sb-border:#1E293B;--shadow:0 1px 3px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.2)}}
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
  .sb-user-info{flex:1;min-width:0}
  .sb-user-name{font-size:.8125rem;font-weight:600;color:var(--sb-active);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .user-menu{position:absolute;bottom:calc(100% - 6px);left:10px;right:10px;background:#1E293B;border:1px solid #334155;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.4);padding:6px;display:none;z-index:100}
  .user-menu.open{display:block}
  .user-menu-item{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:7px;font-size:.8125rem;font-weight:500;color:#CBD5E1;text-decoration:none;transition:background .1s,color .1s}
  .user-menu-item.danger:hover{background:#450A0A;color:#F87171}
  .main{margin-left:var(--sidebar-w);flex:1;display:flex;flex-direction:column;min-height:100vh}
  .topnav{height:var(--topnav-h);background:var(--card);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:40}
  .topnav-left{display:flex;align-items:center;gap:8px}
  .breadcrumb{font-size:.875rem;color:var(--sub)}
  .breadcrumb-sep{color:var(--border)}
  .breadcrumb-current{font-weight:600;color:var(--text)}
  .content{flex:1;padding:28px 24px}
`;

// ── GET /dashboard/copywriters — Card listing ──────────────────────────────────

router.get('/', (req, res) => {
  const safeId = req.query.locationId || '';

  const cards = Object.entries(TYPES).map(([slug, t]) => `
    <a class="cw-card" href="/dashboard/copywriters/${slug}?locationId=${safeId}" style="--card-color:${t.color};--card-bg:${t.colorBg}">
      <div class="cw-card-icon">${t.icon}</div>
      <div class="cw-card-body">
        <div class="cw-card-title">${t.title}</div>
        <div class="cw-card-desc">${t.description}</div>
      </div>
      <div class="cw-card-arrow">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </div>
    </a>`).join('');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Copywriters — GHL Automator</title>
  <style>
    ${BASE_STYLES}
    .content-title{font-size:1.125rem;font-weight:700;color:var(--text);letter-spacing:-.02em;margin-bottom:6px}
    .content-sub{font-size:.875rem;color:var(--sub);margin-bottom:24px}
    .cw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .cw-card{display:flex;flex-direction:column;gap:14px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;text-decoration:none;transition:box-shadow .15s,border-color .15s,transform .1s;box-shadow:var(--shadow);cursor:pointer}
    .cw-card:hover{border-color:var(--card-color);box-shadow:0 4px 20px rgba(0,0,0,.08);transform:translateY(-2px)}
    .cw-card-icon{width:44px;height:44px;border-radius:10px;background:var(--card-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--card-color)}
    .cw-card-icon svg{width:22px;height:22px}
    .cw-card-body{flex:1;min-width:0}
    .cw-card-title{font-size:.9375rem;font-weight:700;color:var(--text);margin-bottom:5px}
    .cw-card-desc{font-size:.8125rem;color:var(--sub);line-height:1.5}
    .cw-card-arrow{color:var(--sub);align-self:flex-end}
    .cw-card:hover .cw-card-arrow{color:var(--card-color)}
  </style>
</head>
<body>
${sidebar(safeId, 'copywriters')}
<div class="main">
  <div class="ai-banner" id="ai-key-banner" style="display:none;align-items:center;gap:10px;padding:10px 24px;font-size:.8125rem;border-bottom:1px solid">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    <span id="ai-banner-msg"></span>
    <a id="ai-banner-link" href="/dashboard/settings?locationId=${safeId}" style="margin-left:auto;font-weight:600;text-decoration:underline">Update in Settings →</a>
    <button onclick="this.parentElement.style.display='none'" style="background:none;border:none;cursor:pointer;font-size:1rem;color:inherit;opacity:.7;margin-left:8px">✕</button>
  </div>
  <header class="topnav">
    <div class="topnav-left">
      <span class="breadcrumb">
        <span>Automator</span>
        <span class="breadcrumb-sep"> / </span>
        <span class="breadcrumb-current">Copywriters</span>
      </span>
    </div>
  </header>
  <main class="content">
    <div class="content-title">AI Copywriters</div>
    <p class="content-sub">Select a copywriter type to generate persuasive, high-converting copy.</p>
    <div class="cw-grid">${cards}</div>
  </main>
</div>
<script>
(function checkAIBanner() {
  try {
    const raw = localStorage.getItem('ghl_ai_config');
    if (!raw) return;
    const c = JSON.parse(raw);
    const days = Math.ceil((c.expiresAt - Date.now()) / 86400000);
    if (days > 3) return;
    const banner = document.getElementById('ai-key-banner');
    const msg    = document.getElementById('ai-banner-msg');
    const link   = document.getElementById('ai-banner-link');
    const pName  = c.provider ? c.provider.charAt(0).toUpperCase() + c.provider.slice(1) : 'AI';
    if (days <= 0) {
      banner.style.background = '#FEE2E2'; banner.style.borderBottomColor = '#EF4444'; banner.style.color = '#991B1B';
      msg.textContent = pName + ' API key has expired — copy generation is paused.';
    } else {
      banner.style.background = '#FEF3C7'; banner.style.borderBottomColor = '#F59E0B'; banner.style.color = '#92400E';
      msg.textContent = pName + ' API key expires in ' + days + ' day' + (days !== 1 ? 's' : '') + '. Update before it stops working.';
    }
    banner.style.display = 'flex';
  } catch(e) {}
})();
document.addEventListener('click', e => {
  if (!e.target.closest('.sb-user-wrap'))
    document.querySelectorAll('.user-menu.open').forEach(m => m.classList.remove('open'));
});
</script>
</body>
</html>`);
});

// ── GET /dashboard/copywriters/:type — Chat interface ─────────────────────────

router.get('/:type', (req, res) => {
  const t = TYPES[req.params.type];
  if (!t) return res.redirect('/dashboard/copywriters');

  const safeId = req.query.locationId || '';
  const slug   = req.params.type;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${t.title} — GHL Automator</title>
  <style>
    ${BASE_STYLES}
    :root{--cw-color:${t.color};--cw-bg:${t.colorBg}}
    body{overflow:hidden}
    .main{display:flex;flex-direction:column;height:100vh;overflow:hidden}
    .topnav{flex-shrink:0}

    /* Chat area */
    .chat-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden;padding:0}
    .chat-messages{flex:1;overflow-y:auto;padding:24px 32px;display:flex;flex-direction:column;gap:16px;scroll-behavior:smooth}

    /* Message bubbles */
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

    /* Copy button on AI messages that contain copy */
    .copy-btn{display:inline-flex;align-items:center;gap:5px;margin-top:10px;padding:5px 12px;border-radius:7px;font-size:.75rem;font-weight:600;cursor:pointer;border:1px solid var(--border);background:var(--bg);color:var(--sub);font-family:inherit;transition:background .1s,color .1s}
    .copy-btn:hover{background:var(--cw-bg);color:var(--cw-color);border-color:var(--cw-color)}
    .copy-btn svg{width:13px;height:13px}

    /* Input area */
    .chat-input-wrap{flex-shrink:0;border-top:1px solid var(--border);background:var(--card);padding:16px 32px}
    .chat-input-row{display:flex;gap:10px;align-items:flex-end;max-width:820px}
    .chat-input{flex:1;padding:11px 14px;border:1px solid var(--border);border-radius:10px;font-size:.9rem;font-family:inherit;outline:none;background:var(--bg);color:var(--text);resize:none;max-height:160px;min-height:44px;line-height:1.5;transition:border .15s,box-shadow .15s;overflow-y:auto}
    .chat-input:focus{border-color:var(--cw-color);box-shadow:0 0 0 3px color-mix(in srgb,var(--cw-color) 12%,transparent)}
    .send-btn{width:42px;height:42px;border-radius:10px;background:var(--cw-color);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .15s;color:#fff}
    .send-btn:hover{opacity:.88}
    .send-btn:disabled{opacity:.4;cursor:not-allowed}
    .send-btn svg{width:18px;height:18px}

    /* New chat button */
    .new-chat-btn{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:8px;font-size:.8rem;font-weight:600;cursor:pointer;border:1px solid var(--border);background:var(--card);color:var(--sub);font-family:inherit;transition:background .1s}
    .new-chat-btn:hover{background:var(--bg);color:var(--text)}

    /* Typing indicator dots */
    .typing-dots{display:inline-flex;gap:5px;align-items:center;padding:4px 2px}
    .typing-dots span{width:7px;height:7px;border-radius:50%;background:var(--cw-color);opacity:.3;animation:dotPulse 1.3s ease-in-out infinite}
    .typing-dots span:nth-child(2){animation-delay:.18s}
    .typing-dots span:nth-child(3){animation-delay:.36s}
    @keyframes dotPulse{0%,80%,100%{opacity:.3;transform:scale(.72)}40%{opacity:1;transform:scale(1.05)}}

    /* Save to Library button */
    .save-lib-btn{display:inline-flex;align-items:center;gap:5px;margin-top:10px;margin-left:8px;padding:5px 12px;border-radius:7px;font-size:.75rem;font-weight:600;cursor:pointer;border:1px solid var(--cw-color);background:var(--cw-bg);color:var(--cw-color);font-family:inherit;transition:background .1s,opacity .1s}
    .save-lib-btn:hover{opacity:.8}
    .save-lib-btn svg{width:13px;height:13px}

    /* Modal */
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;z-index:300;padding:24px}
    .modal-overlay.open{display:flex}
    .modal{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;width:100%;max-width:440px;box-shadow:0 16px 48px rgba(0,0,0,.3)}
    .modal-title{font-size:1rem;font-weight:700;color:var(--text);margin-bottom:4px}
    .modal-sub{font-size:.8125rem;color:var(--sub);margin-bottom:18px}
    .modal-field{margin-bottom:14px}
    .modal-label{display:block;font-size:.75rem;font-weight:600;color:var(--sub);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
    .modal-input{width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:.875rem;font-family:inherit;background:var(--bg);color:var(--text);outline:none;transition:border .15s}
    .modal-input:focus{border-color:var(--cw-color);box-shadow:0 0 0 3px color-mix(in srgb,var(--cw-color) 12%,transparent)}
    .modal-actions{display:flex;gap:8px;margin-top:18px}
    .modal-btn{flex:1;padding:9px;border-radius:9px;font-size:.875rem;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:opacity .15s}
    .modal-btn:hover{opacity:.88}
    .modal-btn-primary{background:var(--cw-color);color:#fff}
    .modal-btn-cancel{background:var(--bg);border:1px solid var(--border);color:var(--sub)}
    .modal-err{font-size:.8125rem;color:#EF4444;margin-top:8px;display:none}
    .modal-new-cust{background:none;border:none;color:var(--cw-color);font-size:.8125rem;font-weight:600;cursor:pointer;font-family:inherit;padding:0;margin-top:6px;display:block}
    .new-cust-fields{display:none;margin-top:10px;padding:12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)}
    .new-cust-fields.open{display:block}
    .new-cust-fields .modal-input{margin-bottom:8px}

    /* Toast */
    .toast{position:fixed;bottom:24px;right:24px;background:#1E293B;color:#F1F5F9;border-radius:10px;padding:12px 20px;font-size:.875rem;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.4);display:none;z-index:400;animation:slideUp .2s ease}
    @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  </style>
</head>
<body>
${sidebar(safeId, 'copywriters')}
<div class="main">
  <div class="ai-banner" id="ai-key-banner" style="display:none;align-items:center;gap:10px;padding:10px 24px;font-size:.8125rem;border-bottom:1px solid;flex-shrink:0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    <span id="ai-banner-msg"></span>
    <a href="/dashboard/settings?locationId=${safeId}" style="margin-left:auto;font-weight:600;text-decoration:underline;color:inherit">Update in Settings →</a>
    <button onclick="this.parentElement.style.display='none'" style="background:none;border:none;cursor:pointer;font-size:1rem;color:inherit;opacity:.7;margin-left:8px">✕</button>
  </div>
  <header class="topnav">
    <div class="topnav-left">
      <span class="breadcrumb">
        <a href="/dashboard/copywriters?locationId=${safeId}" style="color:var(--sub);text-decoration:none">Copywriters</a>
        <span class="breadcrumb-sep"> / </span>
        <span class="breadcrumb-current">${t.title}</span>
      </span>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <button class="new-chat-btn" onclick="newChat()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
        New Chat
      </button>
    </div>
  </header>

  <div class="chat-wrap">
    <div class="chat-messages" id="messages"></div>
    <div class="chat-input-wrap">
      <div class="chat-input-row">
        <textarea class="chat-input" id="input" placeholder="Type your message…" rows="1"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}"
          oninput="autoResize(this)"></textarea>
        <button class="send-btn" id="sendBtn" onclick="send()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Save to Library modal -->
<div class="modal-overlay" id="saveModal" onclick="if(event.target===this)closeSaveModal()">
  <div class="modal">
    <div class="modal-title">Save to Library</div>
    <div class="modal-sub">Choose a customer folder and give this copy a title.</div>
    <div class="modal-field">
      <label class="modal-label">Customer</label>
      <select class="modal-input" id="modalCustomer">
        <option value="">— Select customer —</option>
      </select>
      <button class="modal-new-cust" onclick="toggleNewCust()">+ New customer</button>
      <div class="new-cust-fields" id="newCustFields">
        <input type="text" class="modal-input" id="newCustName" placeholder="Customer name *"/>
        <input type="email" class="modal-input" id="newCustEmail" placeholder="Email (optional)"/>
      </div>
    </div>
    <div class="modal-field">
      <label class="modal-label">Title</label>
      <input type="text" class="modal-input" id="modalTitle" placeholder="e.g. Welcome Email Sequence"/>
    </div>
    <div class="modal-err" id="modalErr"></div>
    <div class="modal-actions">
      <button class="modal-btn modal-btn-primary" onclick="doSave()">Save to Library</button>
      <button class="modal-btn modal-btn-cancel" onclick="closeSaveModal()">Cancel</button>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
const TYPE        = '${slug}';
const TITLE       = '${t.title}';
const COLOR       = '${t.color}';
const ICON        = \`${t.icon}\`;
const LOCATION_ID = '${safeId}';
let messages  = [];
let streaming = false;

// ── AI key helpers ────────────────────────────────────────────────────────────
function loadAIConfig() {
  try {
    const raw = localStorage.getItem('ghl_ai_config');
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (Date.now() > c.expiresAt) return { ...c, expired: true };
    return c;
  } catch { return null; }
}

(function checkAIBanner() {
  try {
    const c = loadAIConfig();
    if (!c) return;
    const days = Math.ceil((c.expiresAt - Date.now()) / 86400000);
    if (days > 3) return;
    const banner = document.getElementById('ai-key-banner');
    const msg    = document.getElementById('ai-banner-msg');
    const pName  = c.provider ? c.provider.charAt(0).toUpperCase() + c.provider.slice(1) : 'AI';
    if (days <= 0) {
      banner.style.background = '#FEE2E2'; banner.style.borderBottomColor = '#EF4444'; banner.style.color = '#991B1B';
      msg.textContent = pName + ' API key has expired — copy generation is paused.';
    } else {
      banner.style.background = '#FEF3C7'; banner.style.borderBottomColor = '#F59E0B'; banner.style.color = '#92400E';
      msg.textContent = pName + ' API key expires in ' + days + ' day' + (days !== 1 ? 's' : '') + '. Update before it stops working.';
    }
    banner.style.display = 'flex';
  } catch(e) {}
})();

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

function scrollBottom() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

function addMessage(role, text, isStreaming = false) {
  const wrap = document.getElementById('messages');
  const div  = document.createElement('div');
  div.className = 'msg ' + role;

  const avatar = document.createElement('div');
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
  const wrap = document.createElement('div');
  wrap.innerHTML = \`<br><button class="copy-btn" onclick="copyText(this)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
    Copy to clipboard
  </button><button class="save-lib-btn" onclick="openSaveModal()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
    Save to Library
  </button>\`;
  bubble.appendChild(wrap);
}

// ── Save to Library ──────────────────────────────────────────────────────────

async function openSaveModal() {
  document.getElementById('saveModal').classList.add('open');
  document.getElementById('modalErr').style.display = 'none';
  document.getElementById('newCustFields').classList.remove('open');

  // Auto-suggest title from first user message (after the seed)
  const titleEl = document.getElementById('modalTitle');
  if (!titleEl.value) {
    const userMsgs = messages.filter(m => m.role === 'user');
    const hint = userMsgs.length > 1
      ? userMsgs[userMsgs.length - 1].content.slice(0, 50)
      : userMsgs[0]?.content.slice(0, 50) || '';
    titleEl.value = TITLE + (hint ? ' — ' + hint : '');
  }

  await loadCustomers();
  document.getElementById('modalTitle').select();
}

function closeSaveModal() {
  document.getElementById('saveModal').classList.remove('open');
}

function toggleNewCust() {
  document.getElementById('newCustFields').classList.toggle('open');
  if (document.getElementById('newCustFields').classList.contains('open')) {
    document.getElementById('newCustName').focus();
  }
}

async function loadCustomers() {
  const sel = document.getElementById('modalCustomer');
  sel.innerHTML = '<option value="">— Select customer —</option>';
  try {
    const r = await fetch('/api/customers?locationId=' + LOCATION_ID);
    if (!r.ok) return;
    const customers = await r.json();
    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name + (c.email ? ' (' + c.email + ')' : '');
      sel.appendChild(opt);
    });
  } catch {}
}

async function doSave() {
  const errEl    = document.getElementById('modalErr');
  const title    = document.getElementById('modalTitle').value.trim();
  const newName  = document.getElementById('newCustName').value.trim();
  const newEmail = document.getElementById('newCustEmail').value.trim();
  const isNew    = document.getElementById('newCustFields').classList.contains('open');
  let   custSel  = document.getElementById('modalCustomer').value;
  let   custName = '';

  errEl.style.display = 'none';
  if (!title) { errEl.textContent = 'Title is required.'; errEl.style.display = 'block'; return; }

  if (isNew) {
    if (!newName) { errEl.textContent = 'Customer name is required.'; errEl.style.display = 'block'; return; }
    try {
      const r = await fetch('/api/customers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ locationId: LOCATION_ID, name: newName, email: newEmail }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to create customer');
      const cust = await r.json();
      custSel  = cust.id;
      custName = cust.name;
    } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; return; }
  } else {
    const opt = document.getElementById('modalCustomer').selectedOptions[0];
    custName = opt && opt.value ? opt.text.replace(/ \\(.*\\)$/, '') : '';
  }

  // No customer selected → save as unsorted (accessible via Library > Unsorted)
  if (!custSel) { custSel = '_unsorted'; custName = 'Unsorted'; }

  const lastAi = [...messages].reverse().find(m => m.role === 'assistant');
  const preview = (lastAi?.content || '').slice(0, 120);

  try {
    const r = await fetch('/api/copies', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        locationId:   LOCATION_ID,
        customerId:   custSel,
        customerName: custName,
        type:         TYPE,
        messages:     messages,
        title:        title,
        preview:      preview,
      }),
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Save failed');
    const copy = await r.json();
    closeSaveModal();
    document.getElementById('modalTitle').value = '';
    showToast('Saved to Library', '/dashboard/library/' + copy.customerId + '/' + copy.id + '?locationId=' + LOCATION_ID);
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
}

function showToast(msg, link) {
  const el = document.getElementById('toast');
  el.innerHTML = msg + (link ? \` · <a href="\${link}" style="color:#93C5FD;font-weight:600">View →</a>\` : '');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function copyText(btn) {
  const bubble = btn.closest('.msg-bubble');
  const text = bubble.innerText.replace('Copy to clipboard','').trim();
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.innerHTML = \`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy to clipboard\`; }, 2000);
  });
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

  // Show animated typing dots while waiting for the first token
  const { msgEl: typingMsg } = addTypingMessage();
  let realBubble = null;
  let full = '';

  try {
    const res = await fetch('/copywrite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        type:     TYPE,
        messages,
        provider: aiCfg.provider,
        apiKey:   aiCfg.apiKey,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Connection failed' }));
      typingMsg.remove();
      const b = addMessage('ai', '');
      b.textContent = err.error || 'Something went wrong';
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
          if (parsed.error) {
            typingMsg.remove();
            const b = addMessage('ai', '');
            b.textContent = parsed.error;
            return;
          }
          const text = parsed.text || '';
          if (text) {
            if (!realBubble) {
              // First token received — swap typing dots for the real streaming bubble
              typingMsg.remove();
              realBubble = addMessage('ai', '', true);
            }
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
    } else {
      typingMsg.remove();
    }

  } finally {
    streaming = false;
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('input').focus();
  }
}

function newChat() {
  messages = [];
  document.getElementById('messages').innerHTML = '';
  startConversation();
}

async function startConversation() {
  // Seed with a user message that kicks off the interview
  messages = [{ role: 'user', content: 'Hi, I need help creating ' + TITLE.toLowerCase() + ' copy.' }];
  await callAI();
}

// Kick off on load
startConversation();

document.addEventListener('click', (e) => {
  if (!e.target.closest('.sb-user-wrap')) {
    document.querySelectorAll('.user-menu.open').forEach(m => m.classList.remove('open'));
  }
});
</script>
</body>
</html>`);
});

module.exports = router;
