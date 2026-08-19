// Two separate workflow actions:
//
// POST /action/create-location
//   Creates a sub-location on Account 2.
//   Writes the new locationId back to a contact custom field on Account 1.
//
// POST /action/create-user
//   Creates a user on an existing sub-location on Account 2.
//   The locationId is passed as a field (pulled from the custom field set in Action 1).
//
// Both actions use PITs registered at POST /install — no keys needed in the request.

const express        = require('express');
const axios          = require('axios');
const router         = express.Router();
const { waitUntil }  = require('@vercel/functions');
const { generatePassword } = require('../lib/generate-password');
const keyStore       = require('../lib/key-store');

const BASE        = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

// ── Helpers ───────────────────────────────────────────────────────────────────

function ghlHeaders(apiKey) {
  return {
    Authorization:  `Bearer ${apiKey}`,
    Version:        API_VERSION,
    'Content-Type': 'application/json',
  };
}

function toMap(fields = []) {
  const out = {};
  for (const f of fields) {
    const k = f.key || f.id;
    if (k !== undefined && k !== null) out[k] = f.value ?? '';
  }
  return out;
}

function compact(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

function extractKey(req) {
  const header = req.headers['authorization'] || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim() || null;
}

// GHL sometimes sends locationId/callbackUrl as objects when user includes them manually.
// Strip [object Object] values and fall back to GHL-injected headers.
function sanitize(val, req, headerNames = []) {
  if (val && typeof val === 'string' && val !== '[object Object]') return val;
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const s = val.id || val.locationId || val.value || null;
    if (s) return String(s);
  }
  for (const h of headerNames) {
    const v = req.headers[h];
    if (v) return v;
  }
  return null;
}

async function ghlCallback(url, statusCode, message, data = {}) {
  if (!url) return;
  try { await axios.post(url, { statusCode, message, data }); }
  catch (e) { console.error('[action] GHL callback failed:', e.message); }
}

// PITs are looked up from Redis (stored at install time via External Auth).
// Fallback: environment variables, then request body.
async function resolvePITs(req, triggerLocationId) {
  let account1Key = null;
  let account2Key = null;

  if (triggerLocationId) {
    const record = await keyStore.get(triggerLocationId);
    if (record) {
      account1Key = record.subLocationApiKey || null;
      account2Key = record.agencyApiKey      || null;
      console.log('[resolvePITs] Loaded PITs from Redis for locationId:', triggerLocationId);
    }
  }

  // Fallbacks
  if (!account1Key) account1Key = process.env.SUB_LOCATION_API_KEY || req.body.subLocationApiKey || extractKey(req) || null;
  if (!account2Key) account2Key = process.env.AGENCY_API_KEY       || req.body.agencyApiKey       || null;

  console.log('[resolvePITs] locationId:', triggerLocationId, '| account1Key:', !!account1Key, '| account2Key:', !!account2Key);
  return { account1Key, account2Key, resolvedLocationId: triggerLocationId };
}

// ── GHL API calls ─────────────────────────────────────────────────────────────

async function createSubLocation(apiKey, companyId, f) {
  const payload = compact({
    companyId,
    name:       f.locationName,
    phone:      f.locationPhone,
    address:    f.locationAddress,
    city:       f.locationCity,
    state:      f.locationState,
    country:    f.locationCountry || 'US',
    postalCode: f.locationPostalCode,
    website:    f.locationWebsite,
    timezone:   f.locationTimezone,
  });

  const prospectInfo = compact({
    firstName: f.locationFirstName,
    lastName:  f.locationLastName,
    email:     f.locationEmail,
  });
  if (Object.keys(prospectInfo).length) payload.prospectInfo = prospectInfo;

  payload.settings = {
    allowDuplicateContact:     f.allowDuplicateContact     === 'true',
    allowDuplicateOpportunity: f.allowDuplicateOpportunity === 'true',
    allowFacebookNameMerge:    f.allowFacebookNameMerge    === 'true',
    disableContactTimezone:    f.disableContactTimezone    === 'true',
  };

  const { data } = await axios.post(`${BASE}/locations/`, payload, { headers: ghlHeaders(apiKey) });
  const id   = data.id   || data.location?.id;
  const name = data.name || data.location?.name || f.locationName;
  if (!id) throw new Error('GHL did not return a locationId after creating the sub-location.');
  return { id, name };
}

function bool(val, def = true) {
  if (val === undefined || val === null || val === '') return def;
  if (typeof val === 'boolean') return val;
  return String(val).toLowerCase() !== 'false';
}

