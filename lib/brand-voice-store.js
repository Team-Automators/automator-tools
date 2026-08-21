const isVercel = !!process.env.VERCEL;
let redis = null;
if (isVercel) redis = require('./redis');

const mem = { voices: {}, feedback: {}, sessions: {} };
const TTL = 90 * 24 * 3600; // 90 days
const MAX_FEEDBACK = 50;
const MAX_SESSION_MSGS = 200;
const SESSION_TTL = 30 * 24 * 3600; // 30 days

// Per-user scoping: brand voice, feedback, and the in-progress chat session are
// private to each user on a location. Falls back to a shared bucket if no user.
const U = (userId) => userId || '_shared';
const vKey = (loc, uid) => `brandvoice:${loc}:${U(uid)}`;
const fKey = (loc, uid) => `copyfeedback:${loc}:${U(uid)}`;
const sKey = (loc, uid, type) => `cwcsession:${loc}:${U(uid)}:${type}`;

async function getVoice(locationId, userId) {
  if (redis) return await redis.get(vKey(locationId, userId)) || null;
  return mem.voices[vKey(locationId, userId)] || null;
}

async function setVoice(locationId, userId, voice) {
  if (redis) await redis.set(vKey(locationId, userId), voice, { ex: TTL });
  else mem.voices[vKey(locationId, userId)] = voice;
}

async function clearVoice(locationId, userId) {
  if (redis) await redis.del(vKey(locationId, userId));
  else delete mem.voices[vKey(locationId, userId)];
}

async function getFeedback(locationId, userId) {
  if (redis) return (await redis.get(fKey(locationId, userId))) || [];
  return mem.feedback[fKey(locationId, userId)] || [];
}

async function addFeedback(locationId, userId, { type, text, sentiment }) {
  const list = await getFeedback(locationId, userId);
  list.unshift({ type, text: String(text).slice(0, 1200), sentiment, at: Date.now() });
  if (list.length > MAX_FEEDBACK) list.length = MAX_FEEDBACK;
  if (redis) await redis.set(fKey(locationId, userId), list, { ex: TTL });
  else mem.feedback[fKey(locationId, userId)] = list;
}

async function clearFeedback(locationId, userId) {
  if (redis) await redis.del(fKey(locationId, userId));
  else delete mem.feedback[fKey(locationId, userId)];
}

async function getSession(locationId, userId, type) {
  if (redis) return (await redis.get(sKey(locationId, userId, type))) || [];
  return mem.sessions[sKey(locationId, userId, type)] || [];
}

async function setSession(locationId, userId, type, messages) {
  const trimmed = messages.slice(-MAX_SESSION_MSGS);
  if (redis) await redis.set(sKey(locationId, userId, type), trimmed, { ex: SESSION_TTL });
  else mem.sessions[sKey(locationId, userId, type)] = trimmed;
}

module.exports = { getVoice, setVoice, clearVoice, getFeedback, addFeedback, clearFeedback, getSession, setSession };
