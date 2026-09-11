// Registry of everyone who has signed in, so an admin can see the users on the
// system. Keyed by email (stable across locations). Updated on each user-login.

const isVercel = !!process.env.VERCEL;
let redis = null;
if (isVercel) redis = require('./redis');

const mem = {};
const TTL = 60 * 60 * 24 * 365; // 1 year
const norm = (e) => String(e || '').trim().toLowerCase();
const KEY  = (e) => `userreg:${norm(e)}`;

async function read(k)      { return redis ? (await redis.get(k)) : mem[k]; }
async function write(k, v)  { if (redis) await redis.set(k, v, { ex: TTL }); else mem[k] = v; }

// Upsert a login: remember name + the locations this user has used + last seen.
async function record(email, { name, locationId } = {}) {
  if (!norm(email)) return;
  const k = KEY(email);
  const rec = (await read(k)) || { email: norm(email), name: '', locations: {}, firstSeen: Date.now() };
  rec.email = norm(email);
  if (name) rec.name = name;
  if (locationId) rec.locations = { ...(rec.locations || {}), [locationId]: Date.now() };
  rec.lastSeen = Date.now();
  await write(k, rec);
  return rec;
}

// Lightweight heartbeat — just bump lastSeen (drives online/offline status).
async function touch(email) {
  if (!norm(email)) return;
  const k = KEY(email);
  const rec = await read(k);
  if (!rec) return;
  rec.lastSeen = Date.now();
  await write(k, rec);
}

// Remove a user from the registry (on logout — they should no longer appear in
// the admin list until they sign in again).
async function remove(email) {
  if (!norm(email)) return;
  const k = KEY(email);
  if (redis) await redis.del(k);
  else delete mem[k];
}

async function list() {
  if (redis) {
    // Collect all matching keys, then fetch them in one MGET instead of a
    // round-trip per key (was an N+1 that scaled badly with user count).
    const keys = [];
    let cursor = 0;
    do {
      const [next, batch] = await redis.scan(cursor, { match: 'userreg:*', count: 100 });
      cursor = Number(next);
      keys.push(...batch);
    } while (cursor !== 0);
    if (!keys.length) return [];
    const vals = await redis.mget(...keys);
    return vals.filter(Boolean);
  }
  return Object.values(mem);
}

module.exports = { record, touch, remove, list };
