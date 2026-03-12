const NodeCache = require('node-cache');

const cache     = new NodeCache({ stdTTL: 60 * 30, checkperiod: 60 });
const activityCache = new NodeCache({ stdTTL: 0 }); // без TTL — храним постоянно

const STEPS = {
  IDLE:         'idle',
  WAIT_AMOUNT:  'wait_amount',
  WAIT_COMMENT: 'wait_comment',
};

// ─── Сессия диалога ───────────────────────────────────────────────────────────
function getSession(userId) {
  return cache.get(String(userId)) || { dealId: null, step: STEPS.IDLE };
}
function setSession(userId, patch) {
  cache.set(String(userId), { ...getSession(userId), ...patch });
}
function clearSession(userId) { cache.del(String(userId)); }
function setStep(userId, step) { setSession(userId, { step }); }
function setDeal(userId, dealId) {
  setSession(userId, { dealId, step: STEPS.IDLE });
}

// ─── Активность менеджеров ────────────────────────────────────────────────────
function trackActivity(userId, username, firstName) {
  const key  = `activity_${userId}`;
  const prev = activityCache.get(key) || { dealsProcessed: 0, actionsCount: 0 };
  activityCache.set(key, {
    ...prev,
    userId:    String(userId),
    username:  username || null,
    firstName: firstName || null,
    lastSeen:  new Date().toISOString(),
  });
}

function trackDealProcessed(userId) {
  const key  = `activity_${userId}`;
  const prev = activityCache.get(key) || { dealsProcessed: 0, actionsCount: 0 };
  activityCache.set(key, { ...prev, dealsProcessed: (prev.dealsProcessed || 0) + 1 });
}

function trackAction(userId) {
  const key  = `activity_${userId}`;
  const prev = activityCache.get(key) || { dealsProcessed: 0, actionsCount: 0 };
  activityCache.set(key, { ...prev, actionsCount: (prev.actionsCount || 0) + 1 });
}

function getActivity(userId) {
  return activityCache.get(`activity_${userId}`) || null;
}

function getAllActivity() {
  const keys = activityCache.keys().filter((k) => k.startsWith('activity_'));
  return keys.map((k) => activityCache.get(k)).filter(Boolean);
}

// ─── Лог ошибок ───────────────────────────────────────────────────────────────
const errorLog = [];
function logError(context, message) {
  errorLog.unshift({ context, message, time: new Date().toISOString() });
  if (errorLog.length > 50) errorLog.pop(); // храним последние 50
}
function getErrorLog() { return errorLog.slice(0, 10); } // последние 10

module.exports = {
  STEPS,
  getSession, setSession, clearSession, setStep, setDeal,
  trackActivity, trackDealProcessed, trackAction,
  getActivity, getAllActivity,
  logError, getErrorLog,
};
