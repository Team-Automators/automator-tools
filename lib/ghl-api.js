// Shared GHL API wrapper used by the UI routes (locations, users, contacts).
// The /action endpoint has its own inline token handling because it works
// exclusively off companyId. This module resolves tokens from the session
// access token passed in directly (UI routes forward it from req.session).

const axios  = require('axios');

const BASE_URL    = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

function ghlHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Version: API_VERSION,
    'Content-Type': 'application/json',
  };
}

async function createLocation(token, payload) {
  const { data } = await axios.post(`${BASE_URL}/locations/`, payload, { headers: ghlHeaders(token) });
  return data;
}

async function updateLocation(token, locationId, payload) {
  const { data } = await axios.put(`${BASE_URL}/locations/${locationId}`, payload, { headers: ghlHeaders(token) });
  return data;
}

async function createUser(token, payload) {
  const { data } = await axios.post(`${BASE_URL}/users/`, payload, { headers: ghlHeaders(token) });
  return data;
}

async function updateUser(token, userId, payload) {
  const { data } = await axios.put(`${BASE_URL}/users/${userId}`, payload, { headers: ghlHeaders(token) });
  return data;
}

async function updateContact(token, contactId, payload) {
  const { data } = await axios.put(`${BASE_URL}/contacts/${contactId}`, payload, { headers: ghlHeaders(token) });
  return data;
}

module.exports = { createLocation, updateLocation, createUser, updateUser, updateContact };
