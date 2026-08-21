// Look up the real GHL users of a location so we can verify a login email
// against them. Uses whatever token has users.readonly for the location
// (OAuth location token first, then the stored agency/sub PITs).

const axios      = require('axios');
const ghlAuth    = require('./location-access');
const keyStore   = require('./key-store');

const GHL_API     = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

async function tokensFor(locationId) {
  const out = [];
  const oauth = await ghlAuth.getLocationToken(locationId).catch(() => null);
  if (oauth) out.push(oauth);
  const rec = await keyStore.get(locationId).catch(() => null);
  if (rec?.agencyApiKey)      out.push(rec.agencyApiKey);
  if (rec?.subLocationApiKey) out.push(rec.subLocationApiKey);
  return out;
}

function normUser(u) {
  return {
    id:    u.id || u._id || u.userId || '',
    email: u.email || '',
    name:  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.email || '',
    role:  u.role || u.roles?.role || null,
  };
}

// Returns an array of users, or null if GHL could not be reached / lacks scope.
async function listUsers(locationId) {
  const tokens = await tokensFor(locationId);
  const attempts = [
    { url: `${GHL_API}/users/`,       params: { locationId } },
    { url: `${GHL_API}/users/search`, params: { locationId } },
  ];
  for (const token of tokens) {
    for (const a of attempts) {
      try {
        const { data } = await axios.get(a.url, {
          headers: { Authorization: `Bearer ${token}`, Version: API_VERSION, Accept: 'application/json' },
          params:  a.params,
          timeout: 10000,
        });
        const raw = data.users || data.data || (Array.isArray(data) ? data : null);
        if (Array.isArray(raw)) return raw.map(normUser).filter(u => u.email);
      } catch { /* try next token / endpoint */ }
    }
  }
  return null;
}

const norm = (e) => String(e || '').trim().toLowerCase();

// { ok, user } on match; { ok:false, reason } otherwise.
//   reason: 'users_unavailable' (couldn't reach GHL) | 'not_found'
async function findUserByEmail(locationId, email) {
  const users = await listUsers(locationId);
  if (users === null) return { ok: false, reason: 'users_unavailable' };
  const match = users.find(u => norm(u.email) === norm(email));
  if (!match) return { ok: false, reason: 'not_found' };
  return { ok: true, user: match };
}

module.exports = { listUsers, findUserByEmail };
