const express = require('express');
const api     = require('../lib/ghl-api');
const router  = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.accessToken) return res.redirect('/');
  next();
}

function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined));
}

router.get('/create', requireAuth, (req, res) => {
  res.render('create-location', { result: null, error: null });
});

router.post('/create', requireAuth, async (req, res) => {
  const { name, email, phone, address, city, state, country, postalCode, website, timezone, firstName, lastName } = req.body;

  const payload = clean({
    name, email, phone, address, city, state, country,
    postalCode, website, timezone, firstName, lastName,
    companyId: req.session.companyId,
  });

  try {
    const data = await api.createLocation(req.session.accessToken, payload);
    res.render('create-location', { result: data, error: null });
  } catch (err) {
    res.render('create-location', { result: null, error: err.response?.data?.message || err.message });
  }
});

router.get('/update', requireAuth, (req, res) => {
  res.render('update-location', { result: null, error: null, prefillId: req.session.locationId || '' });
});

router.post('/update', requireAuth, async (req, res) => {
  const { locationId, name, email, phone, address, city, state, country, postalCode, website, timezone, firstName, lastName } = req.body;

  if (!locationId) {
    return res.render('update-location', { result: null, error: 'Location ID is required.', prefillId: '' });
  }

  const payload = clean({ name, email, phone, address, city, state, country, postalCode, website, timezone, firstName, lastName });

  try {
    const data = await api.updateLocation(req.session.accessToken, locationId, payload);
    res.render('update-location', { result: data, error: null, prefillId: locationId });
  } catch (err) {
    res.render('update-location', { result: null, error: err.response?.data?.message || err.message, prefillId: locationId });
  }
});

module.exports = router;
