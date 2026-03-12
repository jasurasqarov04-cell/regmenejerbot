const { Telegraf, Markup } = require('telegraf');
const config = require('./config');

const { showDealCard, searchDeals }     = require('./handlers/dealNotifier');
const { handleShowStages, handleStageButton, handleConfirmStage, handleCancel } = require('./handlers/stageHandler');
const { handleActionButton, handleTextInput } = require('./handlers/inputHandler');
const { handleRemindButton }            = require('./handlers/reminderHandler');
const { showAdminPanel, showManagers, showDeals, showErrors, showStatus } = require('./handlers/adminHandler');
const { trackActivity, trackAction, logError } = require('./sessions/sessionManager');

const bot = new Telegraf(config.bot.token);

// ─── Middleware: логирование + трекинг активности ─────────────────────────────
bot.use(async (ctx, next) => {
  const u = ctx.from;
  if (u) {
    trackActivity(u.id, u.username, u.first_name);
    const t = ctx.message?.text || ctx.callbackQuery?.data || '';
    console.log(`[Bot] ${u.username || u.id}: ${t.slice(0, 80)}`);
  }
  return next();
});

// ─── /start ───────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const userId    = ctx.from.id;
  const regionKey = config.getRegionByTelegramId(userId);

  if (config.isAdmin(userId)) {
    return ctx.reply(
      `👋 Добро пожаловать, *Администратор*!\n\n` +
      `Используй /admin для панели управления.`,
      { parse_mode: 'Markdown' }
    );
  }

  if (!regionKey) {
    return ctx.reply(
      `👋 Привет!\n\n` +
      `⚠️ Ваш Telegram ID (*${userId}*) не привязан ни к одному региону.\n\n` +
      `Сообщите администратору этот ID для добавления в систему.`,
      { parse_mode: 'Markdown' }
    );
  }

  const regionLabel = config.getRegionLabel(regionKey);
  await ctx.reply(
    `👋 Привет, *${ctx.from.first_name || 'Менеджер'}*!\n\n` +
    `📍 Ваш регион: *${regionLabel}*\n\n` +
    `Сюда будут приходить новые сделки вашего региона.\n\n` +
    `*Команды:*\n` +
    `/deal 123 — открыть сделку по ID\n` +
    `/search Название — найти сделку`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /help ────────────────────────────────────────────────────────────────────
bot.help(async (ctx) => {
  const stages = config.pipeline.stages.map((s) => `${s.emoji} ${s.name}`).join('\n');
  await ctx.reply(
    `📖 *Справка*\n\n` +
    `/deal 123 — открыть сделку по ID\n` +
    `/search Название — поиск сделки\n\n` +
    `*Стадии воронки:*\n${stages}`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /admin ───────────────────────────────────────────────────────────────────
bot.command('admin', showAdminPanel);

// ─── /deal {id} ───────────────────────────────────────────────────────────────
bot.command('deal', async (ctx) => {
  const id = ctx.message.text.split(' ')[1];
  if (!id || isNaN(id)) return ctx.reply('❌ Укажите ID: /deal 123');
  trackAction(ctx.from.id);
  await showDealCard(ctx, id);
});

// ─── /search ──────────────────────────────────────────────────────────────────
bot.command('search', async (ctx) => {
  const q = ctx.message.text.replace('/search', '').trim();
  if (!q) return ctx.reply('❌ Укажите запрос: /search Название');
  trackAction(ctx.from.id);
  await searchDeals(ctx, q);
});

// ─── Callbacks: стадии ────────────────────────────────────────────────────────
bot.action(/^actions:\d+:stage$/, (ctx) => { trackAction(ctx.from.id); return handleShowStages(ctx); });
bot.action(/^stage:\d+:C32:/,     (ctx) => { trackAction(ctx.from.id); return handleStageButton(ctx); });
bot.action(/^confirm:\d+:C32:/,   (ctx) => { trackAction(ctx.from.id); return handleConfirmStage(ctx); });

// ─── Callbacks: данные сделки ─────────────────────────────────────────────────
bot.action(/^actions:\d+:(amount|comment|refresh)$/, (ctx) => {
  trackAction(ctx.from.id);
  return handleActionButton(ctx);
});

// ─── Callbacks: напоминание ───────────────────────────────────────────────────
bot.action(/^remind:\d+:/, (ctx) => handleRemindButton(ctx, bot));

// ─── Callbacks: отмена ────────────────────────────────────────────────────────
bot.action(/^cancel:\d+$/, handleCancel);

// ─── Callbacks: админ панель ──────────────────────────────────────────────────
bot.action('admin:managers', showManagers);
bot.action('admin:deals',    showDeals);
bot.action('admin:errors',   showErrors);
bot.action('admin:status',   showStatus);
bot.action('admin:back',     async (ctx) => {
  await ctx.editMessageText(
    `🔧 *АДМИН ПАНЕЛЬ*\n\nВыберите раздел:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('👥 Менеджеры и активность', 'admin:managers')],
        [Markup.button.callback('📊 Сделки по регионам',     'admin:deals')],
        [Markup.button.callback('⚠️ Ошибки бота',            'admin:errors')],
        [Markup.button.callback('🤖 Статус бота',            'admin:status')],
      ]),
    }
  );
  await ctx.answerCbQuery();
});

// ─── Текстовые сообщения ──────────────────────────────────────────────────────
bot.on('text', async (ctx) => {
  const handled = await handleTextInput(ctx);
  if (handled) { trackAction(ctx.from.id); return; }

  const text = ctx.message.text.trim();
  if (/^\d+$/.test(text) && text.length <= 10) {
    trackAction(ctx.from.id);
    return showDealCard(ctx, text);
  }

  await ctx.reply(
    'Напишите *ID сделки* или используйте:\n/deal 123\n/search Название',
    { parse_mode: 'Markdown' }
  );
});

// ─── Обработчик ошибок ────────────────────────────────────────────────────────
bot.catch((err, ctx) => {
  console.error(`[Bot] Ошибка ${ctx.updateType}:`, err.message);
  logError(`Bot.${ctx.updateType}`, err.message);
  ctx.reply('❌ Внутренняя ошибка. Попробуйте позже.').catch(() => {});
});

module.exports = bot;
