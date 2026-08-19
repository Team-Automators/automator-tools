const axios    = require('axios');
const isVercel = !!process.env.VERCEL;
let redis = null;
if (isVercel) redis = require('./redis');

const BACKEND        = 'https://backend.leadconnectorhq.com';
const TTL_REFRESH    = 60 * 60 * 24 * 28; // 28 days (refresh token lasts 30d)
const TTL_ACCESS     = 3600;              // 1 h (access token only)
const ACCESS_MAX_AGE = 55 * 60 * 1000;   // re-use access token up to 55 min

const KEY = (id) => `ghl:session:${id}`;
const mem = {};

// Decode JWT payload without verifying signature.
function jwtLifetime(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
    if (payload.exp && payload.iat) return payload.exp - payload.iat;
  } catch {}
  return 0;
}

// Returns true when the JWT looks like a refresh token (lifetime > 7 days).
function isRefreshToken(jwt) {
  return jwtLifetime(jwt) > 7 * 86400;
}

async function set(locationId, { token, refreshToken, companyId }) {
  const ttl  = refreshToken ? TTL_REFRESH : TTL_ACCESS;
  const data = {
    token:          token        || null,
    tokenStoredAt:  token        ? Date.now() : null,
    refreshToken:   refreshToken || null,
    companyId:      companyId    || '',
  };
  if (redis) {
    await redis.set(KEY(locationId), data, { ex: ttl });
  } else {
    mem[locationId] = { ...data, expiresAt: Date.now() + ttl * 1000 };
  }
}

async function get(locationId) {
  if (redis) return await redis.get(KEY(locationId)) || null;
  const r = mem[locationId];
  if (!r || Date.now() > r.expiresAt) return null;
  return r;
}

// Call GHL's token-refresh endpoint with the stored refresh token.
async function _doRefresh(refreshToken) {
  try {
    const { data } = await axios.post(`${BACKEND}/oauth/2/login/token`, {}, {
      headers: {
        'refresh-token': refreshToken,
        'channel':       'APP',
        'source':        'WEB_USER',
        'app-name':      'spm-ts',
        'version':       '2021-07-28',
        'Content-Type':  'application/json',
      },
      timeout: 8000,
    });
    return data?.token || data?.accessToken || data?.access_token || null;
  } catch {
    return null;
  }
}

// Get a valid access token. Returns null if the stored token is stale/missing so
// callers see a clean "no_session" rather than a GHL 401.
async function getFreshToken(locationId) {
  const r = await get(locationId);
  if (!r) return null;

  // Access token within 55-minute freshness window — use it.
  if (r.token && r.tokenStoredAt && Date.now() - r.tokenStoredAt < ACCESS_MAX_AGE) {
    return r.token;
  }

  // We have a refresh token — try to silently get a new access token.
  if (r.refreshToken) {
    const newToken = await _doRefresh(r.refreshToken);
    if (newToken) {
      await set(locationId, { token: newToken, refreshToken: r.refreshToken, companyId: r.companyId });
      return newToken;
    }
  }

  // Token is stale and can't be refreshed — signal reconnect needed.
  return null;
}

async function getToken(locationId) {
  return getFreshToken(locationId);
}

async function getCompanyId(locationId) {
  const r = await get(locationId);
  return r?.companyId || null;
}

async function exists(locationId) {
  const r = await get(locationId);
  if (!r) return false;
  // Fresh access token OR a refresh token we can exchange.
  const freshAccess = r.token && r.tokenStoredAt && Date.now() - r.tokenStoredAt < ACCESS_MAX_AGE;
  return !!(freshAccess || r.refreshToken);
}

module.exports = { set, get, getToken, getFreshToken, getCompanyId, exists, isRefreshToken };
