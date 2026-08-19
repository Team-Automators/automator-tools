// Contact endpoints — all require Authorization: Bearer {pit}
//
// GET /contacts/search?locationId=xxx&query=xxx&limit=20&skip=0
// GET /contacts/:contactId

const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const BASE        = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

function ghlHeaders(key) {
  return { Authorization: `Bearer ${key}`, Version: API_VERSION };
}

function extractKey(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : h.trim() || null;
}

// ── Search contacts in a location ─────────────────────────────────────────────
// GET /contacts/search?locationId=xxx&query=xxx&limit=20&skip=0
//
// query   — name, email, phone, or any partial match
// limit   — max results (default 20, max 100)
// skip    — offset for pagination (default 0)

router.get('/search', async (req, res) => {
  const apiKey = extractKey(req);
  if (!apiKey) {
    return res.status(401).json({ error: 'Authorization: Bearer {pit} header required.' });
  }

  const { locationId, query, limit = 20, skip = 0 } = req.query;

  if (!locationId) {
    return res.status(400).json({ error: 'locationId query param is required.' });
  }

  try {
    const { data } = await axios.get(`${BASE}/contacts/`, {
      headers: ghlHeaders(apiKey),
      params: {
        locationId,
        query:  query || undefined,
        limit:  Number(limit),
        skip:   Number(skip),
      },
    });

    res.json({
      total:    data.total ?? data.count ?? data.contacts?.length ?? 0,
      contacts: data.contacts || [],
    });
  } catch (err) {
    const status  = err.response?.status  || 500;
    const message = err.response?.data?.message || err.message;
    res.status(status).json({ error: message });
  }
});

// ── Get a single contact by ID ────────────────────────────────────────────────
// GET /contacts/:contactId

router.get('/:contactId', async (req, res) => {
  const apiKey = extractKey(req);
  if (!apiKey) {
    return res.status(401).json({ error: 'Authorization: Bearer {pit} header required.' });
  }

  try {
    const { data } = await axios.get(`${BASE}/contacts/${req.params.contactId}`, {
      headers: ghlHeaders(apiKey),
    });

    res.json(data.contact || data);
  } catch (err) {
    const status  = err.response?.status  || 500;
    const message = err.response?.data?.message || err.message;
    res.status(status).json({ error: message });
  }
});

module.exports = router;
