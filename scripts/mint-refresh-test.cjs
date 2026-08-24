/* Regression test for the agency-install mint path.
 *
 * Bug: resolve() minted a location token with the RAW stored agency access
 * token from findAll(). GHL access tokens expire ~daily, so a day after install
 * every mint 401'd and locations fell through to PIT → "not under an agency".
 *
 * Fix: resolve() now pulls a fresh token via oauthStore.getAccessToken() (which
 * refreshes + re-persists when expired) before minting.
 *
 * Run: node scripts/mint-refresh-test.cjs
 */
process.env.VERCEL = ''; // in-memory paths

const oauthStore = require('../lib/oauth-store');
const axios      = require('axios');

let passed = 0, failed = 0;
function check(name, cond, extra = '') {
  if (cond) passed++; else failed++;
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${name}${extra ? '  — ' + extra : ''}`);
}

// ── Mint stub: succeeds ONLY with the freshly-refreshed token ──────────────────
let mintedWith = null;
axios.post = async (url, body) => {
  if (url.includes('/oauth/locationToken')) {
    // body is a urlencoded string; agency token comes via the caller, not body.
    return { data: { access_token: 'LOCTOKEN_OK' } };
  }
  return { data: {} };
};

async function run() {
  console.log('\n=== Agency-install mint refresh ===\n');

  // Case 1: stored agency access token is EXPIRED → must refresh before minting.
  {
    // Fresh require so module-level token cache doesn't bleed across cases.
    delete require.cache[require.resolve('../lib/location-access.js')];

    let getAccessTokenCalledWith = null;
    oauthStore.findAll = async () => [{
      locationId:   'AGENCYKEY',
      companyId:    'C1',
      access_token: 'STALE_TOKEN',
      expires_at:   1, // long past → expired
    }];
    oauthStore.getAccessToken = async (lid) => {
      getAccessTokenCalledWith = lid;
      return lid === 'AGENCYKEY' ? 'FRESH_TOKEN' : null;
    };
    oauthStore.get = async () => null;

    // Capture what token the mint call actually used.
    axios.post = async (url, body, cfg) => {
      if (url.includes('/oauth/locationToken')) {
        mintedWith = (cfg?.headers?.Authorization || '').replace('Bearer ', '');
        return { data: { access_token: 'LOCTOKEN_OK' } };
      }
      return { data: {} };
    };

    const la = require('../lib/location-access.js');
    const token = await la.getLocationToken('SUBLOC1');

    check('expired agency token → getAccessToken() invoked with the record key',
      getAccessTokenCalledWith === 'AGENCYKEY', `got ${getAccessTokenCalledWith}`);
    check('mint used the REFRESHED token, not the stale one',
      mintedWith === 'FRESH_TOKEN', `minted with ${mintedWith}`);
    check('location token returned', token === 'LOCTOKEN_OK', `got ${token}`);
  }

  // Case 2: getAccessToken returns null (dead refresh token) → falls back to
  // the stored access_token rather than skipping the install entirely.
  {
    delete require.cache[require.resolve('../lib/location-access.js')];
    mintedWith = null;
    oauthStore.findAll        = async () => [{ locationId: 'AGENCYKEY', companyId: 'C1', access_token: 'STORED_TOKEN' }];
    oauthStore.getAccessToken = async () => null;
    oauthStore.get            = async () => null;

    const la = require('../lib/location-access.js');
    const token = await la.getLocationToken('SUBLOC2');
    check('getAccessToken null → falls back to stored access_token for mint',
      mintedWith === 'STORED_TOKEN', `minted with ${mintedWith}`);
    check('location token still returned via fallback', token === 'LOCTOKEN_OK', `got ${token}`);
  }

  // Case 3: real findAll() must NOT let a token payload's own locationId:null
  // clobber the key-derived locationId (agency installs carry locationId:null).
  {
    const redis = require('../lib/redis');
    redis.scan = async () => [0, ['ghl:tokens:AGENCYKEY']];
    redis.get  = async () => ({ access_token: 'A', refresh_token: 'R', locationId: null, companyId: 'C1' });
    const store = require('../lib/oauth-store');
    const all = await store.findAll();
    check('findAll keeps the redis key as locationId (not payload null)',
      all[0]?.locationId === 'AGENCYKEY', `got ${all[0]?.locationId}`);
  }

  // Case 4: refresh() must POST form-urlencoded to GHL's /oauth/token (a JSON
  // body is silently rejected → tokens can never renew).
  {
    process.env.GHL_CLIENT_ID = 'cid';
    process.env.GHL_CLIENT_SECRET = 'secret';
    const saved = {};
    // Replace the redis module wholesale (Upstash auto-pipelines, so patching
    // instance methods is unreliable).
    require.cache[require.resolve('../lib/redis')] = {
      id: require.resolve('../lib/redis'), loaded: true, exports: {
        get: async () => ({ access_token: 'OLD', refresh_token: 'RT', expires_at: 1 }), // expired
        set: async (k, v) => { saved.v = v; },
      },
    };
    let captured = null;
    axios.post = async (url, body, cfg) => {
      if (url.includes('/oauth/token')) {
        captured = { body, ct: cfg?.headers?.['Content-Type'] };
        return { data: { access_token: 'NEW', refresh_token: 'RT2', expires_in: 86400 } };
      }
      return { data: {} };
    };
    delete require.cache[require.resolve('../lib/oauth-store.js')];
    const store = require('../lib/oauth-store');
    const tok = await store.getAccessToken('AGENCYKEY');
    check('refresh returns the renewed access token', tok === 'NEW', `got ${tok}`);
    check('refresh posts form-urlencoded (not JSON object)',
      typeof captured?.body === 'string' && /grant_type=refresh_token/.test(captured.body),
      `body type ${typeof captured?.body}`);
    check('refresh sets x-www-form-urlencoded content type',
      captured?.ct === 'application/x-www-form-urlencoded', `got ${captured?.ct}`);
    check('renewed tokens are persisted', saved.v?.access_token === 'NEW', `saved ${saved.v?.access_token}`);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
