const { Telegraf } = require('telegraf');
const config = require('./config');

const { showDealCard, searchDeals }  = require('./handlers/dealNotifier');
const { handleShowStages, handleStageButton, handleConfirmStage, handleCancel } = require('./handlers/stageHandler');
const { handleActionButton, handleTextInput } = require('./handlers/inputHandler');
const { handleRemindButton } = require('./handlers/reminderHandler');
const { mainMenuKeyboard } = require('./utils/keyboards');

const bot = new Telegraf(config.bot.token);

// ─── Логирование ──────────────────────────────────────────────────────────────
bot.use(async (ctx, next) => {
  const u = ctx.from;
  const t = ctx.message?.text || ctx.callbackQuery?.data || '';
  if (u) console.log(`[Bot] ${u.username || u.id}: ${t.slice(0, 80)}`);
  return next();
});

// ─── /start ───────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  await ctx.reply(
    `👋 Привет, *${ctx.from.first_name || 'Менеджер'}*!\n\n` +
    `Работаю со сделками воронки *Региональные менеджеры и дилеры*.\n\n` +
    `*Что умею:*\n` +
    `📋 Показываю карточки сделок\n` +
    `📊 Меняю стадии прямо из Telegram\n` +
    `💰 Фиксирую суммы, товары, комментарии\n` +
    `🔔 Напоминаю о следующем контакте\n\n` +
    `Напиши *ID сделки* или нажми кнопку 👇`,
    { parse_mode: 'Markdown', ...mainMenuKeyboard() }
  );
});

// ─── /help ────────────────────────────────────────────────────────────────────
bot.help(async (ctx) => {
  const stages = config.pipeline.stages
    .map((s) => `${s.emoji} ${s.name}`)
    .join('\n');

  await ctx.reply(
    `📖 *Справка*\n\n` +
    `*/deal 123* — открыть сделку по ID\n` +
    `*/search Название* — поиск по названию\n\n` +
    `*Стадии воронки:*\n${stages}`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /deal {id} ───────────────────────────────────────────────────────────────
bot.command('deal', async (ctx) => {
  const id = ctx.message.text.split(' ')[1];
  if (!id || isNaN(id)) return ctx.reply('❌ Укажите ID: /deal 123');
  await showDealCard(ctx, id);
});

// ─── /search {текст} ──────────────────────────────────────────────────────────
bot.command('search', async (ctx) => {
  const q = ctx.message.text.replace('/search', '').trim();
  if (!q) return ctx.reply('❌ Укажите запрос: /search Название');
  await searchDeals(ctx, q);
});

// ─── Кнопки меню ──────────────────────────────────────────────────────────────
bot.hears('🔍 Найти сделку', async (ctx) => {
  await ctx.reply('Введите ID сделки или используйте /search Название');
});
bot.hears('❓ Помощь', async (ctx) => ctx.reply('/help'));

// ─── Callbacks: выбор стадии ──────────────────────────────────────────────────
// actions:{dealId}:stage → показать список стадий
bot.action(/^actions:\d+:stage$/, handleShowStages);

// stage:{dealId}:{stageId} → подтвердить
// stageId содержит ':', например C32:NEW — поэтому регекс широкий
bot.action(/^stage:\d+:C32:/, handleStageButton);

// confirm:{dealId}:{stageId} → применить
bot.action(/^confirm:\d+:C32:/, handleConfirmStage);

// ─── Callbacks: данные сделки ─────────────────────────────────────────────────
bot.action(/^actions:\d+:(amount|comment|refresh|stage)$/, handleActionButton);

// ─── Callbacks: напоминание ───────────────────────────────────────────────────
bot.action(/^remind:\d+:/, (ctx) => handleRemindButton(ctx, bot));

// ─── Callbacks: отмена ────────────────────────────────────────────────────────
bot.action(/^cancel:\d+$/, handleCancel);

// ─── Текстовые сообщения ──────────────────────────────────────────────────────
bot.on('text', async (ctx) => {
  const text    = ctx.message.text.trim();
  const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

  // Если менеджер вводит данные для сделки (активная сессия)
  const handled = await handleTextInput(ctx);
  if (handled) return;

  // В группе — больше ни на что не реагируем
  if (isGroup) return;

  // В личке — если число, открываем сделку по ID
  if (/^\d+$/.test(text) && text.length <= 10) {
    return showDealCard(ctx, text);
  }

  // В личке — подсказка
  await ctx.reply(
    'Напишите *ID сделки* или используйте:\n/deal 123\n/search Название',
    { parse_mode: 'Markdown', ...mainMenuKeyboard() }
  );
});

// ─── Глобальный обработчик ошибок ────────────────────────────────────────────
bot.catch((err, ctx) => {
  console.error(`[Bot] Ошибка ${ctx.updateType}:`, err.message);
  ctx.reply('❌ Внутренняя ошибка. Попробуйте позже.').catch(() => {});
});

module.exports = bot;