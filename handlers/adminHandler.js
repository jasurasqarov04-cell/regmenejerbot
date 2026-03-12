const config = require('../config');
const { getAllActivity, getErrorLog } = require('../sessions/sessionManager');
const { Markup } = require('telegraf');

// ─── Проверка прав администратора ────────────────────────────────────────────
function isAdmin(ctx) {
  return config.isAdmin(ctx.from.id);
}

// ─── /admin — главное меню ────────────────────────────────────────────────────
async function showAdminPanel(ctx) {
  if (!isAdmin(ctx)) {
    return ctx.reply('❌ У вас нет доступа к админ панели.');
  }

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('👥 Менеджеры и активность', 'admin:managers')],
    [Markup.button.callback('📊 Сделки по регионам',     'admin:deals')],
    [Markup.button.callback('⚠️ Ошибки бота',            'admin:errors')],
    [Markup.button.callback('🤖 Статус бота',            'admin:status')],
  ]);

  await ctx.reply(
    `🔧 *АДМИН ПАНЕЛЬ*\n\n` +
    `Выберите раздел:`,
    { parse_mode: 'Markdown', ...keyboard }
  );
}

// ─── Менеджеры и активность ───────────────────────────────────────────────────
async function showManagers(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Нет доступа');

  const allActivity = getAllActivity();
  const managers    = config.managers; // { telegramId: regionKey }

  let text = `👥 *МЕНЕДЖЕРЫ И АКТИВНОСТЬ*\n\n`;

  if (!Object.keys(managers).length) {
    text += '_Менеджеры не настроены в .env_';
  } else {
    // Группируем по регионам
    const byRegion = {};
    for (const [telegramId, regionKey] of Object.entries(managers)) {
      if (!byRegion[regionKey]) byRegion[regionKey] = [];
      const activity = allActivity.find((a) => a.userId === telegramId);
      byRegion[regionKey].push({ telegramId, activity });
    }

    for (const [regionKey, mgrs] of Object.entries(byRegion)) {
      text += `${config.getRegionLabel(regionKey)}\n`;
      for (const { telegramId, activity } of mgrs) {
        if (activity) {
          const name     = activity.firstName || activity.username || `ID ${telegramId}`;
          const lastSeen = formatTimeAgo(activity.lastSeen);
          const deals    = activity.dealsProcessed || 0;
          const actions  = activity.actionsCount || 0;
          text += `  👤 *${esc(name)}*\n`;
          text += `    🕐 Был: ${lastSeen}\n`;
          text += `    📋 Сделок обработано: *${deals}*\n`;
          text += `    🖱 Действий: *${actions}*\n`;
        } else {
          text += `  👤 ID ${telegramId} — _ещё не заходил_\n`;
        }
      }
      text += '\n';
    }
  }

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...backKeyboard(),
  });
  await ctx.answerCbQuery();
}

// ─── Сделки по регионам из Bitrix24 ──────────────────────────────────────────
async function showDeals(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Нет доступа');
  await ctx.answerCbQuery('⏳ Загружаю...');

  try {
    const { getDeals } = require('../bitrix');
    const { formatStage } = require('../utils/formatter');

    const deals = await getDeals({}, ['ID', 'STAGE_ID', 'UF_CRM_6750379924C59', 'OPPORTUNITY']);

    // Группируем по регионам
    const byRegion = {};
    for (const deal of deals) {
      const fieldVal  = deal[config.pipeline.regionField];
      const regionKey = config.getRegionKeyByFieldValue(fieldVal) || 'UNKNOWN';
      if (!byRegion[regionKey]) byRegion[regionKey] = { total: 0, won: 0, inWork: 0 };
      byRegion[regionKey].total++;
      const stage = config.pipeline.stageById[deal.STAGE_ID];
      if (stage?.won)  byRegion[regionKey].won++;
      else if (!stage?.lose) byRegion[regionKey].inWork++;
    }

    let text = `📊 *СДЕЛКИ ПО РЕГИОНАМ*\n`;
    text += `_Всего в воронке: ${deals.length}_\n\n`;

    for (const [regionKey, stats] of Object.entries(byRegion)) {
      const label = regionKey === 'UNKNOWN'
        ? '❓ Без региона'
        : config.getRegionLabel(regionKey);
      text += `${label}\n`;
      text += `  📋 Всего: *${stats.total}*  🟢 Продажа: *${stats.won}*  🔄 В работе: *${stats.inWork}*\n\n`;
    }

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...backKeyboard(),
    });
  } catch (err) {
    await ctx.editMessageText(`❌ Ошибка загрузки: ${err.message}`, backKeyboard());
  }
}

// ─── Ошибки бота ─────────────────────────────────────────────────────────────
async function showErrors(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Нет доступа');

  const errors = getErrorLog();
  let text = `⚠️ *ПОСЛЕДНИЕ ОШИБКИ БОТА*\n\n`;

  if (!errors.length) {
    text += '✅ Ошибок не зафиксировано';
  } else {
    for (const err of errors) {
      const time = new Date(err.time).toLocaleString('ru-RU');
      text += `🔴 *${esc(err.context)}*\n`;
      text += `${esc(err.message)}\n`;
      text += `_${time}_\n\n`;
    }
  }

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...backKeyboard(),
  });
  await ctx.answerCbQuery();
}

// ─── Статус бота ─────────────────────────────────────────────────────────────
async function showStatus(ctx) {
  if (!isAdmin(ctx)) return ctx.answerCbQuery('❌ Нет доступа');

  const uptime  = process.uptime();
  const hours   = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const mem     = process.memoryUsage();
  const managersCount = Object.keys(config.managers).length;

  let text =
    `🤖 *СТАТУС БОТА*\n\n` +
    `✅ Бот работает\n` +
    `⏱ Аптайм: *${hours}ч ${minutes}мин*\n` +
    `💾 Память: *${Math.round(mem.rss / 1024 / 1024)} MB*\n` +
    `👥 Менеджеров в конфиге: *${managersCount}*\n` +
    `🌍 Регионов: *${Object.keys(config.regionLabels).length}*\n\n` +
    `📡 Вебхук: \`/webhook/bitrix\`\n` +
    `🔗 Воронка: категория *32*`;

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    ...backKeyboard(),
  });
  await ctx.answerCbQuery();
}

// ─── Вспомогательные ─────────────────────────────────────────────────────────
function backKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('◀️ Назад', 'admin:back')],
  ]);
}

function formatTimeAgo(isoString) {
  if (!isoString) return 'никогда';
  const diff = Date.now() - new Date(isoString).getTime();
  const min  = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (min < 1)   return 'только что';
  if (min < 60)  return `${min} мин назад`;
  if (hrs < 24)  return `${hrs} ч назад`;
  return `${days} д назад`;
}

function esc(text) {
  if (!text) return '';
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

module.exports = {
  showAdminPanel,
  showManagers,
  showDeals,
  showErrors,
  showStatus,
  isAdmin,
};
