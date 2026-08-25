const express    = require('express');
const router     = express.Router();
const copyStore  = require('../lib/copy-store');
const tasksStore = require('../lib/tasks-store');
const hooksStore = require('../lib/hooks-store');

// Load a copy the caller is allowed to touch: same location AND owned by the
// caller. Legacy (no owner) is NOT accessible. Returns null otherwise → 404.
async function ownedCopy(copyId, req) {
  const copy = await copyStore.getCopy(copyId);
  if (!copy) return null;
  if (req.locationId && copy.locationId !== req.locationId) return null;
  if ((copy.ownerUserId || '') !== (req.userId || '')) return null;
  return copy;
}

// A customer folder the caller owns (strict per-user). Null otherwise.
async function ownedCustomer(locationId, id, req) {
  const c = (await copyStore.getCustomers(locationId)).find(x => x.id === id);
  if (!c) return null;
  if ((c.ownerUserId || '') !== (req.userId || '')) return null;
  return c;
}

// GET /api/customers?locationId= — the caller's own folders only.
router.get('/customers', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    const uid = req.userId || '';
    const customers = (await copyStore.getCustomers(locationId)).filter(c => (c.ownerUserId || '') === uid);
    res.json(customers);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/customers
router.post('/customers', async (req, res) => {
  const { locationId, name, email } = req.body;
  if (!locationId || !name) return res.status(400).json({ error: 'locationId and name required' });
  try {
    const customer = await copyStore.createCustomer(locationId, { name, email, ownerUserId: req.userId || '' });
    res.json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/customers/:id — rename a folder (and optionally its email)
router.put('/customers/:id', async (req, res) => {
  const { locationId, name, email } = req.body;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ error: 'name cannot be empty' });
  try {
    if (!(await ownedCustomer(locationId, req.params.id, req))) return res.status(404).json({ error: 'Customer not found' });
    const cust = await copyStore.updateCustomer(locationId, req.params.id, { name, email });
    if (!cust) return res.status(404).json({ error: 'Customer not found' });
    // Sync the rename across the whole system — tasks and hooks reference the
    // customer name too. copyStore.updateCustomer already handled copies.
    if (name !== undefined && cust.name) {
      await Promise.all([
        tasksStore.renameCustomer(locationId, req.params.id, cust.name).catch(() => {}),
        hooksStore.renameCustomer(locationId, req.params.id, cust.name).catch(() => {}),
      ]);
    }
    res.json(cust);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/customers/:id?locationId=
router.delete('/customers/:id', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    if (!(await ownedCustomer(locationId, req.params.id, req))) return res.status(404).json({ error: 'Customer not found' });
    await copyStore.deleteCustomer(locationId, req.params.id);   // copies → Unsorted
    await Promise.all([
      tasksStore.detachCustomer(locationId, req.params.id).catch(() => {}),
      hooksStore.detachCustomer(locationId, req.params.id).catch(() => {}),
    ]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/copies?locationId=&customerId=&limit=&status=
// Per-user: returns the caller's own copies (+ legacy copies with no owner).
// Hides archived by default; pass ?status=archived for the Archive view.
router.get('/copies', async (req, res) => {
  const { locationId, customerId, limit, status } = req.query;
  const uid = req.userId;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    let copies = customerId
      ? await copyStore.getCustomerCopies(locationId, customerId)
      : await copyStore.getCopyIndex(locationId);

    // Strict per-user scope: only the caller's own copies (legacy hidden).
    copies = copies.filter(c => (c.ownerUserId || '') === (uid || ''));

    if (status) {
      copies = copies.filter(c => (c.status || 'in-progress') === status);
    } else {
      copies = copies.filter(c => (c.status || 'in-progress') !== 'archived');
    }

    if (limit) copies = copies.slice(0, parseInt(limit, 10));
    res.json(copies);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/copies/:id
router.get('/copies/:id', async (req, res) => {
  try {
    const copy = await ownedCopy(req.params.id, req);   // location + owner scoped
    if (!copy) return res.status(404).json({ error: 'Not found' });
    res.json(copy);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/copies
router.post('/copies', async (req, res) => {
  const { locationId, customerId, customerName, type, messages, title, preview } = req.body;
  if (!locationId || !type || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'locationId, type, and messages are required' });
  }
  try {
    const copy = await copyStore.saveCopy(locationId, {
      customerId, customerName, type, messages, title, preview,
      ownerUserId: req.userId || '',           // stamp the owner
      status: req.body.status || 'in-progress',
    });
    res.json(copy);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/copies/:id/status — set the conversation status
router.put('/copies/:id/status', async (req, res) => {
  const { locationId, status } = req.body;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  if (!copyStore.STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${copyStore.STATUSES.join(', ')}` });
  }
  try {
    if (!(await ownedCopy(req.params.id, req))) return res.status(404).json({ error: 'Not found' });
    const copy = await copyStore.updateStatus(req.params.id, locationId, status);
    if (!copy) return res.status(404).json({ error: 'Not found' });
    res.json(copy);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/copies/:id
router.put('/copies/:id', async (req, res) => {
  const { locationId, messages, customerId, customerName } = req.body;
  if (!locationId || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'locationId and messages required' });
  }
  try {
    if (!(await ownedCopy(req.params.id, req))) return res.status(404).json({ error: 'Not found' });
    const opts = {};
    if (customerId   !== undefined) opts.customerId   = customerId;
    if (customerName !== undefined) opts.customerName = customerName;
    const copy = await copyStore.updateCopy(req.params.id, locationId, messages, opts);
    if (!copy) return res.status(404).json({ error: 'Not found or access denied' });
    res.json(copy);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/copies/:id?locationId=[&permanent=true]
// Default = soft-delete → moves to Archive (status: archived).
// ?permanent=true = hard delete (used from the Archive view).
router.delete('/copies/:id', async (req, res) => {
  const { locationId, permanent } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    if (!(await ownedCopy(req.params.id, req))) return res.status(404).json({ error: 'Not found' });
    if (permanent === 'true') {
      await copyStore.deleteCopy(req.params.id, locationId);
      return res.json({ ok: true, permanent: true });
    }
    const copy = await copyStore.updateStatus(req.params.id, locationId, 'archived');
    if (!copy) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, archived: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
