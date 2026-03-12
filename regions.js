const config = require('../config');

// ─── Получить ключ региона из сделки ─────────────────────────────────────────
function getRegionKeyByDeal(deal) {
  const fieldValue = deal[config.pipeline.regionField];
  if (!fieldValue) return null;
  return config.getRegionKeyByFieldValue(fieldValue);
}

// ─── Получить chat_id Telegram по сделке ─────────────────────────────────────
function getChatIdByDeal(deal) {
  const regionKey = getRegionKeyByDeal(deal);
  if (!regionKey) return null;
  return config.getChatIdByRegionKey(regionKey);
}

// ─── Читаемое название региона по сделке ─────────────────────────────────────
function getRegionLabelByDeal(deal) {
  const regionKey = getRegionKeyByDeal(deal);
  if (!regionKey) return null;
  return config.getRegionLabel(regionKey);
}

module.exports = {
  getRegionKeyByDeal,
  getChatIdByDeal,
  getRegionLabelByDeal,
};
