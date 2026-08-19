const isVercel = !!process.env.VERCEL;
let redis = null;
if (isVercel) redis = require('./redis');

const mem = { voices: {}, feedback: {}, sessions: {} };
const TTL = 90 * 24 * 3600; // 90 days
const MAX_FEEDBACK = 50;
const MAX_SESSION_MSGS = 200;
const SESSION_TTL = 30 * 24 * 3600; // 30 days

async function getVoice(locationId) {
  if (redis) return await redis.get(`brandvoice:${locationId}`) || null;
  return mem.voices[locationId] || null;
}

async function setVoice(locationId, voice) {
  if (redis) await redis.set(`brandvoice:${locationId}`, voice, { ex: TTL });
  else mem.voices[locationId] = voice;
}

async function clearVoice(locationId) {
  if (redis) await redis.del(`brandvoice:${locationId}`);
  else delete mem.voices[locationId];
}

async function getFeedback(locationId) {
  if (redis) return (await redis.get(`copyfeedback:${locationId}`)) || [];
  return mem.feedback[locationId] || [];
}

async function addFeedback(locationId, { type, text, sentiment }) {
  const list = await getFeedback(locationId);
  list.unshift({ type, text: String(text).slice(0, 1200), sentiment, at: Date.now() });
  if (list.length > MAX_FEEDBACK) list.length = MAX_FEEDBACK;
  if (redis) await redis.set(`copyfeedback:${locationId}`, list, { ex: TTL });
  else mem.feedback[locationId] = list;
}

async function clearFeedback(locationId) {
  if (redis) await redis.del(`copyfeedback:${locationId}`);
  else delete mem.feedback[locationId];
}

async function getSession(locationId, type) {
  if (redis) return (await redis.get(`cwcsession:${locationId}:${type}`)) || [];
  return mem.sessions[`${locationId}:${type}`] || [];
}

async function setSession(locationId, type, messages) {
  const trimmed = messages.slice(-MAX_SESSION_MSGS);
  if (redis) await redis.set(`cwcsession:${locationId}:${type}`, trimmed, { ex: SESSION_TTL });
  else mem.sessions[`${locationId}:${type}`] = trimmed;
}

module.exports = { getVoice, setVoice, clearVoice, getFeedback, addFeedback, clearFeedback, getSession, setSession };