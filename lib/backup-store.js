// Full account backup — export everything the current user owns into one JSON
// document, and restore it (merge / upsert, never destructive).
//
// Scope: per-user, mirroring what the app shows. Customers are shared
// (location-level); copies/tasks/pipeline/hooks are filtered to the user (or
// legacy no-owner); brand voice, feedback, and AI settings are the user's own.

const copyStore     = require('./copy-store');
const tasksStore    = require('./tasks-store');
const pipelineStore = require('./pipeline-store');
const hooksStore    = require('./hooks-store');
const voiceStore    = require('./brand-voice-store');
const aiConfig      = require('./ai-config-store');

const FORMAT  = 'automator-backup';
const VERSION = 1;

async function exportAll(locationId, userId, { includeSettings = true } = {}) {
  const [customers, allCopies, tasks, pipeline, hooks, brandVoice, feedback, settings] = await Promise.all([
    copyStore.getCustomers(locationId).catch(() => []),
    copyStore.getAllCopies(locationId).catch(() => []),
    tasksStore.getAll(locationId).catch(() => []),
    pipelineStore.getAll(locationId).catch(() => []),
    hooksStore.getAll(locationId).catch(() => []),
    voiceStore.getVoice(locationId, userId).catch(() => null),
    voiceStore.getFeedback(locationId, userId).catch(() => []),
    includeSettings ? aiConfig.get(locationId).catch(() => null) : Promise.resolve(null),
  ]);

  const mine = (arr) => (Array.isArray(arr) ? arr : []).filter(x => !x.ownerUserId || x.ownerUserId === userId);

  return {
    format:     FORMAT,
    version:    VERSION,
    exportedAt: Date.now(),
    locationId,
    userId,
    data: {
      customers,                    // shared (location-level)
      copies:     mine(allCopies),
      tasks:      mine(tasks),
      pipeline:   mine(pipeline),
      hooks:      mine(hooks),
      brandVoice: brandVoice || null,
      feedback:   feedback || [],
      settings:   settings || null, // contains API keys — keep the file private
    },
  };
}

async function importAll(locationId, userId, payload) {
  if (!payload || payload.format !== FORMAT) {
    throw new Error('Not an Automator backup file');
  }
  const d = payload.data || {};
  const result = {};

  if ((d.customers && d.customers.length) || (d.copies && d.copies.length)) {
    result.copies = await copyStore.importData(locationId, userId, { customers: d.customers || [], copies: d.copies || [] });
  }
  if (d.tasks)    result.tasks    = await tasksStore.importData(locationId, userId, d.tasks);
  if (d.pipeline) result.pipeline = await pipelineStore.importData(locationId, userId, d.pipeline);
  if (d.hooks)    result.hooks    = await hooksStore.importData(locationId, userId, d.hooks);
  if (d.brandVoice) await voiceStore.setVoice(locationId, userId, d.brandVoice);
  if (Array.isArray(d.feedback) && d.feedback.length) await voiceStore.setFeedback(locationId, userId, d.feedback);
  if (d.settings)  await aiConfig.set(locationId, d.settings);

  return {
    ok: true,
    counts: {
      customers: (d.customers || []).length,
      copies:    (d.copies || []).length,
      tasks:     (d.tasks || []).length,
      pipeline:  (d.pipeline || []).length,
      hooks:     (d.hooks || []).length,
      feedback:  (d.feedback || []).length,
      brandVoice: d.brandVoice ? 1 : 0,
      settings:  d.settings ? 1 : 0,
    },
    result,
  };
}

module.exports = { exportAll, importAll, FORMAT, VERSION };
