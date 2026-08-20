// Stateless signed session tokens (HMAC-SHA256).
//
// A session proves the holder passed the location-login check for a specific
// locationId. It is NOT a GHL credential — it only binds a browser to one
// location under an installed agency. Verified server-side on every /api call.

const crypto = require('crypto');

const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function secret() {
  const s = process.env.SESSION_SECRET || process.env.GHL_CLIENT_SECRET;
  if (s) return s;
  // Dev fallback — never rely on this in production.
  console.warn('[session] No SESSION_SECRET/GHL_CLIENT_SECRET set — using insecure dev secret.');
  return 'dev-insecure-secret-change-me';
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

// sign({ lid, cid }) → "<payload>.<sig>"
function sign(claims, ttlMs = TTL_MS) {
  const now = Date.now();
  const payload = { ...claims, iat: now, exp: now + ttlMs };
  const body = b64url(JSON.stringify(payload));
  const sig  = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

// verify(token) → claims | null   (constant-time signature check, expiry enforced)
function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;

  const body = token.slice(0, dot);
  const sig  = token.slice(dot + 1);

  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let claims;
  try { claims = JSON.parse(Buffer.from(body, 'base64url').toString()); }
  catch { return null; }

  if (!claims.exp || Date.now() >= claims.exp) return null;
  return claims;
}

module.exports = { sign, verify, TTL_MS };
