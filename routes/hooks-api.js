const express = require('express');
const axios   = require('axios');
const router  = express.Router();
const store   = require('../lib/hooks-store');

// A hook the caller owns (or a legacy hook with no owner). Null otherwise.
async function ownedHook(locationId, hookId, req) {
  const h = (await store.getAll(locationId)).find(x => x.id === hookId);
  if (!h) return null;
  if ((h.ownerUserId || '') !== (req.userId || '')) return null;
  return h;
}

router.get('/', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.json([]);
  try {
    const hooks = await store.getAll(locationId);
    // Migrate old hooks that were created before incomingToken was added
    let dirty = false;
    for (const hook of hooks) {
      if (!hook.incomingToken) {
        hook.incomingToken = require('crypto').randomBytes(32).toString('hex');
        dirty = true;
        await store.writeTokenIndex(hook.incomingToken, locationId, hook.id);
      }
    }
    if (dirty) await store.saveAll(locationId, hooks);
    res.json(hooks.filter(h => (h.ownerUserId || '') === (req.userId || '')));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const { locationId, name, destinationUrl, customerId, customerName } = req.body;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    res.json(await store.create(locationId, { name, destinationUrl, customerId, customerName, ownerUserId: req.userId || '' }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const { locationId, ...fields } = req.body;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    if (!(await ownedHook(locationId, req.params.id, req))) return res.status(404).json({ error: 'Hook not found' });
    const hook = await store.update(locationId, req.params.id, fields);
    if (!hook) return res.status(404).json({ error: 'Hook not found' });
    res.json(hook);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    if (!(await ownedHook(locationId, req.params.id, req))) return res.status(404).json({ error: 'Hook not found' });
    await store.remove(locationId, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Test-fire a hook with a sample payload
router.post('/:id/test', async (req, res) => {
  const { locationId } = req.body;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    const hook = await ownedHook(locationId, req.params.id, req);
    if (!hook) return res.status(404).json({ error: 'Hook not found' });
    if (!hook.destinationUrl) return res.status(400).json({ error: 'No destination URL configured' });

    const payload = buildPayload(hook, {
      id:        'test_task',
      title:     'Sample Task',
      stage:     'in-progress',
      notes:     'This is a test push from Automator.',
      updatedAt: Date.now(),
    }, locationId);

    await axios.post(hook.destinationUrl, payload, {
      headers: { 'Content-Type': 'application/json', 'X-Automator-Hook': hook.id },
      timeout: 8000,
    });

    await store.update(locationId, hook.id, { lastTriggered: Date.now() });
    res.json({ ok: true, payload });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

function buildPayload(hook, task, locationId) {
  return {
    event:       'kanban_update',
    location_id: locationId,
    hook_id:     hook.id,
    customer: {
      id:   hook.customerId,
      name: hook.customerName,
    },
    task: {
      id:         task.id,
      title:      task.title,
      stage:      task.stage,
      notes:      task.notes || '',
      updated_at: new Date(task.updatedAt || Date.now()).toISOString(),
    },
    timestamp: new Date().toISOString(),
  };
}

module.exports = router;
module.exports.buildPayload = buildPayload;
