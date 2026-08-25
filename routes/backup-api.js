const express = require('express');
const router  = express.Router();
const backup  = require('../lib/backup-store');

// GET /api/backup/export — download the current user's full account as JSON.
router.get('/export', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    const payload = await backup.exportAll(locationId, req.userId || '', {
      includeSettings: req.query.settings !== '0',
    });
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/backup/import — restore from a backup file (merge / upsert).
router.post('/import', async (req, res) => {
  const { locationId } = req.body;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  const payload = req.body.backup || req.body;
  try {
    const out = await backup.importAll(locationId, req.userId || '', payload);
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
