// Persistent key store using Upstash Redis on Vercel.
// Falls back to local file store for development.

const isVercel = !!process.env.VERCEL;

let redisStore = null;
if (isVercel) {
  redisStore = require('./redis');
}

// Local file fallback
const fs   = require('fs');
const path = require('path');
const STORE_PATH = path.join(__dirname, '..', 'data', 'keys.json');
let localCache = {};

function loadLocal() {
  try {
    if (fs.existsSync(STORE_PATH)) localCache = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch { localCache = {}; }
}

function persistLocal() {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(localCache, null, 2));
  } catch (e) {
    console.warn('[key-store] Could not persist keys:', e.message);
  }
}

if (!isVercel) loadLocal();

const KEY = (locationId) => `ghl:keys:${locationId}`;

module.exports = {
  async set(locationId, subLocationApiKey, agencyApiKey, companyId) {
    const record = { subLocationApiKey, agencyApiKey, installedAt: new Date().toISOString() };
    if (companyId) record.companyId = companyId;
    if (isVercel) {
      await redisStore.set(KEY(locationId), record);
    } else {
      localCache[locationId] = record;
      persistLocal();
    }
  },

  async get(locationId) {
    if (isVercel) {
      return await redisStore.get(KEY(locationId)) || null;
    }
    return localCache[locationId] || null;
  },

  async has(locationId) {
    const rec = await this.get(locationId);
    return !!(rec?.subLocationApiKey && rec?.agencyApiKey);
  },

  async delete(locationId) {
    if (isVercel) {
      await redisStore.del(KEY(locationId));
    } else {
      delete localCache[locationId];
      persistLocal();
    }
  },

  async getAll() {
    return {};
  },

  // Scan Redis for all registered location IDs and their records.
  // Used as fallback when no locationId is provided in the webhook payload.
  async findAll() {
    if (isVercel) {
      const results = [];
      let cursor = 0;
      do {
        const [next, keys] = await redisStore.scan(cursor, { match: 'ghl:keys:*', count: 100 });
        cursor = Number(next);
        for (const key of keys) {
          const locationId = key.replace('ghl:keys:', '');
          const record = await redisStore.get(key);
          if (record?.subLocationApiKey && record?.agencyApiKey) {
            results.push({ locationId, ...record });
          }
        }
      } while (cursor !== 0);
      return results;
    }
    return Object.entries(localCache)
      .filter(([, r]) => r?.subLocationApiKey && r?.agencyApiKey)
      .map(([locationId, r]) => ({ locationId, ...r }));
  },
};
