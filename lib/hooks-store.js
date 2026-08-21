const crypto   = require('crypto');
const isVercel = !!process.env.VERCEL;

let redis = null;
if (isVercel) {
  redis = require('./redis');
}

const mem        = {};   // locationId → hooks[]
const memTokens  = {};   // token → { locationId, hookId }

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── Token index helpers ───────────────────────────────────────────────────────

async function writeTokenIndex(token, locationId, hookId) {
  if (redis) {
    await redis.set(`hook_token:${token}`, { locationId, hookId });
  } else {
    memTokens[token] = { locationId, hookId };
  }
}

async function deleteTokenIndex(token) {
  if (redis) {
    await redis.del(`hook_token:${token}`);
  } else {
    delete memTokens[token];
  }
}

// ── Core store ────────────────────────────────────────────────────────────────

async function getAll(locationId) {
  if (redis) {
    const data = await redis.get(`hooks:${locationId}`);
    return Array.isArray(data) ? data : [];
  }
  return mem[locationId] ? [...mem[locationId]] : [];
}

async function saveAll(locationId, hooks) {
  if (redis) {
    await redis.set(`hooks:${locationId}`, hooks);
    return;
  }
  mem[locationId] = hooks;
}

async function create(locationId, { name, destinationUrl, customerId, customerName, ownerUserId }) {
  const hooks = await getAll(locationId);
  const token = genToken();
  const hook = {
    id:             genId(),
    ownerUserId:    ownerUserId || '',
    incomingToken:  token,
    name:           name || 'Unnamed Hook',
    destinationUrl: destinationUrl || '',
    customerId:     customerId  || '',
    customerName:   customerName || '',
    active:         true,
    lastTriggered:  null,
    lastIncoming:   null,   // last received payload
    incomingCount:  0,      // total received
    createdAt:      Date.now(),
  };
  hooks.push(hook);
  await saveAll(locationId, hooks);
  await writeTokenIndex(token, locationId, hook.id);
  return hook;
}

async function update(locationId, hookId, fields) {
  const hooks = await getAll(locationId);
  const idx = hooks.findIndex(h => h.id === hookId);
  if (idx === -1) return null;
  const allowed = ['name', 'destinationUrl', 'customerId', 'customerName',
                   'active', 'lastTriggered', 'lastIncoming', 'incomingCount',
                   'fieldMap', 'autoCreate'];
  for (const k of allowed) {
    if (fields[k] !== undefined) hooks[idx][k] = fields[k];
  }
  await saveAll(locationId, hooks);
  return hooks[idx];
}

async function remove(locationId, hookId) {
  const hooks = await getAll(locationId);
  const hook  = hooks.find(h => h.id === hookId);
  if (hook?.incomingToken) await deleteTokenIndex(hook.incomingToken);
  await saveAll(locationId, hooks.filter(h => h.id !== hookId));
}

// Propagate a customer rename onto every hook that references them.
async function renameCustomer(locationId, customerId, customerName) {
  const hooks = await getAll(locationId);
  let changed = false;
  for (const h of hooks) {
    if (h.customerId === customerId && h.customerName !== customerName) { h.customerName = customerName; changed = true; }
  }
  if (changed) await saveAll(locationId, hooks);
  return changed;
}

// One-time migration: assign all unowned (legacy) hooks to a user.
async function claimLegacy(locationId, userId) {
  if (!userId) return 0;
  const hooks = await getAll(locationId);
  let count = 0;
  for (const h of hooks) if (!h.ownerUserId) { h.ownerUserId = userId; count++; }
  if (count) await saveAll(locationId, hooks);
  return count;
}

// Detach a deleted customer from hooks (keep the hook, clear the link).
async function detachCustomer(locationId, customerId) {
  const hooks = await getAll(locationId);
  let changed = false;
  for (const h of hooks) {
    if (h.customerId === customerId) { h.customerId = ''; h.customerName = ''; changed = true; }
  }
  if (changed) await saveAll(locationId, hooks);
  return changed;
}

// Find active hooks for a given customerId (outbound firing)
async function findByCustomer(locationId, customerId) {
  const hooks = await getAll(locationId);
  return hooks.filter(h => h.active && h.customerId === customerId && h.destinationUrl);
}

// Find hook by inbound token (no locationId required)
async function findByToken(token) {
  if (redis) {
    const idx = await redis.get(`hook_token:${token}`);
    if (!idx) return null;
    const hooks = await getAll(idx.locationId);
    const hook  = hooks.find(h => h.id === idx.hookId);
    return hook ? { hook, locationId: idx.locationId } : null;
  }
  const idx = memTokens[token];
  if (!idx) return null;
  const hooks = mem[idx.locationId] || [];
  const hook  = hooks.find(h => h.id === idx.hookId);
  return hook ? { hook, locationId: idx.locationId } : null;
}

// Record an incoming payload on the hook
async function recordIncoming(locationId, hookId, payload) {
  return update(locationId, hookId, {
    lastIncoming:  { payload, receivedAt: Date.now() },
    incomingCount: undefined, // handled below
  }).then(async () => {
    const hooks = await getAll(locationId);
    const hook  = hooks.find(h => h.id === hookId);
    if (!hook) return null;
    hook.incomingCount = (hook.incomingCount || 0) + 1;
    await saveAll(locationId, hooks);
    return hook;
  });
}

module.exports = { getAll, saveAll, writeTokenIndex, create, update, remove, renameCustomer, detachCustomer, claimLegacy, findByCustomer, findByToken, recordIncoming };
