const { getDeal, getContact } = require('../bitrix');
const { formatNewDealNotification, formatDealCard } = require('../utils/formatter');
const { getChatIdByDeal, getRegionLabelByDeal } = require('../utils/regions');
const { dealActionsKeyboard } = require('../utils/keyboards');
const { setDeal } = require('../sessions/sessionManager');

// ─── Отправить карточку сделки в Telegram-группу региона ─────────────────────
async function sendDealToRegion(bot, deal) {
  const chatId = getChatIdByDeal(deal);

  if (!chatId) {
    console.warn(`[Notifier] Нет chat_id для сделки #${deal.ID} (поле региона: ${deal['UF_CRM_6750379924C59']})`);
    return false;
  }

  const regionLabel = getRegionLabelByDeal(deal);

  // Загружаем контакт если есть
  let contact = null;
  if (deal.CONTACT_ID) {
    try { contact = await getContact(deal.CONTACT_ID); } catch (_) {}
  }

  const text     = formatNewDealNotification(deal, contact, regionLabel);
  const keyboard = dealActionsKeyboard(deal.ID);

  try {
    await bot.telegram.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
    console.log(`[Notifier] Сделка #${deal.ID} → ${regionLabel} (${chatId})`);
    return true;
  } catch (err) {
    console.error(`[Notifier] Ошибка отправки в ${chatId}:`, err.message);
    return false;
  }
}

// ─── Показать полную карточку сделки по запросу менеджера ────────────────────
async function showDealCard(ctx, dealId) {
  const loading = await ctx.reply('⏳ Загружаю сделку...');

  try {
    const deal = await getDeal(dealId);
    if (!deal) return ctx.reply('❌ Сделка не найдена.');

    // Проверяем что это воронка 32
    if (String(deal.CATEGORY_ID) !== '32') {
      return ctx.reply('❌ Эта сделка не из воронки региональных менеджеров.');
    }

    let contact = null;
    if (deal.CONTACT_ID) {
      try { contact = await getContact(deal.CONTACT_ID); } catch (_) {}
    }

    setDeal(ctx.from.id, dealId);

    const text = formatDealCard(deal, contact);
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...dealActionsKeyboard(dealId),
    });
  } catch (err) {
    console.error(`[Notifier] showDealCard #${dealId}:`, err.message);
    await ctx.reply('❌ Ошибка загрузки сделки.');
  }
}

// ─── Поиск сделок по названию ─────────────────────────────────────────────────
async function searchDeals(ctx, query) {
  const { getDeals } = require('../bitrix');
  const { Markup } = require('telegraf');

  await ctx.reply('🔍 Ищу...');

  try {
    const deals = await getDeals(
      { '%TITLE': query },
      ['ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY']
    );

    if (!deals.length) return ctx.reply(`❌ Сделки по запросу "${query}" не найдены.`);

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
