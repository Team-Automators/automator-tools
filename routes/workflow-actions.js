const express = require('express');
const router  = express.Router();
const ACTIONS = require('../config/actions');
const store   = require('../lib/token-store');

function requireAuth(req, res, next) {
  if (!req.session.accessToken) return res.redirect('/');
  next();
}

// Main workflow actions management page
router.get('/', requireAuth, (req, res) => {
  const appUrl     = `${req.protocol}://${req.get('host')}`;
  const webhookUrl = `${appUrl}/webhooks/workflow`;
  const installs   = store.getAll();

  res.render('workflow-actions', {
    actions:     ACTIONS,
    webhookUrl,
    installs,
    installCount: Object.keys(installs).length,
  });
});

// Return actions catalog as JSON (useful for GHL marketplace configuration)
router.get('/catalog.json', (req, res) => {
  res.json(ACTIONS.map(a => ({
    key:         a.key,
    name:        a.name,
    description: a.description,
    fields:      a.fields,
    outputs:     a.outputs,
  })));
});

// Return a single action spec
router.get('/catalog/:key', (req, res) => {
  const action = ACTIONS.find(a => a.key === req.params.key);
  if (!action) return res.status(404).json({ error: 'Action not found' });
  res.json(action);
});

module.exports = router;
