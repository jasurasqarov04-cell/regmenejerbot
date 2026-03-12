const { getDeal, getContact } = require('../bitrix');
const { formatNewDealNotification, formatDealCard } = require('../utils/formatter');
const { dealActionsKeyboard } = require('../utils/keyboards');
const { setDeal, trackActivity, getSession } = require('../sessions/sessionManager');
const config = require('../config');

// ─── Отправить сделку всем менеджерам региона лично ──────────────────────────
async function sendDealToRegion(bot, deal) {
  const fieldValue = deal[config.pipeline.regionField];
  const regionKey  = config.getRegionKeyByFieldValue(fieldValue);

  if (!regionKey) {
    console.warn(`[Notifier] Нет региона для сделки #${deal.ID} (поле: ${fieldValue})`);
    return false;
  }

  const regionLabel  = config.getRegionLabel(regionKey);
  const managerIds   = config.getManagersByRegion(regionKey);

  if (!managerIds.length) {
    console.warn(`[Notifier] Нет менеджеров для региона ${regionKey}`);
    return false;
  }

  // Загружаем контакт
  let contact = null;
  if (deal.CONTACT_ID) {
    try { contact = await getContact(deal.CONTACT_ID); } catch (_) {}
  }

  const text     = formatNewDealNotification(deal, contact, regionLabel);
  const keyboard = dealActionsKeyboard(deal.ID);

  // Отправляем каждому менеджеру региона лично
  let sent = 0;
  for (const telegramId of managerIds) {
    try {
      await bot.telegram.sendMessage(telegramId, text, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      sent++;
      console.log(`[Notifier] Сделка #${deal.ID} → менеджер ${telegramId} (${regionLabel})`);
    } catch (err) {
      console.error(`[Notifier] Не удалось отправить менеджеру ${telegramId}:`, err.message);
      const { logError } = require('../sessions/sessionManager');
      logError('Notifier', `Сделка #${deal.ID} → ${telegramId}: ${err.message}`);
    }
  }

  return sent > 0;
}

// ─── Показать карточку сделки ─────────────────────────────────────────────────
async function showDealCard(ctx, dealId) {
  await ctx.reply('⏳ Загружаю сделку...');

  try {
    const deal = await getDeal(dealId);
    if (!deal) return ctx.reply('❌ Сделка не найдена.');
    if (String(deal.CATEGORY_ID) !== '32') {
      return ctx.reply('❌ Эта сделка не из воронки региональных менеджеров.');
    }

    let contact = null;
    if (deal.CONTACT_ID) {
      try { contact = await getContact(deal.CONTACT_ID); } catch (_) {}
    }

    setDeal(ctx.from.id, dealId);

    // Берём последний комментарий из сессии если есть
    const session     = getSession(ctx.from.id);
    const lastComment = session[`comment_${dealId}`] || null;

    await ctx.reply(formatDealCard(deal, contact, lastComment), {
      parse_mode: 'Markdown',
      ...dealActionsKeyboard(dealId),
    });
  } catch (err) {
    console.error(`[Notifier] showDealCard #${dealId}:`, err.message);
    const { logError } = require('../sessions/sessionManager');
    logError('showDealCard', `#${dealId}: ${err.message}`);
    await ctx.reply('❌ Ошибка загрузки сделки.');
  }
}

// ─── Поиск сделок ─────────────────────────────────────────────────────────────
async function searchDeals(ctx, query) {
  const { getDeals } = require('../bitrix');
  const { Markup }   = require('telegraf');

  await ctx.reply('🔍 Ищу...');

  try {
    const deals = await getDeals({ '%TITLE': query }, ['ID', 'TITLE', 'STAGE_ID']);
    if (!deals.length) return ctx.reply(`❌ Ничего не найдено по запросу "${query}"`);

    const { formatStage } = require('../utils/formatter');
    const buttons = deals.slice(0, 10).map((d) => [
      Markup.button.callback(
        `#${d.ID} — ${d.TITLE || 'Без названия'} ${formatStage(d.STAGE_ID)}`,
        `actions:${d.ID}:refresh`
      ),
    ]);

    await ctx.reply(
      `🔍 Найдено: ${deals.length}${deals.length > 10 ? ' (первые 10)' : ''}`,
      Markup.inlineKeyboard(buttons)
    );
  } catch (err) {
    console.error('[Notifier] searchDeals:', err.message);
    await ctx.reply('❌ Ошибка поиска.');
  }
}

module.exports = { sendDealToRegion, showDealCard, searchDeals };
