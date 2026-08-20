const express   = require('express');
const router    = express.Router();
const copyStore = require('../lib/copy-store');

// GET /api/customers?locationId=
router.get('/customers', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    const customers = await copyStore.getCustomers(locationId);
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
    const customer = await copyStore.createCustomer(locationId, { name, email });
    res.json(customer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/customers/:id?locationId=
router.delete('/customers/:id', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    await copyStore.deleteCustomer(locationId, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/copies?locationId=&customerId=&limit=
router.get('/copies', async (req, res) => {
  const { locationId, customerId, limit } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    let copies;
    if (customerId) {
      copies = await copyStore.getCustomerCopies(locationId, customerId);
    } else {
      copies = await copyStore.getCopyIndex(locationId);
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
    const copy = await copyStore.getCopy(req.params.id);
    if (!copy) return res.status(404).json({ error: 'Not found' });
    // Scope to the session's location — never return another tenant's copy.
    if (req.locationId && copy.locationId !== req.locationId) {
      return res.status(404).json({ error: 'Not found' });
    }
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
    const copy = await copyStore.saveCopy(locationId, { customerId, customerName, type, messages, title, preview });
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

// DELETE /api/copies/:id?locationId=
router.delete('/copies/:id', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });
  try {
    await copyStore.deleteCopy(req.params.id, locationId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
