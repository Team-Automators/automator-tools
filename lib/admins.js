// Admin identity. Admins are configured out-of-band via the ADMIN_EMAILS env
// var (comma-separated) — never self-declared by a client. Matched on the
// email the user verified against GoHighLevel at login.

function adminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdmin(email) {
  const e = String(email || '').trim().toLowerCase();
  return !!e && adminEmails().includes(e);
}

module.exports = { isAdmin, adminEmails };
