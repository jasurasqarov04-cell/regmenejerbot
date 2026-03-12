const NodeCache = require('node-cache');

// Сессия живёт 30 минут бездействия
const cache = new NodeCache({ stdTTL: 60 * 30, checkperiod: 60 });

const STEPS = {
  IDLE:         'idle',
  WAIT_AMOUNT:  'wait_amount',
  WAIT_PRODUCT: 'wait_product',
  WAIT_COMMENT: 'wait_comment',
};

function getSession(userId) {
  return cache.get(String(userId)) || { dealId: null, step: STEPS.IDLE, data: {} };
}

function setSession(userId, patch) {
  const current = getSession(userId);
  cache.set(String(userId), { ...current, ...patch });
}

function clearSession(userId) {
  cache.del(String(userId));
}

function setStep(userId, step) {
  setSession(userId, { step });
}

function setDeal(userId, dealId) {
  setSession(userId, { dealId, step: STEPS.IDLE, data: {} });
}

module.exports = { STEPS, getSession, setSession, clearSession, setStep, setDeal };
