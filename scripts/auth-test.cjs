/* Standalone auth test harness.
 * Stubs axios (GHL) + oauth-store (installs) so we can simulate an installed
 * agency, then drives the REAL server over HTTP through every auth path.
 * Run: node scripts/auth-test.cjs
 */
process.env.SESSION_SECRET = 'test-secret-123';
process.env.VERCEL = '';            // use in-memory stores
const PORT = 4100;
const BASE = `http://localhost:${PORT}`;

// ── Stub the GHL install layer ────────────────────────────────────────────────
const oauthStore = require('../lib/oauth-store');
oauthStore.getAccessToken = async (lid) => (lid === 'DIRECTLOC' ? 'DIRECT_TOKEN' : null);
oauthStore.get            = async (lid) => (lid === 'DIRECTLOC' ? { companyId: 'C-DIRECT' } : null);
oauthStore.findAll        = async () => [{ companyId: 'C1', access_token: 'AGENCY_TOKEN' }];

// PIT-only location (no OAuth) → exercised via the PIT fallback.
const keyStore = require('../lib/key-store');
keyStore.get = async (lid) => {
  if (lid === 'PITLOC')    return { subLocationApiKey: 'pit-sub',     agencyApiKey: 'pit-agency',     companyId: 'C-PIT' };
  if (lid === 'PITBADLOC') return { subLocationApiKey: 'pit-bad-sub', agencyApiKey: 'pit-bad-agency', companyId: 'C-PIT' };
  return null;
};

// ── Stub GHL HTTP (axios) ─────────────────────────────────────────────────────
const axios = require('axios');
let mintCalls = 0;
axios.post = async (url, body) => {
  if (url.includes('/oauth/locationToken')) {
    mintCalls++;
    const lid = new URLSearchParams(body).get('locationId');
    // These aren't under the agency → mint fails (PIT locations then try PIT).
    if (lid === 'BADLOC' || lid === 'PITLOC' || lid === 'PITBADLOC') { const e = new Error('not under agency'); e.response = { status: 401 }; throw e; }
    return { data: { access_token: `LOCTOKEN_${lid}` } };
  }
  return { data: {} };
};
axios.get = async (url, config) => {
  const auth = (config && config.headers && config.headers.Authorization) || '';
  if (auth.includes('bad')) { const e = new Error('invalid token'); e.response = { status: 401 }; throw e; } // expired/invalid PIT
  if (url.includes('/contacts/')) return { data: { contacts: [] } }; // PIT sub-token validation
  if (url.includes('/locations/')) {
    if (url.includes('UNAUTHLOC')) { const e = new Error('forbidden'); e.response = { status: 403 }; throw e; }
    if (url.includes('FLAKYLOC'))  { const e = new Error('gateway');   e.response = { status: 500 }; throw e; }
    return { data: { location: { companyId: 'C1' } } };
  }
  return { data: {} };
};

// ── Boot the real server ──────────────────────────────────────────────────────
const app = require('../server');
const session = require('../lib/session');

let passed = 0, failed = 0;
function check(name, cond, extra = '') {
  const tag = cond ? 'PASS' : 'FAIL';
  if (cond) passed++; else failed++;
  console.log(`  [${tag}] ${name}${extra ? '  — ' + extra : ''}`);
}

async function req(method, path, { token, cookie, body } = {}) {
  const headers = {};
  if (body)   headers['Content-Type'] = 'application/json';
  if (token)  headers['Authorization'] = `Bearer ${token}`;
  if (cookie) headers['Cookie'] = cookie;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json, setCookie: r.headers.get('set-cookie') };
}

