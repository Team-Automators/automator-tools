// Evolving memory for the Funnel Architect. Per location + user, we keep a
// distilled "playbook" of what resonates for this account plus a few recent
// builds. Each use folds new learning in, so results sharpen over time.

const isVercel = !!process.env.VERCEL;
let redis = null;
if (isVercel) redis = require('./redis');

const mem = {};
const TTL = 60 * 60 * 24 * 365; // 1 year
const U   = (uid) => uid || '_shared';
const KEY = (loc, uid) => `architectmem:${loc}:${U(uid)}`;

async function read(loc, uid) {
  if (redis) return (await redis.get(KEY(loc, uid))) || null;
  return mem[KEY(loc, uid)] || null;
}
async function write(loc, uid, rec) {
  if (redis) await redis.set(KEY(loc, uid), rec, { ex: TTL });
  else mem[KEY(loc, uid)] = rec;
}

async function getMemory(loc, uid) {
  return (await read(loc, uid)) || { playbook: '', examples: [], count: 0, updatedAt: 0 };
}

// Record a build the user generated/kept (most-recent first, capped).
async function recordBuild(loc, uid, example) {
  const m = await getMemory(loc, uid);
  m.examples = [{ ...example, at: Date.now() }, ...(m.examples || [])].slice(0, 25);
  m.count = (m.count || 0) + 1;
  await write(loc, uid, m);
  return m;
}

async function setPlaybook(loc, uid, text) {
  const m = await getMemory(loc, uid);
  m.playbook = String(text || '').slice(0, 4000);
  m.updatedAt = Date.now();
  await write(loc, uid, m);
  return m;
}

module.exports = { getMemory, recordBuild, setPlaybook };
