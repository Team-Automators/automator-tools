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

async function list() {
  if (redis) {
    const out = [];
    let cursor = 0;
    do {
      const [next, keys] = await redis.scan(cursor, { match: 'userreg:*', count: 100 });
      cursor = Number(next);
      for (const key of keys) { const r = await redis.get(key); if (r) out.push(r); }
    } while (cursor !== 0);
    return out;
  }
  return Object.values(mem);
}

module.exports = { record, list };
