const express  = require('express');
const router   = express.Router();
const aiConfig = require('../lib/ai-config-store');

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
