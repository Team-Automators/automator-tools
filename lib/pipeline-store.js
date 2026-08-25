// Client Pipeline Tracker — per-location store of "engagements".
// Each engagement = one client + one service (a card in a service column).
// Per-user scoping is applied at the route level via ownerUserId.

const isVercel = !!process.env.VERCEL;
let redis = null;
if (isVercel) redis = require('./redis');

const mem = {};
const KEY = (loc) => `pipeline:${loc}`;

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

async function getAll(locationId) {
  if (redis) {
    const data = await redis.get(KEY(locationId));
    return Array.isArray(data) ? data : [];
  }
  return mem[locationId] ? [...mem[locationId]] : [];
}

async function saveAll(locationId, items) {
  if (redis) await redis.set(KEY(locationId), items);
  else mem[locationId] = items;
}

async function create(locationId, fields) {
  const items = await getAll(locationId);
  const now = Date.now();
  const eng = {
    id:          genId(),
    ownerUserId: fields.ownerUserId || '',
    clientName:  (fields.clientName || 'Unnamed Client').trim(),
    service:     fields.service || '',
    assignedDate: fields.assignedDate || new Date(now).toISOString().slice(0, 10),
    dueDate:     fields.dueDate || '',
    waitingOn:   fields.waitingOn || '',        // 'client' | 'consultant' | ''
    status:      'active',                        // 'active' | 'completed'
    notes:       fields.notes || '',
    createdAt:   now,
    finishedAt:  null,
  };
  items.push(eng);
  await saveAll(locationId, items);
  return eng;
}

const EDITABLE = ['clientName', 'service', 'assignedDate', 'dueDate', 'waitingOn', 'status', 'notes'];

async function update(locationId, id, fields) {
  const items = await getAll(locationId);
  const i = items.findIndex(e => e.id === id);
  if (i === -1) return null;
  for (const k of EDITABLE) if (fields[k] !== undefined) items[i][k] = fields[k];
  if (fields.status === 'completed' && !items[i].finishedAt) items[i].finishedAt = Date.now();
  if (fields.status === 'active') items[i].finishedAt = null;
  await saveAll(locationId, items);
  return items[i];
}

async function remove(locationId, id) {
  const items = (await getAll(locationId)).filter(e => e.id !== id);
  await saveAll(locationId, items);
}

// Replace a single user's engagements (used by Import Backup); other users kept.
async function replaceForUser(locationId, userId, incoming) {
  const others = (await getAll(locationId)).filter(e => (e.ownerUserId || '') !== (userId || ''));
  const mine = (Array.isArray(incoming) ? incoming : []).map(e => ({
    ...e,
    id: e.id || genId(),
    ownerUserId: userId || '',
    status: e.status === 'completed' ? 'completed' : 'active',
  }));
  const merged = [...others, ...mine];
  await saveAll(locationId, merged);
  return mine.length;
}

// Merge engagements from a backup (upsert by id; never deletes).
async function importData(locationId, userId, items = []) {
  const cur = await getAll(locationId);
  const byId = new Map(cur.map(e => [e.id, e]));
  for (const raw of items) {
    if (!raw?.id) continue;
    const e = { ...raw, ownerUserId: raw.ownerUserId || userId || '' };
    if (byId.has(e.id)) Object.assign(byId.get(e.id), e);
    else { cur.push(e); byId.set(e.id, e); }
  }
  await saveAll(locationId, cur);
  return items.length;
}

// One-time migration: assign all unowned (legacy) engagements to a user.
async function claimLegacy(locationId, userId) {
  if (!userId) return 0;
  const items = await getAll(locationId);
  let count = 0;
  for (const e of items) if (!e.ownerUserId) { e.ownerUserId = userId; count++; }
  if (count) await saveAll(locationId, items);
  return count;
}

module.exports = { genId, getAll, saveAll, create, update, remove, replaceForUser, importData, claimLegacy };
