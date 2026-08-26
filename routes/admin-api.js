const express   = require('express');
const router    = express.Router();
const userReg   = require('../lib/user-registry');
const userAiKey = require('../lib/user-ai-key-store');
const block     = require('../lib/user-block-store');
const admins    = require('../lib/admins');

// Gate: only a configured admin (email in ADMIN_EMAILS) may use these routes.
function requireAdmin(req, res, next) {
  if (!req.isAdmin && !admins.isAdmin(req.userEmail)) {
    return res.status(403).json({ error: 'forbidden', message: 'Admins only.' });
  }
  next();
}
router.use(requireAdmin);

function maskKey(k) {
  const s = String(k || '');
  if (!s) return '';
  if (s.length <= 8) return '••••';
  return `${s.slice(0, 3)}••••${s.slice(-4)}`;
}

// GET /api/admin/users — everyone who has signed in, with key + block status.
router.get('/users', async (req, res) => {
  try {
    const users = await userReg.list();
    const rows = await Promise.all(users.map(async (u) => {
      const [key, blocked] = await Promise.all([
        userAiKey.get(u.email).catch(() => null),
        block.isBlocked(u.email).catch(() => false),
      ]);
      const locs = Object.entries(u.locations || {}).map(([id, at]) => ({ id, at }));
      return {
        email:      u.email,
        name:       u.name || '',
        lastSeen:   u.lastSeen || 0,
        locations:  locs,
        blocked:    !!blocked,
        isAdmin:    admins.isAdmin(u.email),
        hasApiKey:  !!(key && key.apiKey),
        provider:   key?.provider || '',
        keyMasked:  key?.apiKey ? maskKey(key.apiKey) : '',
      };
    }));
    rows.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    res.json({ users: rows, adminEmail: (req.userEmail || '').toLowerCase() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/revoke-key { email } — delete the user's saved AI key.
router.post('/revoke-key', async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email required' });
  try { await userAiKey.del(email); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/block { email, blocked } — force logout (true) / restore (false).
router.post('/block', async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  const blocked = !!req.body?.blocked;
  if (!email) return res.status(400).json({ error: 'email required' });
  if (blocked && email === (req.userEmail || '').toLowerCase()) {
    return res.status(400).json({ error: 'You can’t lock yourself out.' });
  }
  try { await block.setBlocked(email, blocked); res.json({ ok: true, blocked }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
