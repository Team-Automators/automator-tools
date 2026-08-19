// Legacy multi-action webhook endpoint (POST /webhooks/workflow).
// The focused single endpoint for the marketplace action is POST /action.
// This file handles the older multi-action pattern where the action `name`
// field selects which operation to run.

const express = require('express');
const axios   = require('axios');
const router  = express.Router();
const api     = require('../lib/ghl-api');
const store   = require('../lib/token-store');

const BASE_URL    = 'https://services.leadconnectorhq.com';
const TOKEN_URL   = 'https://services.leadconnectorhq.com/oauth/token';
const FIVE_MIN    = 5 * 60 * 1000;

function toMap(fields = []) {
  const out = {};
  for (const f of fields) {
    const k = f.key || f.id;
    if (k) out[k] = f.value ?? '';
  }
  return out;
}

function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== ''));
}

async function sendCallback(url, statusCode, message, data = {}) {
  if (!url) return;
  try { await axios.post(url, { statusCode, message, data }); }
  catch (e) { console.error('[webhooks] callback failed:', e.message); }
}

async function getToken(companyId) {
  const rec = store.getByCompany(companyId);
  if (!rec) throw new Error(`Company "${companyId}" is not connected.`);
  if (rec.tokenExpiresAt - Date.now() > FIVE_MIN) return rec.accessToken;

  const { data } = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.GHL_CLIENT_ID,
      client_secret: process.env.GHL_CLIENT_SECRET,
      refresh_token: rec.refreshToken,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  store.updateTokens(companyId, data.access_token, data.refresh_token, Date.now() + data.expires_in * 1000);
  return data.access_token;
}

// ── Action handlers ───────────────────────────────────────────────────────────

async function handleCreateSubAccount(f, companyId) {
  const token = await getToken(companyId);
  const payload = compact({
    companyId, name: f.name, email: f.email, phone: f.phone,
    firstName: f.firstName, lastName: f.lastName,
    address: f.address, city: f.city, state: f.state,
    country: f.country || 'US', postalCode: f.postalCode,
    timezone: f.timezone, website: f.website,
  });
  const result = await api.createLocation(token, payload);
  return { locationId: result.id || result.location?.id, name: result.name || f.name };
}

async function handleUpdateSubAccount(f, companyId) {
  if (!f.locationId) throw new Error('locationId field is required');
  const token = await getToken(companyId);
  const payload = compact({
    name: f.name, email: f.email, phone: f.phone,
    address: f.address, city: f.city, state: f.state,
    country: f.country, postalCode: f.postalCode,
    timezone: f.timezone, website: f.website,
    firstName: f.firstName, lastName: f.lastName,
  });
  const result = await api.updateLocation(token, f.locationId, payload);
  return { locationId: f.locationId, ...result };
}

async function handleCreateUser(f, companyId) {
  const token = await getToken(companyId);
  const locationIds = f.locationIds
    ? f.locationIds.split(',').map(s => s.trim()).filter(Boolean) : [];
  const payload = compact({
    companyId, firstName: f.firstName, lastName: f.lastName,
    email: f.email, password: f.password, phone: f.phone,
    type: f.type || 'account', role: f.role || 'user', locationIds,
  });
  const result = await api.createUser(token, payload);
  return { userId: result.id || result.user?.id, email: f.email };
}

async function handleUpdateUser(f, companyId) {
  if (!f.userId) throw new Error('userId field is required');
  const token = await getToken(companyId);
  const locationIds = f.locationIds
    ? f.locationIds.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  const payload = compact({ firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone, type: f.type, role: f.role });
  if (locationIds?.length) payload.locationIds = locationIds;
  const result = await api.updateUser(token, f.userId, payload);
  return { userId: f.userId, ...result };
}

async function handleUpdateContact(f, companyId) {
  if (!f.contactId) throw new Error('contactId field is required');
  const token = await getToken(companyId);
  const tags = f.tags ? f.tags.split(',').map(s => s.trim()).filter(Boolean) : undefined;
  const payload = compact({
    firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone,
    address1: f.address1, city: f.city, state: f.state, postalCode: f.postalCode,
    country: f.country, companyName: f.companyName, source: f.source,
  });
  if (tags?.length) payload.tags = tags;
  const result = await api.updateContact(token, f.contactId, payload);
  return { contactId: f.contactId, ...result };
}

const HANDLERS = {
  create_sub_account: handleCreateSubAccount,
  update_sub_account: handleUpdateSubAccount,
  create_user:        handleCreateUser,
  update_user:        handleUpdateUser,
  update_contact:     handleUpdateContact,
};

// ── POST /webhooks/workflow ───────────────────────────────────────────────────
router.post('/workflow', async (req, res) => {
  const { name, callbackUrl, locationId: triggerLocationId, fields = [] } = req.body;

  const f          = toMap(fields);
  const companyId  = f.companyId || store.getByLocation(triggerLocationId)?.companyId;
  const handler    = HANDLERS[name];

  res.status(200).json({ received: true });

  if (!handler)   { await sendCallback(callbackUrl, 400, `Unknown action: ${name}`);                     return; }
  if (!companyId) { await sendCallback(callbackUrl, 401, 'companyId could not be resolved for this location.'); return; }

  try {
    const result = await handler(f, companyId);
    await sendCallback(callbackUrl, 200, 'Success', result);
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error(`[webhooks] action="${name}" failed:`, msg);
    await sendCallback(callbackUrl, 500, msg);
  }
});

router.get('/workflow', (req, res) => {
  res.json({ status: 'ok', app: 'GHL Automator', webhook: 'active' });
});

module.exports = router;