async function run() {
  console.log('\n=== 1. Session token unit checks ===');
  const t = session.sign({ lid: 'X', cid: 'C1' });
  check('valid token verifies', session.verify(t)?.lid === 'X');
  check('tampered token rejected', session.verify(t.slice(0, -2) + 'zz') === null);
  check('garbage rejected', session.verify('not.a.token') === null);
  check('empty rejected', session.verify('') === null);
  const expired = session.sign({ lid: 'X' }, -1000);
  check('expired token rejected', session.verify(expired) === null);

  console.log('\n=== 2. Login gate (POST /auth/location-login) ===');
  const good = await req('POST', '/auth/location-login', { body: { locationId: 'GOODLOC' } });
  check('authorized location → 200', good.status === 200, `status=${good.status}`);
  check('returns a session token', !!good.json?.token);
  check('sets ghl_session cookie', /ghl_session=/.test(good.setCookie || ''), (good.setCookie||'').split(';')[0]);
  check('cookie is HttpOnly', /HttpOnly/i.test(good.setCookie || ''));
  const goodToken = good.json?.token;
  const goodCookie = (good.setCookie || '').split(';')[0];

  const bad = await req('POST', '/auth/location-login', { body: { locationId: 'BADLOC' } });
  check('location not under agency → 403', bad.status === 403, `status=${bad.status} err=${bad.json?.error}`);

  const flaky = await req('POST', '/auth/location-login', { body: { locationId: 'FLAKYLOC' } });
  check('GHL transient error → 502 (not 403)', flaky.status === 502, `status=${flaky.status}`);

  const unauth = await req('POST', '/auth/location-login', { body: { locationId: 'UNAUTHLOC' } });
  check('GHL 403 on validation → 403', unauth.status === 403, `status=${unauth.status}`);

  const noBody = await req('POST', '/auth/location-login', { body: {} });
  check('missing locationId → 400', noBody.status === 400);

  console.log('\n=== 3. API gate (requireLocation) ===');
  const noAuth = await req('GET', '/api/tasks?locationId=ATTACKER');
  check('no session → 401', noAuth.status === 401, `err=${noAuth.json?.error}`);

  const withTok = await req('GET', '/api/tasks?locationId=SPOOFED', { token: goodToken });
  check('valid bearer → 200', withTok.status === 200, `status=${withTok.status}`);

  const withCookie = await req('GET', '/api/tasks', { cookie: goodCookie });
  check('valid cookie (no bearer) → 200', withCookie.status === 200, `status=${withCookie.status}`);

  const tampered = await req('GET', '/api/tasks', { token: goodToken.slice(0, -3) + 'xxx' });
  check('tampered bearer → 401', tampered.status === 401);

  console.log('\n=== 4. locationId cannot be spoofed ===');
  // Create a task while authed as GOODLOC but claiming SPOOFED in the body.
  const created = await req('POST', '/api/tasks', { token: goodToken, body: { locationId: 'SPOOFED', title: 'from-goodloc' } });
  check('create task → 200', created.status === 200, `status=${created.status}`);
  // It must land under GOODLOC, never SPOOFED.
  const spoofSession = session.sign({ lid: 'SPOOFED', cid: '' });
  const spoofList = await req('GET', '/api/tasks', { token: spoofSession });
  const goodList  = await req('GET', '/api/tasks', { token: goodToken });
  const inSpoof = Array.isArray(spoofList.json) && spoofList.json.some(x => x.title === 'from-goodloc');
  const inGood  = Array.isArray(goodList.json)  && goodList.json.some(x => x.title === 'from-goodloc');
  check('task did NOT leak into spoofed location', !inSpoof);
  check('task stored under real session location', inGood);

  console.log('\n=== 5. /auth/session + logout ===');
  const sess = await req('GET', '/auth/session', { token: goodToken });
  check('session introspection authenticated', sess.json?.authenticated === true && sess.json?.locationId === 'GOODLOC');
  const anon = await req('GET', '/auth/session');
  check('no token → not authenticated (401)', anon.status === 401);
  const out = await req('POST', '/auth/logout');
  check('logout → 200 + clears cookie', out.status === 200 && /ghl_session=;/.test(out.setCookie || ''));

  console.log('\n=== 6. Location-token caching ===');
  mintCalls = 0;
  await req('GET', '/api/workflows/session/status', { token: goodToken });
  await req('GET', '/api/workflows/session/status', { token: goodToken });
  await req('GET', '/api/workflows/session/status', { token: goodToken });
  check('3 calls but token minted at most once (cache)', mintCalls <= 1, `mintCalls=${mintCalls}`);
  const status = await req('GET', '/api/workflows/session/status', { token: goodToken });
  check('status reports connected', status.json?.connected === true);

  console.log('\n=== 7. Direct location-level install path ===');
  const direct = await req('POST', '/auth/location-login', { body: { locationId: 'DIRECTLOC' } });
  check('direct install location authorized → 200', direct.status === 200, `status=${direct.status}`);

  console.log('\n=== 8. "Already authenticated" detection (bootstrap paths) ===');
  // (a) Server recognizes an existing session via cookie alone — the path
  //     App.bootstrapAuth() uses to detect an already-authenticated browser.
  const sessByCookie = await req('GET', '/auth/session', { cookie: goodCookie });
  check('GET /auth/session via cookie → authenticated', sessByCookie.json?.authenticated === true && sessByCookie.json?.locationId === 'GOODLOC');
  // (b) Silent re-login for an already-authorized location returns a fresh token
  //     (the GHL-iframe auto-auth path — no manual entry).
  const silent = await req('POST', '/auth/location-login', { body: { locationId: 'GOODLOC' } });
  check('silent re-login issues a valid token', silent.status === 200 && !!session.verify(silent.json?.token));

  console.log('\n=== 9. PIT fallback (no OAuth install) ===');
  const pitLogin = await req('POST', '/auth/location-login', { body: { locationId: 'PITLOC' } });
  check('PIT-only location authorized → 200', pitLogin.status === 200, `status=${pitLogin.status}`);
  check('issues a usable session token', !!session.verify(pitLogin.json?.token));
  const pitTok = pitLogin.json?.token;
  const pitCall = await req('GET', '/api/tasks', { token: pitTok });
  check('PIT session can call protected API', pitCall.status === 200, `status=${pitCall.status}`);
  const pitDiag = await req('GET', '/auth/diagnose?locationId=PITLOC');
  check('diagnose: authMethod = pit', pitDiag.json?.authMethod === 'pit', `authMethod=${pitDiag.json?.authMethod}`);
  check('diagnose: fullyAuthenticates', pitDiag.json?.fullyAuthenticates === true);
  // A location with neither OAuth nor PIT is still rejected.
  const noneDiag = await req('GET', '/auth/diagnose?locationId=BADLOC');
  check('unknown location still rejected', noneDiag.json?.fullyAuthenticates === false);

  // PIT record present but GHL rejects it (expired/invalid) → clear verdict, login refused.
  const badPitLogin = await req('POST', '/auth/location-login', { body: { locationId: 'PITBADLOC' } });
  check('invalid PIT → login 403', badPitLogin.status === 403, `status=${badPitLogin.status}`);
  const badPitDiag = await req('GET', '/auth/diagnose?locationId=PITBADLOC');
  check('diagnose flags PIT attempted + rejected', badPitDiag.json?.pitAttempted === true && badPitDiag.json?.fullyAuthenticates === false, `status=${badPitDiag.json?.ghlValidationStatus}`);
  check('verdict says PIT REJECTED', /PIT REJECTED/.test(badPitDiag.json?.verdict || ''), badPitDiag.json?.verdict);

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
  process.exit(failed ? 1 : 0);
}

const server = app.listen(PORT, async () => {
  try { await run(); } catch (e) { console.error('Harness error:', e); process.exit(2); }
  finally { server.close(); }
});
