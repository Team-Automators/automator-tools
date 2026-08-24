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

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