async function createUser(apiKey, companyId, locationIds, f) {
  const ids = Array.isArray(locationIds)
    ? locationIds.filter(id => id && String(id).trim())
    : locationIds ? [String(locationIds).trim()].filter(Boolean) : [];

  const payload = compact({
    companyId,
    firstName:        f.firstName,
    lastName:         f.lastName,
    email:            f.email,
    password:         f.password,
    phone:            f.phone,
    type:             f.type             || 'account',
    role:             f.role             || 'admin',
    profilePhoto:     f.profilePhoto     || undefined,
    platformLanguage: f.platformLanguage || 'en_US',
    locationIds:      ids,
  });

  payload.permissions = {
    campaignsEnabled:              bool(f.campaignsEnabled,              true),
    campaignsReadOnly:             bool(f.campaignsReadOnly,             false),
    contactsEnabled:               bool(f.contactsEnabled,               true),
    workflowsEnabled:              bool(f.workflowsEnabled,              true),
    workflowsReadOnly:             bool(f.workflowsReadOnly,             true),
    triggersEnabled:               bool(f.triggersEnabled,               true),
    funnelsEnabled:                bool(f.funnelsEnabled,                true),
    websitesEnabled:               bool(f.websitesEnabled,               false),
    opportunitiesEnabled:          bool(f.opportunitiesEnabled,          true),
    dashboardStatsEnabled:         bool(f.dashboardStatsEnabled,         true),
    bulkRequestsEnabled:           bool(f.bulkRequestsEnabled,           true),
    appointmentsEnabled:           bool(f.appointmentsEnabled,           true),
    reviewsEnabled:                bool(f.reviewsEnabled,                true),
    onlineListingsEnabled:         bool(f.onlineListingsEnabled,         true),
    phoneCallEnabled:              bool(f.phoneCallEnabled,              true),
    conversationsEnabled:          bool(f.conversationsEnabled,          true),
    assignedDataOnly:              bool(f.assignedDataOnly,              false),
    adwordsReportingEnabled:       bool(f.adwordsReportingEnabled,       false),
    membershipEnabled:             bool(f.membershipEnabled,             false),
    facebookAdsReportingEnabled:   bool(f.facebookAdsReportingEnabled,   false),
    attributionsReportingEnabled:  bool(f.attributionsReportingEnabled,  false),
    settingsEnabled:               bool(f.settingsEnabled,               true),
    tagsEnabled:                   bool(f.tagsEnabled,                   true),
    leadValueEnabled:              bool(f.leadValueEnabled,              true),
    marketingEnabled:              bool(f.marketingEnabled,              true),
    agentReportingEnabled:         bool(f.agentReportingEnabled,         true),
    botService:                    bool(f.botService,                    false),
    socialPlanner:                 bool(f.socialPlanner,                 true),
    bloggingEnabled:               bool(f.bloggingEnabled,               true),
    invoiceEnabled:                bool(f.invoiceEnabled,                true),
    affiliateManagerEnabled:       bool(f.affiliateManagerEnabled,       true),
    contentAiEnabled:              bool(f.contentAiEnabled,              true),
    refundsEnabled:                bool(f.refundsEnabled,                true),
    recordPaymentEnabled:          bool(f.recordPaymentEnabled,          true),
    cancelSubscriptionEnabled:     bool(f.cancelSubscriptionEnabled,     true),
    paymentsEnabled:               bool(f.paymentsEnabled,               true),
    communitiesEnabled:            bool(f.communitiesEnabled,            true),
    exportPaymentsEnabled:         bool(f.exportPaymentsEnabled,         true),
  };

  // scopes — accept array or comma-separated string
  const toArr = v => Array.isArray(v) ? v : (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : null);
  const scopes = toArr(f.scopes || f.userScopes);
  const scopesAssignedToOnly = toArr(f.scopesAssignedToOnly);
  if (scopes?.length)              payload.scopes = scopes;
  if (scopesAssignedToOnly?.length) payload.scopesAssignedToOnly = scopesAssignedToOnly;

  const { data } = await axios.post(`${BASE}/users/`, payload, { headers: ghlHeaders(apiKey) });
  const id = data.id || data.user?.id;
  if (!id) throw new Error('GHL did not return a userId after creating the user.');
  return { id, email: f.email };
}

async function updateContactCustomField(apiKey, contactId, fieldIdOrKey, value) {
  // Accept either a field ID (e.g. TXqbAtkE5gd0rsKQXWLd) or a field key (e.g. subaccount_id)
  const isKey = /^[a-z0-9_]+$/.test(fieldIdOrKey);
  const fieldRef = isKey ? { key: fieldIdOrKey } : { id: fieldIdOrKey };
  const { data } = await axios.put(
    `${BASE}/contacts/${contactId}`,
    { customFields: [{ ...fieldRef, value }] },
    { headers: ghlHeaders(apiKey) }
  );
  return data;
}

async function findContactByEmail(apiKey, locationId, email) {
  const { data } = await axios.get(`${BASE}/contacts/search`, {
    headers: ghlHeaders(apiKey),
    params:  { locationId, query: email, limit: 10 },
  });
  const contacts = data.contacts || data.data || [];

  // Strict match — email AND locationId must both match
  const match = contacts.find(c =>
    c.email?.toLowerCase() === email.toLowerCase() &&
    c.locationId === locationId
  );

  if (!match) throw new Error(`No contact found with email "${email}" in location "${locationId}"`);
  return match;
}

async function findUserByEmail(apiKey, companyId, email) {
  const { data } = await axios.get(`${BASE}/users/search`, {
    headers: ghlHeaders(apiKey),
    params:  { companyId, query: email, limit: 20 },
  });
  const users = Array.isArray(data.users) ? data.users : (Array.isArray(data) ? data : []);
  const match = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!match) throw new Error(`Could not find existing user with email "${email}"`);
  return match;
}

