const express    = require('express');
const router     = express.Router();
const store      = require('../lib/hooks-store');
const tasksStore = require('../lib/tasks-store');

function getPath(obj, dotPath) {
  return dotPath.split('.').reduce((cur, k) => cur?.[k], obj);
}

function applyMap(payload, fieldMap) {
  const out = {};
  for (const [target, sourcePath] of Object.entries(fieldMap || {})) {
    if (!sourcePath) continue;
    const val = getPath(payload, sourcePath);
    if (val !== undefined && val !== null) out[target] = String(val);
  }
  return out;
}

// POST /api/incoming/:token
router.post('/:token', async (req, res) => {
  const { token } = req.params;

  if (!/^[0-9a-f]{64}$/.test(token)) {
    return res.status(404).json({ error: 'Invalid webhook URL' });
  }

  const found = await store.findByToken(token).catch(() => null);
  if (!found) return res.status(404).json({ error: 'Webhook not found' });

  const { hook, locationId } = found;
  if (!hook.active) return res.status(403).json({ error: 'This webhook is paused' });

  const body = req.body;

  // Record the raw payload
  await store.recordIncoming(locationId, hook.id, body).catch(() => null);

  // Auto-create task if mapping is configured
  let createdTask = null;
  if (hook.autoCreate && hook.fieldMap) {
    const mapped = applyMap(body, hook.fieldMap);
    const title = mapped.task_title;
    if (title) {
      const stage = mapped.task_stage || 'urgent';
      const customerName = hook.customerName || mapped.customer_name || '';
      const customerId   = hook.customerId   || '';
      const task = await tasksStore.create(locationId, {
        title, stage, customerId, customerName,
      }).catch(() => null);
      if (task && mapped.task_note) {
        await tasksStore.addNote(locationId, task.id, mapped.task_note).catch(() => null);
      }
      createdTask = task;
    }
  }

  res.json({
    ok:      true,
    hook_id: hook.id,
    message: createdTask ? 'Payload received — task created' : 'Payload received',
    task_id: createdTask?.id || null,
  });
});

// GET /api/incoming/:token — verify URL is valid
router.get('/:token', async (req, res) => {
  const { token } = req.params;
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return res.status(404).json({ error: 'Invalid webhook URL' });
  }
  const found = await store.findByToken(token).catch(() => null);
  if (!found) return res.status(404).json({ error: 'Webhook not found' });
  res.json({ ok: true, hook: found.hook.name, active: found.hook.active });
});

module.exports = router;
