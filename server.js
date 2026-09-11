require('dotenv').config();
const express = require('express');
const path    = require('path');

const actionRouter      = require('./routes/action');
const installRouter     = require('./routes/install');
const verifyRouter      = require('./routes/verify');
const testRouter        = require('./routes/test');
const contactsRouter    = require('./routes/contacts');
const usersRouter       = require('./routes/users');
const authRouter        = require('./routes/auth');
const copywriteApi       = require('./routes/copywrite-api');
const apiCopyRouter      = require('./routes/api-copy');
const dashboardApiRouter = require('./routes/dashboard-api');
const settingsApiRouter  = require('./routes/settings-api');
const tasksApiRouter     = require('./routes/tasks-api');
const hooksApiRouter     = require('./routes/hooks-api');
const incomingRouter     = require('./routes/incoming');
const clickupApiRouter   = require('./routes/clickup-api');
const ghlProbeRouter     = require('./routes/ghl-probe');
const workflowsRouter    = require('./routes/workflows-api');
const pipelineRouter     = require('./routes/pipeline-api');
const backupRouter       = require('./routes/backup-api');
const adminRouter        = require('./routes/admin-api');
const requireLocation    = require('./middleware/require-location');

const app  = express();
const PORT = process.env.PORT || 3000;

// Large payloads (base64 file uploads, full backups) are confined to the two
// routers that need them; everything else is capped small to limit the DoS surface.
app.use('/copywrite',  express.json({ limit: '25mb' }));
app.use('/api/backup', express.json({ limit: '25mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── API / webhook routes ───────────────────────────────────────────────────────
// ── Public / server-to-server routes (no user session) ──────────────────────────
//   /action      — called by GHL workflow actions (auth via installed PITs)
//   /install     — GHL External Auth + browser setup wizard
//   /verify,/test— PIT connectivity checks (auth via Bearer PIT)
//   /auth        — OAuth + location-login (issues the session)
//   /api/incoming— inbound webhooks (auth via per-hook token)
app.use('/action',   actionRouter);
app.use('/install',  installRouter);
app.use('/verify',   verifyRouter);
app.use('/test',     testRouter);
app.use('/contacts', contactsRouter);
app.use('/users',    usersRouter);
app.use('/auth',     authRouter);
app.use('/api/incoming',  incomingRouter);

// ── Tenant routes — require a valid location session (derives locationId itself) ──
app.use('/copywrite',     requireLocation, copywriteApi);
app.use('/api/dashboard', requireLocation, dashboardApiRouter);
app.use('/api/settings',  requireLocation, settingsApiRouter);
app.use('/api/tasks',     requireLocation, tasksApiRouter);
app.use('/api/hooks',     requireLocation, hooksApiRouter);
app.use('/api/clickup',   requireLocation, clickupApiRouter);
app.use('/api/ghl-probe', requireLocation, ghlProbeRouter);
app.use('/api/workflows', requireLocation, workflowsRouter);
app.use('/api/pipeline',  requireLocation, pipelineRouter);
app.use('/api/backup',    requireLocation, backupRouter);
app.use('/api/admin',     requireLocation, adminRouter);
app.use('/api',           requireLocation, apiCopyRouter);

// ── React SPA (serve built client) ────────────────────────────────────────────
// Every request (assets included) is routed through this serverless function —
// there's no CDN in front — so set caching explicitly. The build's /assets/ files
// are content-hashed and immutable → cache them for a year so repeat loads never
// re-fetch them. index.html and the service worker must stay fresh so new deploys
// propagate, so they're marked no-cache.
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist, {
  setHeaders(res, filePath) {
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/(?:index\.html|sw\.js)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// ── Server-side rendering ───────────────────────────────────────────────────────
// The SPA is rendered on the server for a fast first paint, then hydrated in the
// browser. Auth for the render comes from the verified ghl_session cookie (when
// present — the GHL iframe blocks it, and those requests render neutrally and let
// the client resolve auth from localStorage). Any render error falls back to
// plain client-side rendering, so SSR can never take the app down.
const fs = require('fs');
const { pathToFileURL } = require('url');
const { PassThrough } = require('stream');
const { verify: verifySession } = require('./lib/session');

const ssrEntry = path.join(__dirname, 'client', 'dist-ssr', 'entry-server.mjs');
let ssrModPromise;
function loadSSR() {
  if (ssrModPromise === undefined) {
    ssrModPromise = fs.existsSync(ssrEntry)
      ? import(pathToFileURL(ssrEntry).href).catch(e => { console.warn('[ssr] module load failed:', e.message); return null; })
      : Promise.resolve(null);
  }
  return ssrModPromise;
}

let htmlTemplate;
function template() {
  if (htmlTemplate === undefined) {
    try { htmlTemplate = fs.readFileSync(path.join(clientDist, 'index.html'), 'utf8'); }
    catch { htmlTemplate = ''; }
  }
  return htmlTemplate;
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

// Escape '<' so the injected state can't break out of the <script> tag.
const encodeState = (s) => JSON.stringify(s).replace(/</g, '\\u003c');

// Split the built HTML around the #root div so we can stream React's output
// between the head (with the injected auth state) and the closing tags.
const ROOT_MARKER = '<div id="root"></div>';
function splitTemplate(tmpl, ssr) {
  const i = tmpl.indexOf(ROOT_MARKER);
  if (i < 0) return null;
  const stateScript = ssr ? `<script>window.__SSR_STATE__=${encodeState(ssr)}</script>` : '';
  const head = tmpl.slice(0, i).replace('</head>', `${stateScript}</head>`) + '<div id="root">';
  const tail = '</div>' + tmpl.slice(i + ROOT_MARKER.length);
  return { head, tail };
}

// SPA catch-all — stream the server-rendered React app, hydrate on the client.
app.get('*', async (req, res) => {
  const tmpl = template();
  const mod = await loadSSR();
  const parts = tmpl ? splitTemplate(tmpl, null) : null;

  // No SSR build (or unexpected template) → plain client-side render.
  if (!mod || !mod.renderStream || !parts) {
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.join(clientDist, 'index.html'));
  }

  const token = readCookie(req, 'ghl_session');
  const claims = token ? verifySession(token) : null;
  const ssr = claims ? { token, claims, locationId: claims.lid || '' } : null;
  const { head, tail } = splitTemplate(tmpl, ssr);

  let responded = false;
  let shellErrored = false;
  const stream = mod.renderStream(req.originalUrl, ssr, {
    onShellReady() {
      responded = true;
      res.status(200);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.write(head);
      const pass = new PassThrough();
      pass.on('data', (c) => res.write(c));
      pass.on('end', () => { res.write(tail); res.end(); });
      stream.pipe(pass);
    },
    onShellError(err) {
      // Couldn't render the shell → fall back to client-side rendering.
      shellErrored = true;
      console.warn('[ssr] shell error, serving CSR:', err && err.message);
      if (!responded) {
        res.status(200);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(tmpl);
      }
    },
    onError(err) {
      // A non-shell (Suspense boundary) error — React recovers on the client;
      // just log it so streaming continues.
      if (!shellErrored) console.warn('[ssr] render error:', err && err.message);
    },
  });

  // Safety valve: never let a stuck render hold the connection open.
  setTimeout(() => { try { stream.abort(); } catch {} }, 10000);
});

// ── Error handler ──────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const message = err.response?.data?.message || err.message || 'Internal error';
  res.status(err.status || 500).json({ error: message });
});

// Local dev — listen directly. Vercel imports this file as a module instead.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`GHL Automator on http://localhost:${PORT}`);
  });
}

module.exports = app;
