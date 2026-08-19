const redis  = require('./redis');
const crypto = require('crypto');

const IDX = (loc) => `wf:drafts:idx:${loc}`;
const KEY = (id)  => `wf:draft:${id}`;
const TTL = 60 * 60 * 24 * 90; // 90 days

async function saveDraft(locationId, { name, brief, steps, emailCount, smsCount }) {
  const id  = crypto.randomUUID();
  const now = Date.now();
  const doc = {
    id, locationId, name, brief, steps,
    emailCount: Number(emailCount) || 0,
    smsCount:   Number(smsCount)   || 0,
    ghlWorkflowId: null,
    publishedAt:   null,
    createdAt: now,
    updatedAt: now,
  };
  await redis.set(KEY(id), JSON.stringify(doc), { ex: TTL });
  await _addToIndex(locationId, doc, now);
  return doc;
}

async function getDrafts(locationId) {
  const raw = await redis.get(IDX(locationId));
  return raw ? JSON.parse(raw) : [];
}

async function getDraft(id) {
  const raw = await redis.get(KEY(id));
  return raw ? JSON.parse(raw) : null;
}

async function updateDraft(id, locationId, updates) {
  const raw = await redis.get(KEY(id));
  if (!raw) return null;
  const doc = JSON.parse(raw);
  if (doc.locationId !== locationId) return null;

  const ALLOWED = ['name', 'brief', 'steps', 'emailCount', 'smsCount', 'ghlWorkflowId', 'publishedAt'];
  const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => ALLOWED.includes(k)));
  const updated = { ...doc, ...safe, updatedAt: Date.now() };
  await redis.set(KEY(id), JSON.stringify(updated), { ex: TTL });

  // Patch index row
  const idxRaw = await redis.get(IDX(locationId));
  if (idxRaw) {
    const idx = JSON.parse(idxRaw);
    const i   = idx.findIndex(x => x.id === id);
    if (i >= 0) {
      idx[i] = _summaryRow(updated);
      await redis.set(IDX(locationId), JSON.stringify(idx), { ex: TTL });
    }
  }
  return updated;
}

async function deleteDraft(id, locationId) {
  const raw = await redis.get(KEY(id));
  if (!raw) return false;
  const doc = JSON.parse(raw);
  if (doc.locationId !== locationId) return false;
  await redis.del(KEY(id));
  const idxRaw = await redis.get(IDX(locationId));
  if (idxRaw) {
    const idx = JSON.parse(idxRaw).filter(x => x.id !== id);
    await redis.set(IDX(locationId), JSON.stringify(idx), { ex: TTL });
  }
  return true;
}

// ── helpers ────────────────────────────────────────────────────────────────

function _summaryRow(doc) {
  return {
    id:            doc.id,
    name:          doc.name,
    emailCount:    doc.emailCount,
    smsCount:      doc.smsCount,
    ghlWorkflowId: doc.ghlWorkflowId,
    publishedAt:   doc.publishedAt,
    createdAt:     doc.createdAt,
    updatedAt:     doc.updatedAt,
  };
}

async function _addToIndex(locationId, doc, now) {
  const idxRaw = await redis.get(IDX(locationId));
  const idx    = idxRaw ? JSON.parse(idxRaw) : [];
  idx.unshift(_summaryRow(doc));
  await redis.set(IDX(locationId), JSON.stringify(idx), { ex: TTL });
}

module.exports = { saveDraft, getDrafts, getDraft, updateDraft, deleteDraft };
