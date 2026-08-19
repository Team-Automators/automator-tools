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

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API / webhook routes ───────────────────────────────────────────────────────
app.use('/action',   actionRouter);
app.use('/install',  installRouter);
app.use('/verify',   verifyRouter);
app.use('/test',     testRouter);
app.use('/contacts', contactsRouter);
app.use('/users',    usersRouter);
app.use('/auth',     authRouter);
app.use('/copywrite', copywriteApi);
app.use('/api/dashboard', dashboardApiRouter);
app.use('/api/settings',  settingsApiRouter);
app.use('/api/tasks',     tasksApiRouter);
app.use('/api/hooks',     hooksApiRouter);
app.use('/api/incoming',  incomingRouter);
app.use('/api/clickup',   clickupApiRouter);
app.use('/api/ghl-probe', ghlProbeRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api',           apiCopyRouter);

// ── React SPA (serve built client) ────────────────────────────────────────────
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));

// SPA catch-all — any path not matched above serves the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
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
