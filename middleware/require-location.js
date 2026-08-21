// Gate for all tenant API routes.
//
// Derives locationId from a server-issued session (Authorization: Bearer <session>
// or the ghl_session cookie) — NEVER from client-supplied query/body params.
// It then overwrites req.query.locationId / req.body.locationId with the trusted
// value so existing handlers become tenant-scoped and spoof-proof automatically.

const { verify } = require('../lib/session');

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function readSessionToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  return parseCookies(req.headers['cookie'])['ghl_session'] || null;
}

function requireLocation(req, res, next) {
  if (req.method === 'OPTIONS') return next(); // let CORS preflights through

  const claims = verify(readSessionToken(req));
  if (!claims || !claims.lid) {
    return res.status(401).json({ error: 'not_authenticated', message: 'Sign in with an authorized location.' });
  }

  req.locationId = claims.lid;
  req.companyId  = claims.cid || '';
  req.userId     = claims.uid || null;   // set once the user verifies their email
  req.userEmail  = claims.email || null;

  // Force the trusted locationId onto the request so downstream handlers that
  // read req.query.locationId / req.body.locationId cannot be spoofed.
  if (req.query && typeof req.query === 'object') req.query.locationId = claims.lid;
  if (req.body  && typeof req.body  === 'object') req.body.locationId  = claims.lid;

  next();
}

module.exports = requireLocation;
module.exports.readSessionToken = readSessionToken;
