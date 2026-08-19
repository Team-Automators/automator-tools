// Caches GHL location info (name, email, logo) to avoid repeated API calls.
// Populated when Dashboard is visited; read by Settings API for the sidebar.

const isVercel = !!process.env.VERCEL;
let redis = null;
if (isVercel) redis = require('./redis');

const fs   = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'location-cache.json');
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
  } catch {}
}

if (!isVercel) loadLocal();

const KEY = (id) => `locinfo2:${id}`;

module.exports = {
  async get(locationId) {
    if (redis) return await redis.get(KEY(locationId)) || null;
    return local[locationId] || null;
  },

  async set(locationId, { name, email, logo }) {
    const record = { name: name || '', email: email || '', logo: logo || '', cachedAt: Date.now() };
    if (redis) {
      await redis.set(KEY(locationId), record, { ex: 86400 }); // 24-hour TTL
    } else {
      local[locationId] = record;
      saveLocal();
    }
  },
};
