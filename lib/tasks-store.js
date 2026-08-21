const isVercel = !!process.env.VERCEL;

let redis = null;
if (isVercel) {
  redis = require('./redis');
}

const mem = {};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Normalize notes: migrate old string format → array
function normalizeNotes(notes) {
  if (Array.isArray(notes)) return notes;
  if (typeof notes === 'string' && notes.trim()) {
    return [{ id: genId(), text: notes.trim(), createdAt: Date.now() }];
  }
  return [];
}

async function getAll(locationId) {
  if (redis) {
    const data = await redis.get(`tasks:${locationId}`);
    if (!Array.isArray(data)) return [];
    return data.map(t => ({ ...t, notes: normalizeNotes(t.notes) }));
  }
  return (mem[locationId] || []).map(t => ({ ...t, notes: normalizeNotes(t.notes) }));
}

async function saveAll(locationId, tasks) {
  if (redis) {
    await redis.set(`tasks:${locationId}`, tasks);
    return;
  }
  mem[locationId] = tasks;
}

async function create(locationId, { title, customerId, customerName, stage, clickupTaskId, clickupTaskName }) {
  const tasks = await getAll(locationId);
  const task = {
    id:              genId(),
    title:           title || 'Untitled',
    customerId:      customerId      || '',
    customerName:    customerName    || '',
    stage:           stage || 'urgent',
    clickupTaskId:   clickupTaskId   || '',
    clickupTaskName: clickupTaskName || '',
    notes:           [],
    createdAt:       Date.now(),
    updatedAt:       Date.now(),
  };
  tasks.push(task);
  await saveAll(locationId, tasks);
  return task;
}

async function update(locationId, taskId, fields) {
  const tasks = await getAll(locationId);
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;
  const allowed = ['title', 'stage', 'customerId', 'customerName', 'clickupTaskId', 'clickupTaskName'];
  for (const k of allowed) {
    if (fields[k] !== undefined) tasks[idx][k] = fields[k];
  }
  tasks[idx].updatedAt = Date.now();
  await saveAll(locationId, tasks);
  return tasks[idx];
}

async function addNote(locationId, taskId, text) {
  const tasks = await getAll(locationId);
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;
  const note = { id: genId(), text: text.trim(), createdAt: Date.now() };
  tasks[idx].notes = normalizeNotes(tasks[idx].notes);
  tasks[idx].notes.push(note);
  tasks[idx].updatedAt = Date.now();
  await saveAll(locationId, tasks);
  return { task: tasks[idx], note };
}

async function patchNote(locationId, taskId, noteId, fields) {
  const tasks = await getAll(locationId);
  const ti = tasks.findIndex(t => t.id === taskId);
  if (ti === -1) return null;
  const ni = tasks[ti].notes.findIndex(n => n.id === noteId);
  if (ni !== -1) Object.assign(tasks[ti].notes[ni], fields);
  await saveAll(locationId, tasks);
  return tasks[ti];
}

async function deleteNote(locationId, taskId, noteId) {
  const tasks = await getAll(locationId);
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;
  tasks[idx].notes = normalizeNotes(tasks[idx].notes).filter(n => n.id !== noteId);
  tasks[idx].updatedAt = Date.now();
  await saveAll(locationId, tasks);
  return tasks[idx];
}

async function remove(locationId, taskId) {
  const tasks = await getAll(locationId);
  await saveAll(locationId, tasks.filter(t => t.id !== taskId));
}

// Propagate a customer rename onto every task that references them.
async function renameCustomer(locationId, customerId, customerName) {
  const tasks = await getAll(locationId);
  let changed = false;
  for (const t of tasks) {
    if (t.customerId === customerId && t.customerName !== customerName) { t.customerName = customerName; changed = true; }
  }
  if (changed) await saveAll(locationId, tasks);
  return changed;
}

module.exports = { getAll, create, update, addNote, patchNote, deleteNote, remove, renameCustomer };
