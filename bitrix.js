const axios = require('axios');
const config = require('./config');

// ─── Базовый запрос с retry ───────────────────────────────────────────────────
async function bitrixRequest(method, params = {}, retries = 3) {
  const url = `${config.bitrix.webhookUrl}/${method}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(url, params, { timeout: 15000 });
      if (res.data?.error) throw new Error(res.data.error_description || res.data.error);
      return res.data;
    } catch (err) {
      console.error(`[Bitrix] ${method} попытка ${attempt}/${retries}: ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(attempt * 1000);
    }
  }
}

// ─── Пагинация — получить все записи ─────────────────────────────────────────
async function bitrixGetAll(method, params = {}) {
  const all = [];
  let start = 0;
  while (true) {
    const res = await bitrixRequest(method, { ...params, start });
    all.push(...(res.result || []));
    if (!res.next || !res.result?.length) break;
    start = res.next;
    await sleep(200);
  }
  return all;
}

// ─── Сделки ───────────────────────────────────────────────────────────────────

// Получить одну сделку по ID
async function getDeal(dealId) {
  const res = await bitrixRequest('crm.deal.get', { id: dealId });
  return res.result;
}

// Обновить поля сделки
async function updateDeal(dealId, fields) {
  const res = await bitrixRequest('crm.deal.update', { id: dealId, fields });
  return res.result;
}

// Сменить стадию сделки
async function setDealStage(dealId, stageId) {
  return updateDeal(dealId, { STAGE_ID: stageId });
}

// Обновить сумму, товар, комментарий
async function setDealDetails(dealId, { amount, product, comment }) {
  const fields = {};
  if (amount  !== undefined) fields.OPPORTUNITY = String(amount);
  if (product !== undefined) fields.TITLE       = product;
  if (comment !== undefined) fields.COMMENTS    = comment;
  return updateDeal(dealId, fields);
}

// Получить список сделок по воронке 32 с фильтром
async function getDeals(filter = {}, select = []) {
  return bitrixGetAll('crm.deal.list', {
    filter: { CATEGORY_ID: 32, ...filter },
    select: select.length ? select : [
      'ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY', 'CURRENCY_ID',
      'ASSIGNED_BY_ID', 'DATE_CREATE', 'DATE_MODIFY', 'COMMENTS',
      'CONTACT_ID', 'UF_CRM_6750379924C59',
    ],
  });
}

// Добавить комментарий в ленту сделки (timeline)
async function addDealComment(dealId, text, authorName) {
  const comment = authorName ? `👤 ${authorName}:\n${text}` : text;
  const res = await bitrixRequest('crm.timeline.comment.add', {
    fields: {
      ENTITY_ID:   dealId,
      ENTITY_TYPE: 'deal',
      COMMENT:     comment,
    },
  });
  return res.result;
}
async function getContact(contactId) {
  const res = await bitrixRequest('crm.contact.get', { id: contactId });
  return res.result;
}

// ─── Стадии воронки из Bitrix24 (для проверки) ────────────────────────────────
async function getPipelineStages() {
  const res = await bitrixRequest('crm.dealcategory.stages', { id: 32 });
  return res.result || [];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = {
  bitrixRequest,
  getDeal,
  updateDeal,
  setDealStage,
  setDealDetails,
  getDeals,
  addDealComment,
  getContact,
  getPipelineStages,
};
