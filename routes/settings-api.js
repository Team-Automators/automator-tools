const express    = require('express');
const router     = express.Router();
const aiConfig   = require('../lib/ai-config-store');
const copyStore  = require('../lib/copy-store');
const tasksStore = require('../lib/tasks-store');
const hooksStore = require('../lib/hooks-store');
const pipelineStore = require('../lib/pipeline-store');
const userAiKey     = require('../lib/user-ai-key-store');

// POST /api/settings/claim-legacy — one-time migration: assign all currently
// unowned (pre-per-user) copies, tasks, and hooks on this location to the
// signed-in user. Idempotent (only touches items with no owner).
router.post('/claim-legacy', async (req, res) => {
  const locationId = req.locationId;
  const userId     = req.userId;
  if (!userId) return res.status(400).json({ error: 'No user identity — sign in with your email first.' });
  const [copies, tasks, hooks, customers, pipeline] = await Promise.all([
    copyStore.claimLegacy(locationId, userId).catch(() => 0),
    tasksStore.claimLegacy(locationId, userId).catch(() => 0),
    hooksStore.claimLegacy(locationId, userId).catch(() => 0),
    copyStore.claimLegacyCustomers(locationId, userId).catch(() => 0),
    pipelineStore.claimLegacy(locationId, userId).catch(() => 0),
  ]);
  res.json({ ok: true, claimed: { copies, tasks, hooks, customers, pipeline } });
});

// GET /api/settings/ai-key — the signed-in user's saved AI provider config
// (account-level, by email). Repopulates the browser after logout / on a new
// device so the key never has to be re-entered.
router.get('/ai-key', async (req, res) => {
  try {
    const rec = await userAiKey.get(req.userEmail);
    res.json({ config: rec && rec.apiKey ? { provider: rec.provider, apiKey: rec.apiKey, model: rec.model } : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/settings/ai-key — save the user's AI config to their account.
router.put('/ai-key', async (req, res) => {
  if (!req.userEmail) return res.status(400).json({ error: 'No user identity' });
  const { provider, apiKey, model } = req.body || {};
  try {
    await userAiKey.set(req.userEmail, { provider, apiKey, model });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/settings/ai-key — forget the account-level key.
router.delete('/ai-key', async (req, res) => {
  try { await userAiKey.del(req.userEmail); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.json({ locationName: '', locationLogo: '', hasClickupKey: false });
  const cfg = await aiConfig.get(locationId).catch(() => null);
  res.json({
    locationName:   cfg?.businessName    || '',
    locationLogo:   '',
    hasClickupKey:  !!(cfg?.clickupApiKey),
  });
});

router.post('/', async (req, res) => {
  const { locationId, businessName, clickupApiKey, removeClickupKey } = req.body;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });

  const existing = await aiConfig.get(locationId).catch(() => null) || {};
  const patch = { ...existing };

  if (businessName  !== undefined) patch.businessName  = (businessName || '').trim();
  if (clickupApiKey !== undefined) patch.clickupApiKey = clickupApiKey.trim();
  if (removeClickupKey)            patch.clickupApiKey = '';

  await aiConfig.set(locationId, patch);
  res.json({
    ok:           true,
    locationName: patch.businessName,
    hasClickupKey: !!(patch.clickupApiKey),
  });
});

module.exports = router;
