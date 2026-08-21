const express    = require('express');
const axios      = require('axios');
const router     = express.Router();
const store      = require('../lib/tasks-store');
const hooksStore = require('../lib/hooks-store');
const aiConfig   = require('../lib/ai-config-store');

const CU_BASE = 'https://api.clickup.com/api/v2';
const STAGE_LABELS = { urgent: 'Urgent', 'in-progress': 'In Progress', blocked: 'Blocked', 'for-later': 'For Later', done: 'Done' };
function stageLabel(id) { return STAGE_LABELS[id] || id; }

// A task the caller owns (or a legacy/system task with no owner). Null otherwise.
async function ownedTask(locationId, taskId, req) {
  const t = (await store.getAll(locationId)).find(x => x.id === taskId);
  if (!t) return null;
  if (t.ownerUserId && req.userId && t.ownerUserId !== req.userId) return null;
  return t;
}

router.get('/', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.json([]);
  try {
    const all = await store.getAll(locationId);
    res.json(all.filter(t => !t.ownerUserId || t.ownerUserId === req.userId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const { locationId, title, customerId, customerName, stage } = req.body;
  if (!locationId || !title) return res.status(400).json({ error: 'locationId and title required' });
  try {
    res.json(await store.create(locationId, { title, customerId, customerName, stage, ownerUserId: req.userId || '' }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const { locationId, ...fields } = req.body;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    if (!(await ownedTask(locationId, req.params.id, req))) return res.status(404).json({ error: 'Task not found' });
    const task = await store.update(locationId, req.params.id, fields);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
    if (task.customerId && fields.stage !== undefined) {
      fireHooks(locationId, task, null).catch(() => {});
    }
    // Stage moves alone don't post to ClickUp — only notes do (tagged with the
    // task's current stage, in the note-add handler below).
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Notes ─────────────────────────────────────────────────────────────────────

router.post('/:id/notes', async (req, res) => {
  const { locationId, text } = req.body;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
  try {
    if (!(await ownedTask(locationId, req.params.id, req))) return res.status(404).json({ error: 'Task not found' });
    const result = await store.addNote(locationId, req.params.id, text);
    if (!result) return res.status(404).json({ error: 'Task not found' });

    let finalTask = result.task;

    // Push to ClickUp synchronously so we can store the result on the note
    if (result.task.clickupTaskId) {
      const { stage, clickupTaskId } = result.task;
      const pushed = await pushToClickUp(locationId, clickupTaskId, `${stageLabel(stage)}: ${result.note.text}`)
        .then(() => true).catch(() => false);
      finalTask = await store.patchNote(locationId, result.task.id, result.note.id, { clickupPushed: pushed }) || finalTask;
    }

    res.json(finalTask);
    if (finalTask.customerId) {
      fireHooks(locationId, finalTask, result.note).catch(() => {});
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id/notes/:noteId', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    if (!(await ownedTask(locationId, req.params.id, req))) return res.status(404).json({ error: 'Task not found' });
    const task = await store.deleteNote(locationId, req.params.id, req.params.noteId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    if (!(await ownedTask(locationId, req.params.id, req))) return res.status(404).json({ error: 'Task not found' });
    await store.remove(locationId, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ClickUp comment push ──────────────────────────────────────────────────────

async function pushToClickUp(locationId, clickupTaskId, comment_text) {
  const cfg = await aiConfig.get(locationId).catch(() => null);
  const key = cfg?.clickupApiKey;
  if (!key) return;
  await axios.post(
    `${CU_BASE}/task/${clickupTaskId}/comment`,
    { comment_text, notify_all: false },
    { headers: { Authorization: key, 'Content-Type': 'application/json' }, timeout: 8000 }
  );
}

// ── Webhook delivery ──────────────────────────────────────────────────────────

async function fireHooks(locationId, task, note) {
  const hooks = await hooksStore.findByCustomer(locationId, task.customerId);
  for (const hook of hooks) {
    try {
      const payload = note
        ? buildNotePayload(hook, task, note, locationId)
        : buildStagePayload(hook, task, locationId);
      await axios.post(hook.destinationUrl, payload, {
        headers: { 'Content-Type': 'application/json', 'X-Automator-Hook': hook.id },
        timeout: 8000,
      });
      await hooksStore.update(locationId, hook.id, { lastTriggered: Date.now() });
    } catch {}
  }
}

function buildNotePayload(hook, task, note, locationId) {
  return {
    event:       'note_added',
    location_id: locationId,
    hook_id:     hook.id,
    customer: {
      id:   task.customerId,
      name: task.customerName,
    },
    task: {
      id:    task.id,
      title: task.title,
      stage: task.stage,
    },
    note: {
      id:         note.id,
      text:       note.text,
      created_at: new Date(note.createdAt).toISOString(),
    },
    timestamp: new Date().toISOString(),
  };
}

function buildStagePayload(hook, task, locationId) {
  return {
    event:       'stage_changed',
    location_id: locationId,
    hook_id:     hook.id,
    customer: {
      id:   task.customerId,
      name: task.customerName,
    },
    task: {
      id:         task.id,
      title:      task.title,
      stage:      task.stage,
      updated_at: new Date(task.updatedAt).toISOString(),
    },
    timestamp: new Date().toISOString(),
  };
}

module.exports = router;
module.exports.buildNotePayload  = buildNotePayload;
module.exports.buildStagePayload = buildStagePayload;
