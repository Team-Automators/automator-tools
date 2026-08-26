// Admin identity. Admins are configured out-of-band via the ADMIN_EMAILS env
// var (comma-separated) — never self-declared by a client. Matched on the
// email the user verified against GoHighLevel at login.

// Built-in admins (always granted). Additional admins can be added via the
// ADMIN_EMAILS env var (comma-separated) without a code change.
const BUILTIN = ['jp@botbuilders.com'];

function adminEmails() {
  const fromEnv = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...BUILTIN.map(e => e.toLowerCase()), ...fromEnv])];
}

function isAdmin(email) {
  const e = String(email || '').trim().toLowerCase();
  return !!e && adminEmails().includes(e);
}

module.exports = { isAdmin, adminEmails };
