const { Redis } = require('@upstash/redis');

const clean = (val) => (val || '').replace(/^﻿/, '').trim();

const redis = new Redis({
  url:   clean(process.env.UPSTASH_REDIS_REST_URL),
  token: clean(process.env.UPSTASH_REDIS_REST_TOKEN),
});

module.exports = redis;
