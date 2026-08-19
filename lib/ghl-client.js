// Axios instance factory with interceptors.
// Every request automatically gets Authorization + Version headers.
// Every error response is normalized to a consistent shape.

const axios = require('axios');

const BASE        = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

function createClient(apiKey) {
  const client = axios.create({ baseURL: BASE });

  // Request interceptor — attach auth headers to every call
  client.interceptors.request.use((config) => {
    config.headers['Authorization'] = `Bearer ${apiKey}`;
    config.headers['Version']       = API_VERSION;
    if (config.data && !config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }
    return config;
  });

  // Response interceptor — normalize GHL errors
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const message = error.response?.data?.message || error.message || 'GHL API error';
      const status  = error.response?.status || 500;
      const err     = new Error(message);
      err.status    = status;
      err.data      = error.response?.data;
      return Promise.reject(err);
    }
  );

  return client;
}

module.exports = { createClient };