async function updateExistingUser(apiKey, userId, companyId, locationIds, f) {
  const ids = Array.isArray(locationIds)
    ? locationIds.filter(id => id && String(id).trim())
    : locationIds ? [String(locationIds).trim()].filter(Boolean) : [];

  const payload = compact({
    companyId,
    firstName:        f.firstName,
    lastName:         f.lastName,
    phone:            f.phone,
    type:             f.type             || 'account',
    role:             f.role             || 'admin',
    profilePhoto:     f.profilePhoto     || undefined,
    platformLanguage: f.platformLanguage || 'en_US',
    locationIds:      ids,
  });

  payload.permissions = {
    campaignsEnabled:              bool(f.campaignsEnabled,              true),
    campaignsReadOnly:             bool(f.campaignsReadOnly,             false),
    contactsEnabled:               bool(f.contactsEnabled,               true),
    workflowsEnabled:              bool(f.workflowsEnabled,              true),
    workflowsReadOnly:             bool(f.workflowsReadOnly,             true),
    triggersEnabled:               bool(f.triggersEnabled,               true),
    funnelsEnabled:                bool(f.funnelsEnabled,                true),
    websitesEnabled:               bool(f.websitesEnabled,               false),
    opportunitiesEnabled:          bool(f.opportunitiesEnabled,          true),
    dashboardStatsEnabled:         bool(f.dashboardStatsEnabled,         true),
    bulkRequestsEnabled:           bool(f.bulkRequestsEnabled,           true),
    appointmentsEnabled:           bool(f.appointmentsEnabled,           true),
    reviewsEnabled:                bool(f.reviewsEnabled,                true),
    onlineListingsEnabled:         bool(f.onlineListingsEnabled,         true),
    phoneCallEnabled:              bool(f.phoneCallEnabled,              true),
    conversationsEnabled:          bool(f.conversationsEnabled,          true),
    assignedDataOnly:              bool(f.assignedDataOnly,              false),
    adwordsReportingEnabled:       bool(f.adwordsReportingEnabled,       false),
    membershipEnabled:             bool(f.membershipEnabled,             false),
    facebookAdsReportingEnabled:   bool(f.facebookAdsReportingEnabled,   false),
    attributionsReportingEnabled:  bool(f.attributionsReportingEnabled,  false),
    settingsEnabled:               bool(f.settingsEnabled,               true),
    tagsEnabled:                   bool(f.tagsEnabled,                   true),
    leadValueEnabled:              bool(f.leadValueEnabled,              true),
    marketingEnabled:              bool(f.marketingEnabled,              true),
    agentReportingEnabled:         bool(f.agentReportingEnabled,         true),
    botService:                    bool(f.botService,                    false),
    socialPlanner:                 bool(f.socialPlanner,                 true),
    bloggingEnabled:               bool(f.bloggingEnabled,               true),
    invoiceEnabled:                bool(f.invoiceEnabled,                true),
    affiliateManagerEnabled:       bool(f.affiliateManagerEnabled,       true),
    contentAiEnabled:              bool(f.contentAiEnabled,              true),
    refundsEnabled:                bool(f.refundsEnabled,                true),
    recordPaymentEnabled:          bool(f.recordPaymentEnabled,          true),
    cancelSubscriptionEnabled:     bool(f.cancelSubscriptionEnabled,     true),
    paymentsEnabled:               bool(f.paymentsEnabled,               true),
    communitiesEnabled:            bool(f.communitiesEnabled,            true),
    exportPaymentsEnabled:         bool(f.exportPaymentsEnabled,         true),
  };

  const toArr = v => Array.isArray(v) ? v : (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : null);
  const scopes = toArr(f.scopes || f.userScopes);
  const scopesAssignedToOnly = toArr(f.scopesAssignedToOnly);
  if (scopes?.length)               payload.scopes = scopes;
  if (scopesAssignedToOnly?.length) payload.scopesAssignedToOnly = scopesAssignedToOnly;

  const { data } = await axios.put(`${BASE}/users/${userId}`, payload, { headers: ghlHeaders(apiKey) });
  return { id: data.id || data.user?.id || userId };
}

