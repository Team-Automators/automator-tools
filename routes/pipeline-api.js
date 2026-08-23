const express = require('express');
const router  = express.Router();
const store   = require('../lib/pipeline-store');

// An engagement the caller owns (or legacy with no owner). Null otherwise.
async function owned(locationId, id, req) {
  const e = (await store.getAll(locationId)).find(x => x.id === id);
  if (!e) return null;
  if (e.ownerUserId && req.userId && e.ownerUserId !== req.userId) return null;
  return e;
}

// GET /api/pipeline — the caller's engagements (+ legacy no-owner)
router.get('/', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.json([]);
  try {
    const all = await store.getAll(locationId);
    res.json(all.filter(e => !e.ownerUserId || e.ownerUserId === req.userId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/pipeline — add a client engagement to a service column
router.post('/', async (req, res) => {
  const { locationId, clientName, service } = req.body;
  if (!locationId || !clientName || !service) {
    return res.status(400).json({ error: 'locationId, clientName, service required' });
  }
  try {
    res.json(await store.create(locationId, { ...req.body, ownerUserId: req.userId || '' }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const { locationId } = req.body;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    if (!(await owned(locationId, req.params.id, req))) return res.status(404).json({ error: 'Not found' });
    const eng = await store.update(locationId, req.params.id, req.body);
    res.json(eng);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    if (!(await owned(locationId, req.params.id, req))) return res.status(404).json({ error: 'Not found' });
    await store.remove(locationId, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/pipeline/import — replace the caller's engagements with a backup
router.post('/import', async (req, res) => {
  const { locationId, items } = req.body;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
  try {
    const count = await store.replaceForUser(locationId, req.userId || '', items);
    res.json({ ok: true, imported: count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
