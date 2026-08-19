// GET /users/:userId  — get a user by ID
// PUT /users/:userId  — update a user by ID
//
// Both require:
//   Authorization: Bearer {pit}

const express = require('express');
const router  = express.Router();
const { createClient } = require('../lib/ghl-client');

function extractKey(req) {
  const header = req.headers['authorization'] || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim() || null;
}

// GET /users/:userId
router.get('/:userId', async (req, res) => {
  const apiKey = extractKey(req);
  if (!apiKey) return res.status(401).json({ error: 'Authorization: Bearer {pit} header required.' });

  try {
    const client = createClient(apiKey);
    const { data } = await client.get(`/users/${req.params.userId}`);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PUT /users/:userId
router.put('/:userId', async (req, res) => {
  const apiKey = extractKey(req);
  if (!apiKey) return res.status(401).json({ error: 'Authorization: Bearer {pit} header required.' });

  try {
    const client = createClient(apiKey);
    const { data } = await client.put(`/users/${req.params.userId}`, req.body);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