async function updateContact(apiKey, contactId, payload) {
  const { data } = await axios.put(
    `${BASE}/contacts/${contactId}`,
    payload,
    { headers: ghlHeaders(apiKey) }
  );
  return data;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /action — health check
router.get('/', (req, res) => {
  res.json({
    status:  'ok',
    app:     'GHL Automator',
    actions: [
      'POST /action/create-location',
      'POST /action/create-user',
      'POST /action/enable-saas',
      'POST /action/get-saas-subscription',
      'POST /action/update-contact',
    ],
    docs: 'https://automator-subuser.vercel.app/action/{action-name}',
  });
});

// ── ACTION 1: Create Sub-Location ─────────────────────────────────────────────
// POST /action/create-location
//
// Required fields:
//   companyId            Account 2 company ID
//   locationName         Name for the new sub-location
//   locationEmail        Owner email
//
// Optional fields:
//   locationFirstName    locationLastName    locationPhone
//   locationAddress      locationCity        locationState
//   locationCountry      locationPostalCode  locationTimezone  locationWebsite
//   allowDuplicateContact  allowDuplicateOpportunity
//   allowFacebookNameMerge disableContactTimezone
//   sourceContactId      Contact on Account 1 to write new locationId back to
//   sourceCustomFieldId  Custom field ID to store the new locationId

router.get('/create-location', (req, res) => {
  res.json({
    action:  'create-location',
    webhook: 'POST /action/create-location',
    account: 'Account 2 (agency) — creates new sub-location',
    required: { locationId: 'trigger sub-location ID', callbackUrl: 'GHL callback URL', companyId: 'Account 2 company ID', name: 'sub-location name', 'prospectInfo.email': 'owner email' },
    optional: {
      'prospectInfo.firstName': '', 'prospectInfo.lastName': '',
      phone: '', city: '', state: '', country: 'default US', postalCode: '', timezone: '', website: '',
      'settings.allowDuplicateContact': 'false', 'settings.allowDuplicateOpportunity': 'false',
      'settings.allowFacebookNameMerge': 'false', 'settings.disableContactTimezone': 'false',
      sourceContactId: 'contact on Account 1 to write new locationId back to',
      sourceCustomFieldId: 'custom field ID to store new locationId',
    },
    callbackOutputs: { locationId: 'new sub-location ID', locationName: 'new sub-location name' },
  });
});

router.post('/create-location', async (req, res) => {
  console.log('[create-location] PAYLOAD:', JSON.stringify(req.body, null, 2));

  const triggerLocationId = sanitize(req.body.locationId, req, ['x-ghl-location-id', 'x-location-id']);
  const callbackUrl       = sanitize(req.body.callbackUrl, req, ['x-ghl-callback-url']);
  const { fields }        = req.body;

  console.log('[create-location] locationId:', triggerLocationId, '| callbackUrl:', callbackUrl);
  const { account1Key, account2Key } = await resolvePITs(req, triggerLocationId);

  console.log('[create-location] PITs resolved — account1Key:', !!account1Key, '| account2Key:', !!account2Key);

  if (!account1Key || !account2Key) {
    console.error('[create-location] Installation not found for locationId:', triggerLocationId);
    return res.status(200).json({
      received: true,
      error: 'Installation not found. Register at POST /install first.',
    });
  }

  // Support both GHL workflow fields array and direct JSON payload
  let raw;
  if (Array.isArray(fields) && fields.length) {
    raw = toMap(fields);
    console.log('[create-location] fields map:', JSON.stringify(raw, null, 2));
  } else {
    const b = req.body;
    raw = {
      companyId:           b.companyId,
      name:                b.name,
      phone:               b.phone,
      address:             b.address,
      city:                b.city,
      state:               b.state,
      country:             b.country,
      postalCode:          b.postalCode,
      timezone:            b.timezone,
      website:             b.website,
      firstName:           b.prospectInfo?.firstName ?? b.firstName,
      lastName:            b.prospectInfo?.lastName  ?? b.lastName,
      email:               b.prospectInfo?.email     ?? b.email,
      sourceContactId:     b.sourceContactId,
      sourceCustomFieldId: b.sourceCustomFieldId,
    };
  }

  // Normalize to internal field names (handles both key styles)
  const f = {
    companyId:           raw.companyId,
    locationName:        raw.name        || raw.locationName,
    locationPhone:       raw.phone       || raw.locationPhone,
    locationAddress:     raw.address     || raw.locationAddress,
    locationCity:        raw.city        || raw.locationCity,
    locationState:       raw.state       || raw.locationState,
    locationCountry:     raw.country     || raw.locationCountry,
    locationPostalCode:  raw.postalCode  || raw.locationPostalCode,
    locationTimezone:    raw.timezone    || raw.locationTimezone,
    locationWebsite:     raw.website     || raw.locationWebsite,
    locationFirstName:   raw.firstName   || raw.locationFirstName,
    locationLastName:    raw.lastName    || raw.locationLastName,
    locationEmail:       raw.email       || raw.locationEmail,
    sourceContactId:     raw.sourceContactId,
    sourceCustomFieldId: raw.sourceCustomFieldId,
    allowDuplicateContact:     raw.allowDuplicateContact     ?? 'false',
    allowDuplicateOpportunity: raw.allowDuplicateOpportunity ?? 'false',
    allowFacebookNameMerge:    raw.allowFacebookNameMerge    ?? 'false',
    disableContactTimezone:    raw.disableContactTimezone    ?? 'false',
  };

  console.log('[create-location] normalized fields:', JSON.stringify(f, null, 2));

  const missing = [];
  if (!f.companyId)    missing.push('companyId');
  if (!f.locationName) missing.push('name');
  if (!f.locationEmail)missing.push('email');

  if (missing.length) {
    const msg = `Missing required fields: ${missing.join(', ')}`;
    console.error('[create-location] Validation failed:', msg);
    res.status(200).json({ received: true, error: msg });
    await ghlCallback(callbackUrl, 400, msg);
    return;
  }

  console.log(`[create-location] Calling GHL — companyId=${f.companyId} name="${f.locationName}" email="${f.locationEmail}"`);
  try {
    const location = await createSubLocation(account2Key, f.companyId, f);
    console.log(`[create-location] SUCCESS — id=${location.id} name="${location.name}"`);

    if (f.sourceContactId && f.sourceCustomFieldId) {
      await updateContactCustomField(account1Key, f.sourceContactId, f.sourceCustomFieldId, location.id);
      console.log(`[create-location] Wrote locationId to custom field contactId=${f.sourceContactId} fieldId=${f.sourceCustomFieldId}`);
    }

    await ghlCallback(callbackUrl, 200, 'Sub-location created', {
      locationId:   location.id,
      locationName: location.name,
    });

    return res.status(200).json({ received: true, locationId: location.id });

  } catch (err) {
    const errData = err.response?.data;
    const msg = errData?.message || err.message;
    console.error('[create-location] GHL API ERROR:', JSON.stringify(errData || err.message));
    await ghlCallback(callbackUrl, 500, msg);
    return res.status(200).json({ received: true, error: msg });
  }
});

// ── ACTION 2: Create User ─────────────────────────────────────────────────────
// POST /action/create-user
//
// Required fields:
//   companyId      Account 2 company ID
//   locationId     Sub-location ID on Account 2 (from Action 1 output / custom field)
//   userFirstName  userLastName  userEmail  userPassword
//
// Optional fields:
//   userPhone  userRole (user|admin)  userType (account|agency)
//   profilePhoto  platformLanguage
//   userScopes  scopesAssignedToOnly
//   All permission flags (campaignsEnabled, contactsEnabled, etc.)

router.get('/create-user', (req, res) => {
  res.json({
    action:  'create-user',
    webhook: 'POST /action/create-user',
    account: 'Account 2 (agency) — creates user and assigns to sub-location',
    required: { locationId: 'trigger sub-location ID', callbackUrl: 'GHL callback URL', companyId: 'Account 2 company ID', firstName: '', lastName: '', email: '' },
    optional: {
      password: 'leave empty — server auto-generates 24-char secure password',
      locationIds: 'defaults to trigger locationId; map to {{action.create-location.locationId}}',
      phone: '', type: 'account', role: 'admin', platformLanguage: 'en_US',
      scopes: '', scopesAssignedToOnly: '',
      permissions: 'all permission flags (campaignsEnabled, contactsEnabled, etc.)',
    },
    callbackOutputs: { userId: 'new user ID', userEmail: '', password: 'the auto-generated password' },
  });
});

router.post('/create-user', async (req, res) => {
  console.log('[create-user] PAYLOAD:', JSON.stringify(req.body, null, 2));

  const triggerLocationId = sanitize(req.body.locationId, req, ['x-ghl-location-id', 'x-location-id']);
  const callbackUrl       = sanitize(req.body.callbackUrl, req, ['x-ghl-callback-url']);
  const { fields }        = req.body;

  console.log('[create-user] locationId:', triggerLocationId, '| callbackUrl:', callbackUrl);
  const { account1Key, account2Key } = await resolvePITs(req, triggerLocationId);

  console.log('[create-user] PITs resolved — account1Key:', !!account1Key, '| account2Key:', !!account2Key);

  if (!account1Key || !account2Key) {
    console.error('[create-user] Installation not found for locationId:', triggerLocationId);
    return res.status(200).json({
      received: true,
      error: 'Installation not found. Register at POST /install first.',
    });
  }

  // Support both GHL workflow fields array and direct JSON payload
  let f;
  if (Array.isArray(fields) && fields.length) {
    const raw = toMap(fields);
    console.log('[create-user] fields map:', JSON.stringify(raw, null, 2));
    f = {
      companyId:   raw.companyId,
      firstName:   raw.firstName,
      lastName:    raw.lastName,
      email:       raw.email,
      password:    raw.password,
      phone:       raw.phone,
      type:        raw.type,
      role:        raw.role,
      locationIds: raw.locationIds || raw.locationId,
      platformLanguage: raw.platformLanguage,
      scopes:           raw.scopes,
      scopesAssignedToOnly: raw.scopesAssignedToOnly,
      ...raw,
    };
  } else {
    const b = req.body;
    f = {
      companyId:        b.companyId,
      firstName:        b.firstName,
      lastName:         b.lastName,
      email:            b.email,
      password:         b.password,
      phone:            b.phone,
      type:             b.type,
      role:             b.role,
      locationIds:      b.locationIds,
      platformLanguage: b.platformLanguage,
      scopes:           b.scopes,
      scopesAssignedToOnly: b.scopesAssignedToOnly,
      sourceContactId:  b.sourceContactId,
      passwordFieldId:  b.passwordFieldId,
      ...b.permissions,
    };
  }

  // Auto-generate password if not provided
  if (!f.password) f.password = generatePassword(24);

  console.log('[create-user] normalized fields:', JSON.stringify(f, null, 2));

  const missing = [];
  if (!f.companyId)  missing.push('companyId');
  if (!f.firstName)  missing.push('firstName');
  if (!f.lastName)   missing.push('lastName');
  if (!f.email)      missing.push('email');
  if (!f.locationIds && !triggerLocationId) missing.push('locationIds');

  if (missing.length) {
    const msg = `Missing required fields: ${missing.join(', ')}`;
    console.error('[create-user] Validation failed:', msg);
    res.status(200).json({ received: true, error: msg });
    await ghlCallback(callbackUrl, 400, msg);
    return;
  }

  res.status(200).json({ received: true });
  const locationIds = f.locationIds || triggerLocationId;

  waitUntil((async () => {
    console.log(`[create-user] Calling GHL — email="${f.email}" companyId=${f.companyId} locationIds=${JSON.stringify(locationIds)}`);
    try {
      let user;
      let action = 'created';

      try {
        user = await createUser(account2Key, f.companyId, locationIds, f);
        console.log(`[create-user] SUCCESS — id=${user.id} email=${user.email}`);
      } catch (createErr) {
        const status = createErr.response?.status;
        const errMsg = createErr.response?.data?.message || '';
        if (status === 400 && errMsg.toLowerCase().includes('already exists')) {
          console.log(`[create-user] User already exists — finding and updating email="${f.email}"`);
          const existing = await findUserByEmail(account2Key, f.companyId, f.email);
          const updated  = await updateExistingUser(account2Key, existing.id, f.companyId, locationIds, f);
          user   = { id: updated.id, email: f.email };
          action = 'updated';
          console.log(`[create-user] UPDATED existing user — id=${user.id}`);
        } else {
          throw createErr;
        }
      }

      if (f.sourceContactId && f.passwordFieldId) {
        await updateContactCustomField(account1Key, f.sourceContactId, f.passwordFieldId, f.password);
        console.log(`[create-user] Wrote password to contact field contactId=${f.sourceContactId} fieldId=${f.passwordFieldId}`);
      }

      await ghlCallback(callbackUrl, 200, `User ${action}`, {
        userId:    user.id,
        userEmail: user.email,
        password:  f.password,
        action,
        locationIds,
      });

    } catch (err) {
      const errData = err.response?.data;
      const msg = errData?.message || err.message;
      console.error('[create-user] GHL API ERROR:', JSON.stringify(errData || err.message));
      await ghlCallback(callbackUrl, 500, msg);
    }
  })());
});

// ── ACTION 3: Update Contact on Origin Sub-Location ───────────────────────────
// POST /action/update-contact
//
// Finds a contact by email on Account 1 and updates custom fields + DND.
//
// Required fields:
//   email        Contact email to search for
//   locationId   Sub-location ID on Account 1 (where the contact lives)
//
// Optional fields:
//   dnd          true/false
//   customFields Array of { id, key, field_value } or { id, value }

router.get('/update-contact', (req, res) => {
  res.json({
    action:  'update-contact',
    webhook: 'POST /action/update-contact',
    account: 'Account 1 (sub-location) — finds contact by email+locationId, updates fields',
    required: { locationId: 'sub-location where contact lives (Account 1)', callbackUrl: 'GHL callback URL', email: 'contact email — must match exactly' },
    optional: {
      subaccountId: 'written to subaccount_id custom field (map to {{action.create-location.locationId}})',
      dnd: 'true / false',
      customFields: 'array of { id, key, value }',
    },
    callbackOutputs: { contactId: '', email: '', locationId: '' },
  });
});

router.post('/update-contact', async (req, res) => {
  console.log('[update-contact] PAYLOAD:', JSON.stringify(req.body, null, 2));

  const triggerLocationId = sanitize(req.body.locationId, req, ['x-ghl-location-id', 'x-location-id']);
  const callbackUrl       = sanitize(req.body.callbackUrl, req, ['x-ghl-callback-url']);
  const { fields }        = req.body;

  console.log('[update-contact] locationId:', triggerLocationId, '| callbackUrl:', callbackUrl);
  const { account1Key } = await resolvePITs(req, triggerLocationId);

  console.log('[update-contact] PITs resolved — account1Key:', !!account1Key);

  if (!account1Key) {
    console.error('[update-contact] Installation not found for locationId:', triggerLocationId);
    return res.status(200).json({
      received: true,
      error: 'Installation not found. Register at POST /install first.',
    });
  }

  // Support both fields array and direct JSON payload
  let email, locationId, dnd, customFields;

  if (Array.isArray(fields) && fields.length) {
    const raw = toMap(fields);
    console.log('[update-contact] fields map:', JSON.stringify(raw, null, 2));
    email      = raw.email;
    locationId = raw.locationId || triggerLocationId;
    dnd        = raw.dnd;

    customFields = [];
    if (raw.subaccountId) customFields.push({ key: 'subaccount_id', value: raw.subaccountId });
    if (raw.passwordFieldId && raw.password) customFields.push({ id: raw.passwordFieldId, value: raw.password });
    if (!customFields.length && raw.customFields) customFields = raw.customFields;
  } else {
    const b    = req.body;
    email      = b.email;
    locationId = b.locationId || triggerLocationId;
    dnd        = b.dnd;

    customFields = [];
    if (b.subaccountId) customFields.push({ key: 'subaccount_id', value: b.subaccountId });
    if (b.passwordFieldId && b.password) customFields.push({ id: b.passwordFieldId, value: b.password });
    if (!customFields.length && Array.isArray(b.customFields)) customFields = b.customFields;
  }

  console.log('[update-contact] email:', email, '| locationId:', locationId, '| dnd:', dnd, '| customFields:', JSON.stringify(customFields));

  const missing = [];
  if (!email)      missing.push('email');
  if (!locationId) missing.push('locationId');

  if (missing.length) {
    const msg = `Missing required fields: ${missing.join(', ')}`;
    console.error('[update-contact] Validation failed:', msg);
    res.status(200).json({ received: true, error: msg });
    await ghlCallback(callbackUrl, 400, msg);
    return;
  }

  res.status(200).json({ received: true });

  waitUntil((async () => {
    console.log(`[update-contact] Searching contact — email="${email}" locationId=${locationId}`);
    try {
      const contact = await findContactByEmail(account1Key, locationId, email);
      console.log(`[update-contact] Found contactId=${contact.id}`);

      const normalizedFields = Array.isArray(customFields)
        ? customFields.map(f => ({ id: f.id, key: f.key, value: f.field_value ?? f.value }))
        : [];

      const updatePayload = {};
      if (normalizedFields.length) updatePayload.customFields = normalizedFields;
      if (dnd !== undefined && dnd !== null && dnd !== '') {
        updatePayload.dnd = dnd === 'false' ? false : Boolean(dnd);
      }

      console.log('[update-contact] Update payload:', JSON.stringify(updatePayload));
      await updateContact(account1Key, contact.id, updatePayload);
      console.log(`[update-contact] SUCCESS — contactId=${contact.id}`);

      await ghlCallback(callbackUrl, 200, 'Contact updated', {
        contactId: contact.id,
        email,
        locationId,
      });

    } catch (err) {
      const errData = err.response?.data;
      const msg = errData?.message || err.message;
      console.error('[update-contact] GHL API ERROR:', JSON.stringify(errData || err.message));
      await ghlCallback(callbackUrl, 500, msg);
    }
  })());
});

// ── ACTION 4: Get SaaS Subscription Details ───────────────────────────────────
// POST /action/get-saas-subscription
//
// Required fields:
//   companyId          Account 2 company ID
//   targetLocationId   The sub-account whose subscription to fetch
//
// Returns subscription details in the GHL callback output

router.get('/get-saas-subscription', (req, res) => {
  res.json({
    action:  'get-saas-subscription',
    webhook: 'POST /action/get-saas-subscription',
    account: 'Account 2 (agency) — fetches SaaS subscription details for a sub-account',
    required: {
      locationId:       'trigger sub-location ID (Account 1)',
      callbackUrl:      'GHL callback URL',
      targetLocationId: 'sub-account to fetch subscription for',
      companyId:        'Account 2 company ID',
    },
    callbackOutputs: {
      locationId:       'the sub-account queried',
      subscriptionId:   '',
      planId:           '',
      priceId:          '',
      status:           '',
      trialDays:        '',
      stripeCustomerId: '',
    },
  });
});

router.post('/get-saas-subscription', async (req, res) => {
  console.log('[get-saas-subscription] PAYLOAD:', JSON.stringify(req.body, null, 2));

  const triggerLocationId = sanitize(req.body.locationId, req, ['x-ghl-location-id', 'x-location-id']);
  const callbackUrl       = sanitize(req.body.callbackUrl, req, ['x-ghl-callback-url']);
  const { fields }        = req.body;

  console.log('[get-saas-subscription] locationId:', triggerLocationId, '| callbackUrl:', callbackUrl);
  const { account2Key } = await resolvePITs(req, triggerLocationId);

  if (!account2Key) {
    console.error('[get-saas-subscription] Installation not found for locationId:', triggerLocationId);
    return res.status(200).json({ received: true, error: 'Installation not found. Register at POST /install first.' });
  }

  let f;
  if (Array.isArray(fields) && fields.length) {
    f = toMap(fields);
    console.log('[get-saas-subscription] fields map:', JSON.stringify(f, null, 2));
  } else {
    const b = req.body;
    f = {
      targetLocationId: b.targetLocationId || b.subLocationId,
      companyId:        b.companyId,
    };
  }

  const missing = [];
  if (!f.targetLocationId) missing.push('targetLocationId');
  if (!f.companyId)        missing.push('companyId');

  if (missing.length) {
    const msg = `Missing required fields: ${missing.join(', ')}`;
    console.error('[get-saas-subscription] Validation failed:', msg);
    res.status(200).json({ received: true, error: msg });
    await ghlCallback(callbackUrl, 400, msg);
    return;
  }

  console.log(`[get-saas-subscription] Calling GHL — targetLocationId=${f.targetLocationId} companyId=${f.companyId}`);

  res.status(200).json({ received: true });

  waitUntil((async () => {
    try {
      const { data } = await axios.get(
        `${BASE}/saas/get-saas-subscription/${f.targetLocationId}`,
        {
          headers: {
            Authorization: `Bearer ${account2Key}`,
            Version:       'v3',
          },
          params: { companyId: f.companyId },
        }
      );

      console.log(`[get-saas-subscription] SUCCESS — locationId=${f.targetLocationId}`, JSON.stringify(data));

      await ghlCallback(callbackUrl, 200, 'Subscription details fetched', {
        locationId:       f.targetLocationId,
        subscriptionId:   data.subscriptionId   || data.id        || '',
        planId:           data.planId           || data.saasPlanId || '',
        priceId:          data.priceId          || '',
        status:           data.status           || '',
        trialDays:        data.trialDays        ?? '',
        stripeCustomerId: data.stripeCustomerId  || '',
        raw:              data,
      });

    } catch (err) {
      const errData = err.response?.data;
      const msg = errData?.message || err.message;
      console.error('[get-saas-subscription] GHL API ERROR:', JSON.stringify(errData || err.message));
      await ghlCallback(callbackUrl, 500, msg);
    }
  })());
});

// ── ACTION 5: Enable SaaS for Sub-Account ──────────────────────────────────────
// POST /action/enable-saas
//
// Required fields:
//   companyId          Account 2 company ID
//   targetLocationId   The sub-account to enable SaaS on (from create-location output)
//   isSaaSV2           true for SaaS V2 (recommended), false for V1
//
// SaaS V2 additional fields:
//   contactId          Agency sub-account used for payment provider integration
//   providerLocationId Agency sub-account ID
//
// SaaS V1 additional fields:
//   stripeAccountId    stripe account id
//   name               stripe customer name
//   email              stripe customer email
//   stripeCustomerId   existing stripe customer id (optional)
//
// Optional:
//   saasPlanId         pre-configure saas subscription plan
//   priceId            pre-configure saas subscription price
//   description

router.get('/enable-saas', (req, res) => {
  res.json({
    action:  'enable-saas',
    webhook: 'POST /action/enable-saas',
    account: 'Account 2 (agency) — enables SaaS on a sub-account',
    note:    'Requires Agency Pro ($497) plan. Uses Version: v3.',
    required: {
      locationId:       'trigger sub-location ID (Account 1)',
      callbackUrl:      'GHL callback URL',
      targetLocationId: 'sub-account to enable SaaS on (map to {{action.create-location.locationId}})',
      companyId:        'Account 2 company ID',
      isSaaSV2:         'true (SaaS V2) or false (SaaS V1)',
    },
    optionalV2: { contactId: '', providerLocationId: '' },
    optionalV1: { stripeAccountId: '', name: '', email: '', stripeCustomerId: '' },
    optionalBoth: { saasPlanId: '', priceId: '', description: '' },
    callbackOutputs: { locationId: 'the sub-account that was enabled', isSaaSV2: '' },
  });
});

router.post('/enable-saas', async (req, res) => {
  console.log('[enable-saas] PAYLOAD:', JSON.stringify(req.body, null, 2));

  const triggerLocationId = sanitize(req.body.locationId, req, ['x-ghl-location-id', 'x-location-id']);
  const callbackUrl       = sanitize(req.body.callbackUrl, req, ['x-ghl-callback-url']);
  const { fields }        = req.body;

  console.log('[enable-saas] locationId:', triggerLocationId, '| callbackUrl:', callbackUrl);
  const { account2Key } = await resolvePITs(req, triggerLocationId);

  if (!account2Key) {
    console.error('[enable-saas] Installation not found for locationId:', triggerLocationId);
    return res.status(200).json({ received: true, error: 'Installation not found. Register at POST /install first.' });
  }

  // Support both fields array and direct JSON
  let f;
  if (Array.isArray(fields) && fields.length) {
    f = toMap(fields);
    console.log('[enable-saas] fields map:', JSON.stringify(f, null, 2));
  } else {
    const b = req.body;
    f = {
      targetLocationId:  b.targetLocationId  || b.subLocationId,
      companyId:         b.companyId,
      isSaaSV2:          b.isSaaSV2,
      contactId:         b.contactId,
      providerLocationId:b.providerLocationId,
      stripeAccountId:   b.stripeAccountId,
      name:              b.name,
      email:             b.email,
      stripeCustomerId:  b.stripeCustomerId,
      saasPlanId:        b.saasPlanId,
      priceId:           b.priceId,
      description:       b.description,
    };
  }

  const isSaaSV2 = f.isSaaSV2 === true || String(f.isSaaSV2).toLowerCase() === 'true';

  const missing = [];
  if (!f.targetLocationId) missing.push('targetLocationId');
  if (!f.companyId)        missing.push('companyId');
  if (f.isSaaSV2 === undefined || f.isSaaSV2 === null || f.isSaaSV2 === '') missing.push('isSaaSV2');

  if (!isSaaSV2) {
    if (!f.stripeAccountId) missing.push('stripeAccountId (required for SaaS V1)');
    if (!f.name)            missing.push('name (required for SaaS V1)');
    if (!f.email)           missing.push('email (required for SaaS V1)');
  }

  if (missing.length) {
    const msg = `Missing required fields: ${missing.join(', ')}`;
    console.error('[enable-saas] Validation failed:', msg);
    res.status(200).json({ received: true, error: msg });
    await ghlCallback(callbackUrl, 400, msg);
    return;
  }

  console.log(`[enable-saas] Calling GHL — targetLocationId=${f.targetLocationId} isSaaSV2=${isSaaSV2}`);

  const payload = compact({
    companyId:          f.companyId,
    isSaaSV2,
    // V2 fields
    contactId:          isSaaSV2 ? f.contactId          : undefined,
    providerLocationId: isSaaSV2 ? f.providerLocationId : undefined,
    // V1 fields
    stripeAccountId:    !isSaaSV2 ? f.stripeAccountId   : undefined,
    name:               !isSaaSV2 ? f.name               : undefined,
    email:              !isSaaSV2 ? f.email              : undefined,
    stripeCustomerId:   !isSaaSV2 ? f.stripeCustomerId   : undefined,
    // Optional both
    saasPlanId:         f.saasPlanId   || undefined,
    priceId:            f.priceId      || undefined,
    description:        f.description  || undefined,
  });

  res.status(200).json({ received: true });

  waitUntil((async () => {
    try {
      const { data } = await axios.post(
        `${BASE}/saas/enable-saas/${f.targetLocationId}`,
        payload,
        {
          headers: {
            Authorization:  `Bearer ${account2Key}`,
            Version:        'v3',
            'Content-Type': 'application/json',
          },
        }
      );

      console.log(`[enable-saas] SUCCESS — locationId=${f.targetLocationId}`, JSON.stringify(data));

      await ghlCallback(callbackUrl, 200, 'SaaS enabled', {
        locationId: f.targetLocationId,
        isSaaSV2,
      });

    } catch (err) {
      const errData = err.response?.data;
      const msg = errData?.message || err.message;
      console.error('[enable-saas] GHL API ERROR:', JSON.stringify(errData || err.message));
      await ghlCallback(callbackUrl, 500, msg);
    }
  })());
});

module.exports = router;
