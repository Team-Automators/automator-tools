// Stores GHL OAuth tokens in Upstash Redis, keyed by locationId.
// The record persists for the refresh-token lifetime; the short-lived access
// token inside it is refreshed on demand via getAccessToken(). Each refresh
// re-persists the record, so an actively-used install never expires.

const redis = require('./redis');
const axios = require('axios');

const KEY = (locationId) => `ghl:tokens:${locationId}`;
// Persist for ~1 year (GHL refresh tokens are long-lived). Previously this was
// 24h, which silently dropped whole installs — refresh token and all — after a
// day of inactivity, so marketplace installs "disappeared".
const TTL = 60 * 60 * 24 * 365;

async function set(locationId, tokens) {
  await redis.set(KEY(locationId), tokens, { ex: TTL });
}

async function get(locationId) {
  return await redis.get(KEY(locationId));
}

async function getAccessToken(locationId) {
  let tokens = await get(locationId);
  if (!tokens) return null;

  // Refresh if expired
  if (tokens.expires_at && Date.now() >= tokens.expires_at) {
    tokens = await refresh(locationId, tokens.refresh_token);
  }

  return tokens?.access_token || null;
}

const clean = (v) => (v || '').replace(/^﻿/, '').trim();

async function refresh(locationId, refreshToken) {
  try {
    // GHL's /oauth/token requires form-urlencoded — the same shape as the
    // initial code exchange. Sending a JSON object (axios default) makes GHL
    // reject every refresh, so the stored access token could never renew.
    const { data } = await axios.post(
      'https://services.leadconnectorhq.com/oauth/token',
      new URLSearchParams({
        client_id:     clean(process.env.GHL_CLIENT_ID),
        client_secret: clean(process.env.GHL_CLIENT_SECRET),
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
    );

    const tokens = {
      ...data,
      expires_at: Date.now() + (data.expires_in || 86400) * 1000,
    };
    await set(locationId, tokens);
    return tokens;
  } catch (err) {
    console.error('[oauth-store] Token refresh failed:', err.response?.status, err.response?.data?.message || err.message);
    return null;
  }
}

async function del(locationId) {
  await redis.del(KEY(locationId));
}

async function exists(locationId) {
  const val = await redis.exists(KEY(locationId));
  return val === 1;
}

// Scan all stored OAuth tokens — used as fallback when no locationId in payload
async function findAll() {
  const results = [];
  let cursor = 0;
  do {
    const [next, keys] = await redis.scan(cursor, { match: 'ghl:tokens:*', count: 100 });
    cursor = Number(next);
    for (const key of keys) {
      const locationId = key.replace('ghl:tokens:', '');
      const tokens = await redis.get(key);
      // Spread FIRST, then locationId — agency token payloads carry their own
      // locationId:null, which would otherwise clobber the real key and make
      // getAccessToken(inst.locationId) refresh the wrong (empty) record.
      if (tokens?.access_token) results.push({ ...tokens, locationId });
    }
  } while (cursor !== 0);
  return results;
}

module.exports = { set, get, getAccessToken, del, exists, findAll };
