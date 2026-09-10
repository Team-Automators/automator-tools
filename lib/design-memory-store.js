// Evolving design preferences per account (location + user). Records which
// funnel styles get used and how they land (👍 / 👎 / regenerate), so the
// design-analysis step can prefer what works for this account and avoid what
// doesn't — automatically improving with use.

const isVercel = !!process.env.VERCEL;
let redis = null;
if (isVercel) redis = require('./redis');

const mem = {};
const TTL = 60 * 60 * 24 * 365; // 1 year
const norm = (e) => String(e || '').trim().toLowerCase();
const KEY  = (loc, uid) => `designmem:${loc}:${norm(uid) || '_shared'}`;

async function read(loc, uid)  { const k = KEY(loc, uid); return (redis ? await redis.get(k) : mem[k]) || null; }
async function write(loc, uid, v) { const k = KEY(loc, uid); if (redis) await redis.set(k, v, { ex: TTL }); else mem[k] = v; }

async function getMemory(loc, uid) {
  return (await read(loc, uid)) || { styles: {}, count: 0, updatedAt: 0 };
}

// Adjust a style's score. delta: +0.25 used · +2 liked/kept · -1.5 disliked/regenerated.
async function bump(loc, uid, styleName, delta) {
  if (!styleName) return;
  const m = await getMemory(loc, uid);
  const cur = m.styles[styleName] || { score: 0, used: 0 };
  cur.score = Math.max(-6, Math.min(10, (cur.score || 0) + delta));
  if (delta > 0 && delta < 1) cur.used = (cur.used || 0) + 1;
  m.styles[styleName] = cur;
  m.count = (m.count || 0) + (delta >= 1 || delta <= -1 ? 1 : 0);
  m.updatedAt = Date.now();
  await write(loc, uid, m);
  return m;
}

// A short line for the analysis prompt: which styles this account favors / avoids.
async function biasText(loc, uid) {
  const m = await getMemory(loc, uid);
  const entries = Object.entries(m.styles || {}).filter(([, v]) => Math.abs(v.score) >= 1);
  if (!entries.length) return '';
  const prefer = entries.filter(([, v]) => v.score >= 1).sort((a, b) => b[1].score - a[1].score).map(([n]) => n);
  const avoid  = entries.filter(([, v]) => v.score <= -1).sort((a, b) => a[1].score - b[1].score).map(([n]) => n);
  const parts = [];
  if (prefer.length) parts.push(`This account tends to prefer these styles (use them when the copy allows): ${prefer.join(', ')}.`);
  if (avoid.length)  parts.push(`This account has reacted poorly to these — avoid unless the copy strongly calls for them: ${avoid.join(', ')}.`);
  return parts.length ? `\nLEARNED DESIGN PREFERENCES:\n${parts.join('\n')}\n` : '';
}

module.exports = { getMemory, bump, biasText };
