const isVercel = !!process.env.VERCEL;

let redis = null;
if (isVercel) redis = require('./redis');

const fs   = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'ai-configs.json');
let local  = {};

function loadLocal() {
  try { if (fs.existsSync(FILE)) local = JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { local = {}; }
}

function saveLocal() {
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(local, null, 2));
  } catch (e) { console.warn('[ai-config-store] persist failed:', e.message); }
}

if (!isVercel) loadLocal();

const KEY = (locationId) => `aiconfig:${locationId}`;

module.exports = {
  async get(locationId) {
    if (isVercel) return await redis.get(KEY(locationId)) || null;
    return local[locationId] || null;
  },

  async set(locationId, { provider, apiKey, model, businessName, clickupApiKey }) {
    const existing = await module.exports.get(locationId).catch(() => null) || {};
    const record = {
      ...existing,
      provider:      provider      !== undefined ? provider      : existing.provider,
      apiKey:        apiKey        !== undefined ? apiKey        : existing.apiKey,
      model:         model         !== undefined ? model         : existing.model,
      businessName:  businessName  !== undefined ? (businessName || '') : (existing.businessName || ''),
      clickupApiKey: clickupApiKey !== undefined ? clickupApiKey : existing.clickupApiKey,
      updatedAt:     Date.now(),
    };
    if (isVercel) {
      await redis.set(KEY(locationId), record);
    } else {
      local[locationId] = record;
      saveLocal();
    }
  },

  async delete(locationId) {
    if (isVercel) {
      await redis.del(KEY(locationId));
    } else {
      delete local[locationId];
      saveLocal();
    }
  },
};
