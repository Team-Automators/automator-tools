// Reusable GHL authentication for sub-accounts.
//
// The agency OAuth install is the root of trust. From it we mint a
// location-scoped token for a sub-account (POST /oauth/locationToken — GHL's
// contract), cache it (~50 min), and can fully confirm access with a live GET
// against the sub-account.
//
//   getLocationToken(locationId)   → a valid GHL location token, or null
//   authenticateLocation(locationId) → { ok, companyId, locationToken, location }
//   verify(locationId)             → alias of authenticateLocation (login gate)
//
// Any endpoint that needs to call GHL for a sub-account should call
// getLocationToken(req.locationId) first — that's the single auth step.

const axios      = require('axios');
const oauthStore = require('./oauth-store');

const isVercel = !!process.env.VERCEL;
let redis = null;
if (isVercel) redis = require('./redis');

const GHL_API      = 'https://services.leadconnectorhq.com';
const API_VERSION  = '2021-07-28';
const TOKEN_TTL_MS = 50 * 60 * 1000; // reuse a minted location token up to 50 min

const CACHE_KEY = (lid) => `ghl:loctoken:${lid}`;
const mem = {}; // locationId → { token, companyId, exp }

async function cacheGet(locationId) {
  if (redis) return (await redis.get(CACHE_KEY(locationId))) || null;
  const r = mem[locationId];
  if (!r || Date.now() > r.exp) return null;
  return r;
}

async function cacheSet(locationId, token, companyId) {
  const rec = { token, companyId: companyId || '', exp: Date.now() + TOKEN_TTL_MS };
  if (redis) await redis.set(CACHE_KEY(locationId), rec, { ex: Math.floor(TOKEN_TTL_MS / 1000) });
  else mem[locationId] = rec;
}

async function mintLocationToken(agencyToken, companyId, locationId) {
  const { data } = await axios.post(
    `${GHL_API}/oauth/locationToken`,
    new URLSearchParams({ companyId, locationId }).toString(),
    {
      headers: {
        Authorization:  `Bearer ${agencyToken}`,
        Version:        API_VERSION,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept:         'application/json',
      },
      timeout: 10000,
    }
  );
  return data.access_token || null;
}

// Resolve a { token, companyId } for a sub-account (cache → direct install →
// agency install mint). Returns null when no install covers the location.
async function resolve(locationId) {
  if (!locationId) return null;

  const cached = await cacheGet(locationId).catch(() => null);
  if (cached?.token) return { token: cached.token, companyId: cached.companyId };

  // Direct location-level OAuth install.
  const direct = await oauthStore.getAccessToken(locationId).catch(() => null);
  if (direct) {
    const cid = (await oauthStore.get(locationId).catch(() => null))?.companyId || '';
    await cacheSet(locationId, direct, cid);
    return { token: direct, companyId: cid };
  }

  // Agency install(s) — mint a location token to prove membership.
  const installs = await oauthStore.findAll().catch(() => []);
  for (const inst of installs) {
    if (!inst.companyId || !inst.access_token) continue;
    try {
      const token = await mintLocationToken(inst.access_token, inst.companyId, locationId);
      if (token) {
        await cacheSet(locationId, token, inst.companyId);
        return { token, companyId: inst.companyId };
      }
    } catch {
      // Not under this agency (or token stale) — try the next install.
    }
  }
  return null;
}

async function getLocationToken(locationId) {
  const r = await resolve(locationId);
  return r?.token || null;
}

// Full authentication: obtain a token, then a live GET against the sub-account
// to confirm the token really grants access before we trust it.
async function authenticateLocation(locationId) {
  const r = await resolve(locationId);
  if (!r?.token) return { ok: false };

  try {
    const { data } = await axios.get(`${GHL_API}/locations/${locationId}`, {
      headers: { Authorization: `Bearer ${r.token}`, Version: API_VERSION, Accept: 'application/json' },
      timeout: 10000,
    });
    const loc = data.location || data;
    return { ok: true, companyId: loc.companyId || r.companyId || '', locationToken: r.token, location: loc };
  } catch (err) {
    const status = err.response?.status || 0;
    // Auth failures = genuinely not authorized. Other errors = GHL transient.
    if (status === 401 || status === 403 || status === 404) return { ok: false, status };
    return { ok: false, status, transient: true };
  }
}

// { token, companyId } for a sub-account, or null — for endpoints that need both.
async function getLocationAuth(locationId) {
  return resolve(locationId);
}

module.exports = { verify: authenticateLocation, authenticateLocation, getLocationToken, getLocationAuth, mintLocationToken };
