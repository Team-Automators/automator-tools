// The user's AI provider config (provider + API key + model), stored per USER
// by email so it's account-level: it survives logout and works across every
// location that user connects to. Email is stable across locations (the GHL
// user id is not), so we key by a normalized email.

const isVercel = !!process.env.VERCEL;
let redis = null;
if (isVercel) redis = require('./redis');

const mem = {};
const TTL = 60 * 60 * 24 * 365; // 1 year
const norm = (email) => String(email || '').trim().toLowerCase();
const KEY  = (email) => `useraikey:${norm(email)}`;

async function get(email) {
  if (!norm(email)) return null;
  if (redis) return (await redis.get(KEY(email))) || null;
  return mem[KEY(email)] || null;
}

async function set(email, { provider, apiKey, model }) {
  if (!norm(email)) return;
  const rec = { provider: provider || '', apiKey: apiKey || '', model: model || '', updatedAt: Date.now() };
  if (redis) await redis.set(KEY(email), rec, { ex: TTL });
  else mem[KEY(email)] = rec;
  return rec;
}

async function del(email) {
  if (!norm(email)) return;
  if (redis) await redis.del(KEY(email));
  else delete mem[KEY(email)];
}

module.exports = { get, set, del };
