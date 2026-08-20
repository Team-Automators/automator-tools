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

async function saveCopy(locationId, { customerId = '', customerName = '', type, messages, title, preview }) {
  const id  = genId();
  const now = Date.now();
  const copy = { id, locationId, customerId, customerName, type, messages, title, preview, createdAt: now, updatedAt: now };

  if (redis) await redis.set(`copy:${id}`, copy);
  else mem.copies[id] = copy;

  const idx = await getCopyIndex(locationId);
  idx.unshift({ id, customerId, customerName, type, title, preview, createdAt: now, updatedAt: now });
  if (idx.length > 500) idx.length = 500;
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

module.exports = { genId, getCustomers, createCustomer, updateCustomer, deleteCustomer, getCopyIndex, getCopy, saveCopy, updateCopy, deleteCopy, getCustomerCopies };
