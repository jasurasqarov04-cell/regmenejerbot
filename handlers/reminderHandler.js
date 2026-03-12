const NodeCache = require('node-cache');
const { dealActionsKeyboard } = require('../utils/keyboards');

const cache = new NodeCache({ checkperiod: 30 });

const REMIND_OPTIONS = {
  '30m':      { label: 'Через 30 мин',  ms: 30 * 60 * 1000 },
  '1h':       { label: 'Через 1 час',   ms: 60 * 60 * 1000 },
  '2h':       { label: 'Через 2 часа',  ms: 2 * 60 * 60 * 1000 },
  '3h':       { label: 'Через 3 часа',  ms: 3 * 60 * 60 * 1000 },
  'tomorrow': { label: 'Завтра в 9:00', ms: null },
};

// ─── Callback: remind:{dealId}:{key} ─────────────────────────────────────────
async function handleRemindButton(ctx, bot) {
  const parts    = ctx.callbackQuery.data.split(':');
  const dealId   = parts[1];
  const key      = parts[2];

  if (key === 'none') {
    await ctx.editMessageText(
      `✅ Стадия сохранена — сделка *#${dealId}*\n_Напоминание не установлено_`,
      { parse_mode: 'Markdown', ...dealActionsKeyboard(dealId) }
    );
    return ctx.answerCbQuery('Без напоминания');
  }

  const opt = REMIND_OPTIONS[key];
  if (!opt) return ctx.answerCbQuery('❌ Неверный вариант');

  // Считаем задержку
  let delayMs;
  let timeLabel;
  if (key === 'tomorrow') {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    delayMs   = t.getTime() - Date.now();
    timeLabel = `завтра в 09:00`;
  } else {
    delayMs   = opt.ms;
    timeLabel = opt.label.toLowerCase();
  }

  const remindAt  = new Date(Date.now() + delayMs);
  const chatId    = ctx.chat.id;
  const cacheKey  = `${ctx.from.id}_${dealId}`;

  // Отменяем предыдущее если было
  const prev = cache.get(cacheKey);
  if (prev) clearTimeout(prev.timerId);

  const timerId = setTimeout(async () => {
    try {
      await bot.telegram.sendMessage(
        chatId,
        `🔔 *НАПОМИНАНИЕ*\n\n` +
        `📋 Сделка *#${dealId}*\n` +
        `⚠️ Время выйти на связь с клиентом!`,
        { parse_mode: 'Markdown', ...dealActionsKeyboard(dealId) }
      );
    } catch (err) {
      console.error(`[Reminder] Ошибка отправки #${dealId}:`, err.message);
    }
    cache.del(cacheKey);
  }, delayMs);

  cache.set(cacheKey, { timerId, remindAt }, Math.ceil(delayMs / 1000) + 60);

  const timeStr = remindAt.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  await ctx.editMessageText(
    `✅ Стадия сохранена — сделка *#${dealId}*\n\n` +
    `🔔 Напоминание: *${timeLabel}*\n` +
    `⏱ Срабатывает: *${timeStr}*`,
    { parse_mode: 'Markdown', ...dealActionsKeyboard(dealId) }
  );

  await ctx.answerCbQuery(`✅ Напомню ${timeLabel}`);
  console.log(`[Reminder] Сделка #${dealId} → ${timeLabel}`);
}

module.exports = { handleRemindButton };
