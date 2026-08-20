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
const keyStore   = require('./key-store');

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

// PIT fallback — for locations registered via Private Integration Tokens
// (no OAuth install). Live-validates a stored PIT against GHL so we still
// prove real access rather than trusting the stored record blindly.
async function pitAuthenticate(locationId) {
  const record = await keyStore.get(locationId).catch(() => null);
  if (!record?.subLocationApiKey || !record?.agencyApiKey) return null;

  // Try the sub-location PIT against contacts (the scope /install verified),
  // then the agency PIT against the location record.
  const attempts = [
    { key: record.subLocationApiKey, url: `${GHL_API}/contacts/`,            params: { locationId, limit: 1 } },
    { key: record.agencyApiKey,      url: `${GHL_API}/locations/${locationId}` },
  ];
  let transient = false;
  let lastStatus = 0;
  for (const a of attempts) {
    try {
      const { data } = await axios.get(a.url, {
        headers: { Authorization: `Bearer ${a.key}`, Version: API_VERSION, Accept: 'application/json' },
        params:  a.params,
        timeout: 10000,
      });
      const loc = (data && data.location) || data || {};
      return { ok: true, companyId: record.companyId || loc.companyId || '', via: 'pit' };
    } catch (err) {
      lastStatus = err.response?.status || 0;
      if (!(lastStatus === 401 || lastStatus === 403 || lastStatus === 404)) transient = true;
    }
  }
  // Record existed but GHL rejected every PIT → report it (distinct from "no PIT").
  return { ok: false, pitTried: true, transient, status: lastStatus };
}

// Full authentication:
//   1. OAuth path — mint/get a location token, then a live GET to confirm it.
//   2. PIT fallback — live-validate stored Private Integration Tokens.
async function authenticateLocation(locationId) {
  const r = await resolve(locationId);
  if (r?.token) {
    try {
      const { data } = await axios.get(`${GHL_API}/locations/${locationId}`, {
        headers: { Authorization: `Bearer ${r.token}`, Version: API_VERSION, Accept: 'application/json' },
        timeout: 10000,
      });
      const loc = data.location || data;
      return { ok: true, companyId: loc.companyId || r.companyId || '', locationToken: r.token, location: loc, via: 'oauth' };
    } catch (err) {
      const status = err.response?.status || 0;
      // Auth failure on the OAuth token — fall through to the PIT fallback.
      // Transient GHL error — remember it in case PIT also can't be checked.
      if (!(status === 401 || status === 403 || status === 404)) {
        const pit = await pitAuthenticate(locationId);
        return pit?.ok ? pit : { ok: false, status, transient: true };
      }
    }
  }

  const pit = await pitAuthenticate(locationId);
  if (pit) return pit;

  return { ok: false };
}

// { token, companyId } for a sub-account, or null — for endpoints that need both.
async function getLocationAuth(locationId) {
  return resolve(locationId);
}

module.exports = { verify: authenticateLocation, authenticateLocation, getLocationToken, getLocationAuth, mintLocationToken };
