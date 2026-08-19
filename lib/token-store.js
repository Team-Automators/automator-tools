// Persists agency-level OAuth tokens keyed by companyId.
// Creating sub-locations and users requires an agency token, so the primary
// lookup key is companyId. A locationId → companyId index lets us also resolve
// tokens when a webhook only supplies a locationId.

const fs   = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'data', 'tokens.json');

let store = {
  companies: {},   // companyId  → full token record
  locations:  {},  // locationId → companyId  (reference only)
};

function load() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      // Support old single-map format from previous version
      if (raw.companies) {
        store = raw;
      } else {
        // migrate: old format was keyed by locationId
        for (const [locationId, rec] of Object.entries(raw)) {
          if (rec.companyId) {
            store.companies[rec.companyId] = rec;
            store.locations[locationId]    = rec.companyId;
          }
        }
      }
    }
  } catch {
    store = { companies: {}, locations: {} };
  }
}

function persist() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

load();

module.exports = {
  // Save / update an agency token record
  setCompany(companyId, data) {
    store.companies[companyId] = { ...data, updatedAt: new Date().toISOString() };
    persist();
  },

  // Keep a locationId → companyId pointer so webhook payloads with only
  // locationId can still resolve to the right agency token.
  setLocationRef(locationId, companyId) {
    store.locations[locationId] = companyId;
    persist();
  },

  // Look up agency token by companyId
  getByCompany(companyId) {
    return store.companies[companyId] || null;
  },

  // Look up agency token by locationId (follows the ref to companyId)
  getByLocation(locationId) {
    const companyId = store.locations[locationId];
    return companyId ? (store.companies[companyId] || null) : null;
  },

  // Update just the token fields after a refresh
  updateTokens(companyId, accessToken, refreshToken, expiresAt) {
    if (!store.companies[companyId]) return;
    store.companies[companyId].accessToken    = accessToken;
    store.companies[companyId].refreshToken   = refreshToken;
    store.companies[companyId].tokenExpiresAt = expiresAt;
    store.companies[companyId].updatedAt      = new Date().toISOString();
    persist();
  },

  getAll() {
    return { ...store.companies };
  },

  deleteCompany(companyId) {
    delete store.companies[companyId];
    persist();
  },
};
