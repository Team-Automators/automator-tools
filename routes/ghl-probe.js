const express    = require('express');
const router     = express.Router();
const axios      = require('axios');
const keyStore   = require('../lib/key-store');
const oauthStore = require('../lib/oauth-store');

const BACKEND     = 'https://backend.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

// Paths probed — locationId substituted at runtime where {lid} appears
const PROBES = [
  '/locations/{lid}',
  '/users/me',
  '/conversations/search?locationId={lid}',
  '/opportunities/search?location_id={lid}',
  '/contacts?locationId={lid}&limit=5',
  '/pipelines?locationId={lid}',
];

async function probe(url, token) {
  try {
    const { status, data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}`, Version: API_VERSION },
      timeout: 8000,
    });
    return { status, ok: true, body: data };
  } catch (err) {
    return { status: err.response?.status || 0, ok: false, body: err.response?.data || err.message };
  }
}

// GET /api/ghl-probe/debug → shows what's in Redis
router.get('/debug', async (req, res) => {
  const [allOauth, allKeys] = await Promise.all([
    oauthStore.findAll().catch(() => []),
    keyStore.findAll().catch(() => []),
  ]);
  res.json({
    oauth_tokens: allOauth.map(t => ({
      stored_key:    t.locationId || '(no locationId — stored under companyId)',
      companyId:     t.companyId  || '(not in record)',
      locationId:    t.locationId || null,
      token_prefix:  (t.access_token || '').slice(0, 24) + '...',
      expires_at:    t.expires_at,
      scopes:        t.scope || t.scopes || '(not stored)',
    })),
    pit_locations: allKeys.map(r => ({ locationId: r.locationId, companyId: r.companyId || '(not stored)' })),
  });
});

// GET /api/ghl-probe              → lists stored locations
// GET /api/ghl-probe?locationId=  → runs all probes
// GET /api/ghl-probe?locationId=&path=/some/path → probes one specific path
router.get('/', async (req, res) => {
  const { locationId, path: customPath } = req.query;

  if (!locationId) {
    const all = await keyStore.findAll().catch(() => []);
    if (!all.length) return res.status(400).json({ error: 'No locations registered. Add your PITs via /install first.' });
    return res.json({
      hint: 'Pass one of these as ?locationId=',
      locations: all.map(r => r.locationId),
    });
  }

  const record = await keyStore.get(locationId).catch(() => null);
  if (!record?.subLocationApiKey) {
    return res.status(401).json({ error: 'No keys found for this locationId.' });
  }

  // Try OAuth JWT first — check by locationId, then scan all stored OAuth tokens
  let oauthToken = await oauthStore.getAccessToken(locationId).catch(() => null);
  if (!oauthToken) {
    const allOauth = await oauthStore.findAll().catch(() => []);
    if (allOauth.length) oauthToken = allOauth[0].access_token || null;
  }
  const tokens = [
    oauthToken ? { label: 'oauthJWT',      key: oauthToken }              : null,
    { label: 'subLocationPIT', key: record.subLocationApiKey },
    { label: 'agencyPIT',      key: record.agencyApiKey },
  ].filter(t => t?.key);

  if (customPath) {
    const results = [];
    for (const { label, key } of tokens) {
      const r = await probe(`${BACKEND}${customPath}`, key);
      results.push({ token: label, ...r, preview: JSON.stringify(r.body).slice(0, 600) });
    }
    return res.json({ path: customPath, results });
  }

  // Try to exchange company token for a location-scoped token
  let locationToken = null;
  let locationTokenError = null;
  if (oauthToken) {
    try {
      const { data } = await axios.post('https://services.leadconnectorhq.com/oauth/locationToken', {
        companyId: (await oauthStore.findAll().catch(() => []))[0]?.companyId,
        locationId,
      }, {
        headers: { Authorization: `Bearer ${oauthToken}`, Version: API_VERSION },
        timeout: 8000,
      });
      locationToken = data.access_token || null;
    } catch (err) {
      locationTokenError = err.response?.data || err.message;
    }
  }

  // Use location token if available, else fall back to company token or PIT
  const { key: activeToken, label: activeLabel } = locationToken
    ? { key: locationToken, label: 'locationScopedJWT' }
    : tokens[0];

  const results = await Promise.all(
    PROBES.map(async p => {
      const path = p.replace(/\{lid\}/g, locationId);
      const r = await probe(`${BACKEND}${path}`, activeToken);
      return { path, status: r.status, ok: r.ok, preview: JSON.stringify(r.body).slice(0, 400) };
    })
  );

  res.json({
    token_used: activeLabel,
    has_oauth_jwt: !!oauthToken,
    has_location_token: !!locationToken,
    location_token_error: locationTokenError,
    backend: BACKEND,
    results,
  });
});

module.exports = router;
