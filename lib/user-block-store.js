// Admin "force logout" = block a user by email. A blocked user's requests are
// rejected (their active sessions die) and they can't sign back in until an
// admin restores access. A short in-memory cache keeps the per-request check
// off Redis on the hot path.

const isVercel = !!process.env.VERCEL;
let redis = null;
if (isVercel) redis = require('./redis');

const mem = {};
const norm = (e) => String(e || '').trim().toLowerCase();
const KEY  = (e) => `userblock:${norm(e)}`;

const cache = new Map();       // email → { blocked, exp }
const CACHE_MS = 10 * 1000;    // blocked users are kicked within ~10s

async function isBlocked(email) {
  const e = norm(email);
  if (!e) return false;
  const c = cache.get(e);
  if (c && Date.now() < c.exp) return c.blocked;
  const blocked = !!(redis ? await redis.get(KEY(e)) : mem[KEY(e)]);
  cache.set(e, { blocked, exp: Date.now() + CACHE_MS });
  return blocked;
}

async function setBlocked(email, blocked) {
  const e = norm(email);
  if (!e) return;
  if (blocked) { if (redis) await redis.set(KEY(e), 1); else mem[KEY(e)] = 1; }
  else         { if (redis) await redis.del(KEY(e));    else delete mem[KEY(e)]; }
  cache.delete(e); // reflect immediately
}

module.exports = { isBlocked, setBlocked };
