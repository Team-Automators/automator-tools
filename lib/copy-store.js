const isVercel = !!process.env.VERCEL;

let redis = null;
if (isVercel) {
  redis = require('./redis');
}

// In-memory fallback for local dev
const mem = {
  customers: {},
  copies:    {},
  indexes:   {},
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function getCustomers(locationId) {
  if (redis) {
    const data = await redis.get(`cust:${locationId}`);
    return Array.isArray(data) ? data : [];
  }
  return mem.customers[locationId] ? [...mem.customers[locationId]] : [];
}

async function createCustomer(locationId, { name, email = '' }) {
  const customers = await getCustomers(locationId);
  const customer  = { id: genId(), name, email, createdAt: Date.now() };
  customers.push(customer);
  if (redis) await redis.set(`cust:${locationId}`, customers);
  else mem.customers[locationId] = customers;
  return customer;
}

async function deleteCustomer(locationId, customerId) {
  const customers = (await getCustomers(locationId)).filter(c => c.id !== customerId);
  if (redis) await redis.set(`cust:${locationId}`, customers);
  else mem.customers[locationId] = customers;

  // Reassign this customer's copies to Unsorted so they aren't orphaned/hidden.
  const idx  = await getCopyIndex(locationId);
  const mine = idx.filter(r => r.customerId === customerId);
  if (mine.length) {
    for (const row of mine) { row.customerId = ''; row.customerName = ''; }
    if (redis) await redis.set(`copyidx:${locationId}`, idx);
    else mem.indexes[locationId] = idx;
    for (const row of mine) {
      const copy = await getCopy(row.id);
      if (copy) {
        copy.customerId = ''; copy.customerName = '';
        if (redis) await redis.set(`copy:${row.id}`, copy);
        else mem.copies[row.id] = copy;
      }
    }
  }
}

async function updateCustomer(locationId, customerId, { name, email } = {}) {
  const customers = await getCustomers(locationId);
  const cust = customers.find(c => c.id === customerId);
  if (!cust) return null;

  const newName = name !== undefined ? String(name).trim() : undefined;
  if (newName) cust.name = newName;
  if (email !== undefined) cust.email = String(email).trim();

  if (redis) await redis.set(`cust:${locationId}`, customers);
  else mem.customers[locationId] = customers;

  // Propagate the renamed folder to this customer's copies (index rows + records)
  // so every view stays consistent.
  if (newName) {
    const idx = await getCopyIndex(locationId);
    const mine = idx.filter(r => r.customerId === customerId);
    let changed = false;
    for (const row of mine) { if (row.customerName !== newName) { row.customerName = newName; changed = true; } }
    if (changed) {
      if (redis) await redis.set(`copyidx:${locationId}`, idx);
      else mem.indexes[locationId] = idx;
    }
    for (const row of mine) {
      const copy = await getCopy(row.id);
      if (copy && copy.customerName !== newName) {
        copy.customerName = newName;
        if (redis) await redis.set(`copy:${row.id}`, copy);
        else mem.copies[row.id] = copy;
      }
    }
  }

  return cust;
}

async function getCopyIndex(locationId) {
  if (redis) {
    const data = await redis.get(`copyidx:${locationId}`);
    return Array.isArray(data) ? data : [];
  }
  return mem.indexes[locationId] ? [...mem.indexes[locationId]] : [];
}

async function getCopy(copyId) {
  if (redis) return await redis.get(`copy:${copyId}`) || null;
  return mem.copies[copyId] || null;
}

const STATUSES = ['draft', 'in-progress', 'completed', 'archived'];

async function saveCopy(locationId, { customerId = '', customerName = '', type, messages, title, preview, ownerUserId = '', status = 'in-progress' }) {
  const id  = genId();
  const now = Date.now();
  const st  = STATUSES.includes(status) ? status : 'in-progress';
  const copy = { id, locationId, ownerUserId, status: st, customerId, customerName, type, messages, title, preview, createdAt: now, updatedAt: now };

  if (redis) await redis.set(`copy:${id}`, copy);
  else mem.copies[id] = copy;

  const idx = await getCopyIndex(locationId);
  idx.unshift({ id, ownerUserId, status: st, customerId, customerName, type, title, preview, createdAt: now, updatedAt: now });
  if (idx.length > 500) idx.length = 500;
  if (redis) await redis.set(`copyidx:${locationId}`, idx);
  else mem.indexes[locationId] = idx;

  return copy;
}

// Update just the status (draft/in-progress/completed/archived) on record + index.
async function updateStatus(copyId, locationId, status) {
  if (!STATUSES.includes(status)) return null;
  const copy = await getCopy(copyId);
  if (!copy || copy.locationId !== locationId) return null;

  const now = Date.now();
  copy.status = status;
  copy.updatedAt = now;
  if (redis) await redis.set(`copy:${copyId}`, copy);
  else mem.copies[copyId] = copy;

  const idx = await getCopyIndex(locationId);
  const row = idx.find(i => i.id === copyId);
  if (row) { row.status = status; row.updatedAt = now; }
  if (redis) await redis.set(`copyidx:${locationId}`, idx);
  else mem.indexes[locationId] = idx;

  return copy;
}

async function updateCopy(copyId, locationId, messages, { customerId, customerName } = {}) {
  const copy = await getCopy(copyId);
  if (!copy || copy.locationId !== locationId) return null;

  const now = Date.now();
  const lastAi = [...messages].reverse().find(m => m.role === 'assistant');
  copy.messages  = messages;
  copy.updatedAt = now;
  if (lastAi) copy.preview = lastAi.content.slice(0, 120);
  if (customerId   !== undefined) copy.customerId   = customerId;
  if (customerName !== undefined) copy.customerName = customerName;

  if (redis) await redis.set(`copy:${copyId}`, copy);
  else mem.copies[copyId] = copy;

  const idx  = await getCopyIndex(locationId);
  const pos  = idx.findIndex(i => i.id === copyId);
  if (pos !== -1) {
    const [item] = idx.splice(pos, 1); // remove from current position
    item.updatedAt = now;
    if (lastAi)      item.preview      = lastAi.content.slice(0, 120);
    if (customerId   !== undefined) item.customerId   = customerId;
    if (customerName !== undefined) item.customerName = customerName;
    idx.unshift(item); // put at top so Dashboard shows it first
  }
  if (redis) await redis.set(`copyidx:${locationId}`, idx);
  else mem.indexes[locationId] = idx;

  return copy;
}

async function deleteCopy(copyId, locationId) {
  if (redis) await redis.del(`copy:${copyId}`);
  else delete mem.copies[copyId];

  const idx = (await getCopyIndex(locationId)).filter(i => i.id !== copyId);
  if (redis) await redis.set(`copyidx:${locationId}`, idx);
  else mem.indexes[locationId] = idx;
}

async function getCustomerCopies(locationId, customerId) {
  const idx = await getCopyIndex(locationId);
  return idx.filter(i => i.customerId === customerId);
}

// One-time migration: assign all unowned (legacy) copies to a user.
async function claimLegacy(locationId, userId) {
  if (!userId) return 0;
  const idx = await getCopyIndex(locationId);
  const unowned = idx.filter(r => !r.ownerUserId);
  if (!unowned.length) return 0;
  for (const row of unowned) row.ownerUserId = userId;
  if (redis) await redis.set(`copyidx:${locationId}`, idx);
  else mem.indexes[locationId] = idx;
  for (const row of unowned) {
    const copy = await getCopy(row.id);
    if (copy && !copy.ownerUserId) {
      copy.ownerUserId = userId;
      if (redis) await redis.set(`copy:${row.id}`, copy);
      else mem.copies[row.id] = copy;
    }
  }
  return unowned.length;
}

// ── Backup / restore ────────────────────────────────────────────────────────
// Full copy records (with messages) for a location — used by the backup export.
async function getAllCopies(locationId) {
  const idx = await getCopyIndex(locationId);
  const out = [];
  for (const row of idx) { const c = await getCopy(row.id); if (c) out.push(c); }
  return out;
}

// Merge customers + copies from a backup (upsert by id; never deletes).
async function importData(locationId, userId, { customers = [], copies = [] } = {}) {
  // Customers — add any missing by id.
  const cust = await getCustomers(locationId);
  const custIds = new Set(cust.map(c => c.id));
  for (const c of customers) if (c?.id && !custIds.has(c.id)) { cust.push(c); custIds.add(c.id); }
  if (redis) await redis.set(`cust:${locationId}`, cust); else mem.customers[locationId] = cust;

  // Copies — upsert full record + index row.
  const idx = await getCopyIndex(locationId);
  const idxById = new Map(idx.map(r => [r.id, r]));
  let added = 0;
  for (const raw of copies) {
    if (!raw?.id) continue;
    const c = { ...raw, locationId, ownerUserId: raw.ownerUserId || userId || '' };
    if (redis) await redis.set(`copy:${c.id}`, c); else mem.copies[c.id] = c;
    const row = { id: c.id, ownerUserId: c.ownerUserId, status: c.status || 'in-progress', customerId: c.customerId || '', customerName: c.customerName || '', type: c.type, title: c.title, preview: c.preview, createdAt: c.createdAt, updatedAt: c.updatedAt };
    if (idxById.has(c.id)) Object.assign(idxById.get(c.id), row);
    else { idx.unshift(row); idxById.set(c.id, row); added++; }
  }
  if (redis) await redis.set(`copyidx:${locationId}`, idx); else mem.indexes[locationId] = idx;
  return { customers: customers.length, copies: copies.length, newCopies: added };
}

module.exports = { STATUSES, genId, getCustomers, createCustomer, updateCustomer, deleteCustomer, getCopyIndex, getCopy, getAllCopies, saveCopy, updateCopy, updateStatus, deleteCopy, getCustomerCopies, claimLegacy, importData };
