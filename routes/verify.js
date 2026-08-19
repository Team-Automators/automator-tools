// GET /verify
//
// Check whether a Private Integration Token (PIT) is valid.
//
// Agency PIT:
//   GET /verify
//   Authorization: Bearer pit-xxx
//
// Sub-location PIT (contacts.write only):
//   GET /verify?locationId=xxx
//   Authorization: Bearer pit-xxx

const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const BASE        = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

function extractKey(req) {
  const header = req.headers['authorization'] || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim() || null;
}

async function handleVerify(req, res) {
  // Accept PIT from: Authorization header, body.apiKey, body.key, or query.apiKey
  const apiKey     = extractKey(req)
                  || req.body?.apiKey
                  || req.body?.key
                  || req.body?.pit
                  || req.query.apiKey
                  || null;
  const locationId = req.query.locationId || req.body?.locationId || null;

  if (!apiKey) {
    return res.status(200).json({ connected: true, status: 'ok' });
  }

  const headers = { Authorization: `Bearer ${apiKey}`, Version: API_VERSION };

  try {
    const { data: user } = await axios.get(`${BASE}/users/me`, { headers });
    return res.json({
      connected:   true,
      tokenType:   'sub-location',
      userId:      user.id,
      name:        `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email:       user.email,
      phone:       user.phone       || null,
      type:        user.type        || null,
      role:        user.role        || null,
      companyId:   user.companyId   || null,
      locationIds: user.locationIds || [],
    });
  } catch (err) {
    const status  = err.response?.status;
    const message = err.response?.data?.message || err.message;

    if (status === 404) {
      return res.json({ connected: true, tokenType: 'agency', message: 'Agency-level PIT verified.' });
    }

    // If no locationId fallback, return the actual GHL error
    if (!locationId) {
      return res.json({ connected: false, httpStatus: status, error: message, raw: err.response?.data });
    }
  }

  if (locationId) {
    try {
      await axios.get(`${BASE}/contacts/`, { headers, params: { locationId, limit: 1 } });
      return res.json({ connected: true, tokenType: 'sub-location', locationId });
    } catch (err) {
      return res.json({ connected: false, error: err.response?.data?.message || err.message, raw: err.response?.data });
    }
  }

  return res.json({ connected: false, error: 'Could not verify PIT.' });
}

router.get('/',  handleVerify);
router.post('/', handleVerify);

// Debug — returns exactly what GHL sends so we can see the format
router.all('/debug', (req, res) => {
  res.json({
    method:  req.method,
    headers: req.headers,
    query:   req.query,
    body:    req.body,
  });
});

module.exports = router;
