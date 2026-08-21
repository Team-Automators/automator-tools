const express       = require('express');
const axios         = require('axios');
const router        = express.Router();
const keyStore      = require('../lib/key-store');
const copyStore     = require('../lib/copy-store');
const locationCache = require('../lib/location-cache');

const GHL_BASE    = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

router.get('/', async (req, res) => {
  const { locationId } = req.query;
  if (!locationId) {
    return res.json({ hasPITs: false, locationName: '', locationEmail: '', locationLogo: '', recentCopies: [] });
  }

  const [record, copyIdx] = await Promise.all([
    keyStore.get(locationId).catch(() => null),
    copyStore.getCopyIndex(locationId).catch(() => []),
  ]);

  const hasPITs = !!(record?.subLocationApiKey && record?.agencyApiKey);
  let locationName = '', locationEmail = '', locationLogo = '';

  const tokens = [record?.subLocationApiKey, record?.agencyApiKey].filter(Boolean);
  for (const token of tokens) {
    try {
      const { data } = await axios.get(`${GHL_BASE}/locations/${locationId}`, {
        headers: { Authorization: `Bearer ${token}`, Version: API_VERSION },
        timeout: 5000,
      });
      const loc = data.location || data;
      locationName  = loc.businessName || loc.business?.name || loc.name || '';
      locationEmail = loc.email   || '';
      locationLogo  = loc.logoUrl || loc.logo || '';
      console.log(`[dashboard] GHL location fields: businessName=${loc.businessName} name=${loc.name}`);
      if (locationName) {
        locationCache.set(locationId, { name: locationName, email: locationEmail, logo: locationLogo }).catch(() => {});
        break;
      }
    } catch (e) {
      console.warn(`[dashboard] GHL fetch failed: ${e.response?.status} ${e.message}`);
    }
  }

  // Per-user + hide archived (mirror /api/copies). Legacy copies (no owner) stay visible.
  const uid = req.userId;
  const idx = (Array.isArray(copyIdx) ? copyIdx : [])
    .filter(c => !c.ownerUserId || c.ownerUserId === uid)
    .filter(c => (c.status || 'in-progress') !== 'archived');
  res.json({
    hasPITs,
    locationName,
    locationEmail,
    locationLogo,
    locationId,
    totalCopies: idx.length,
    recentCopies: idx,           // filtered index — client handles grouping & pagination
  });
});

module.exports = router;
