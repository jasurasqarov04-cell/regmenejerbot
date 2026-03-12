const config = require('../config');

// ─── Форматирование суммы в UZS ───────────────────────────────────────────────
function formatAmount(amount) {
  if (!amount || amount === '0') return '—';
  return Number(amount).toLocaleString('ru-RU') + ' сум';
}

// ─── Форматирование даты ──────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Стадия сделки с эмодзи ───────────────────────────────────────────────────
function formatStage(stageId) {
  const stage = config.pipeline.stageById[stageId];
  if (stage) return `${stage.emoji} ${stage.name}`;
  return `📋 ${stageId}`;
}

// ─── Полная карточка сделки ───────────────────────────────────────────────────
function formatDealCard(deal, contact = null) {
  const title    = deal.TITLE || `Сделка #${deal.ID}`;
  const stage    = formatStage(deal.STAGE_ID);
  const amount   = formatAmount(deal.OPPORTUNITY);
  const created  = formatDate(deal.DATE_CREATE);
  const modified = formatDate(deal.DATE_MODIFY);

  // Регион из поля
  const regionFieldVal = deal[config.pipeline.regionField];
  const regionKey   = config.getRegionKeyByFieldValue(regionFieldVal);
  const regionLabel = regionKey ? config.getRegionLabel(regionKey) : '—';

  let text =
    `📋 *Сделка #${deal.ID}*\n` +
    `📝 *Название:* ${esc(title)}\n` +
    `📊 *Стадия:* ${stage}\n` +
    `📍 *Регион:* ${regionLabel}\n` +
    `💰 *Сумма:* ${amount}\n` +
    `📅 *Создана:* ${created}\n` +
    `🔄 *Обновлена:* ${modified}\n`;

  if (contact) {
    const name  = [contact.NAME, contact.LAST_NAME].filter(Boolean).join(' ');
    const phone = contact.PHONE?.[0]?.VALUE || '—';
    text +=
      `\n👤 *Контакт:* ${esc(name)}\n` +
      `📞 *Телефон:* ${esc(phone)}\n`;
  }

  if (deal.COMMENTS) {
    text += `\n💬 *Комментарий:* ${esc(deal.COMMENTS)}\n`;
  }

  return text;
}

// ─── Уведомление о новой сделке (короткое) ────────────────────────────────────
function formatNewDealNotification(deal, contact, regionLabel) {
  const title  = deal.TITLE || `Сделка #${deal.ID}`;
  const amount = formatAmount(deal.OPPORTUNITY);
  const phone  = contact?.PHONE?.[0]?.VALUE || '—';
  const name   = contact
    ? [contact.NAME, contact.LAST_NAME].filter(Boolean).join(' ')
    : '—';

  return (
    `🔔 *НОВАЯ СДЕЛКА* ${regionLabel ? `— ${regionLabel}` : ''}\n\n` +
    `📋 *${esc(title)}*\n` +
    `👤 *Контакт:* ${esc(name)}\n` +
    `📞 *Телефон:* ${esc(phone)}\n` +
    `💰 *Сумма:* ${amount}\n` +
    `📅 *Создана:* ${formatDate(deal.DATE_CREATE)}`
  );
}

// ─── Экранирование Markdown ───────────────────────────────────────────────────
function esc(text) {
  if (!text) return '';
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

module.exports = {
  formatAmount,
  formatDate,
  formatStage,
  formatDealCard,
  formatNewDealNotification,
  esc,
};
