const { setDealStage, getDeal, getContact } = require('../bitrix');
const { formatDealCard, formatStage } = require('../utils/formatter');
const { dealActionsKeyboard, stageKeyboard, confirmStageKeyboard, remindKeyboard } = require('../utils/keyboards');
const { clearSession } = require('../sessions/sessionManager');
const config = require('../config');

// ─── Показать список стадий для выбора ───────────────────────────────────────
// Callback: actions:{dealId}:stage
async function handleShowStages(ctx) {
  const dealId = ctx.callbackQuery.data.split(':')[1];

  await ctx.editMessageText(
    `📊 Выберите новую стадию для сделки *#${dealId}*:`,
    { parse_mode: 'Markdown', ...stageKeyboard(dealId) }
  );
  await ctx.answerCbQuery();
}

// ─── Нажата кнопка стадии — просим подтвердить ───────────────────────────────
// Callback: stage:{dealId}:{stageId}
async function handleStageButton(ctx) {
  const parts   = ctx.callbackQuery.data.split(':');
  // stageId может содержать ':' (C32:NEW), поэтому берём всё после второго ':'
  const dealId  = parts[1];
  const stageId = parts.slice(2).join(':');  // C32:NEW, C32:UC_XPNSAK, etc.

  const stage = config.pipeline.stageById[stageId];
  if (!stage) return ctx.answerCbQuery('❌ Неизвестная стадия');

  await ctx.editMessageText(
    `⚠️ Изменить стадию сделки *#${dealId}* на:\n\n${stage.emoji} *${stage.name}*\n\nПодтвердите:`,
    { parse_mode: 'Markdown', ...confirmStageKeyboard(dealId, stageId) }
  );
  await ctx.answerCbQuery();
}

// ─── Подтверждение — меняем в Bitrix24 ───────────────────────────────────────
// Callback: confirm:{dealId}:{stageId}
async function handleConfirmStage(ctx) {
  const parts   = ctx.callbackQuery.data.split(':');
  const dealId  = parts[1];
  const stageId = parts.slice(2).join(':');

  const stage = config.pipeline.stageById[stageId];
  if (!stage) return ctx.answerCbQuery('❌ Неизвестная стадия');

  try {
    await ctx.answerCbQuery('⏳ Обновляю...');
    await setDealStage(dealId, stageId);

    console.log(`[StageHandler] Сделка #${dealId} → ${stageId}`);

    // Стадии "Обратная связь" → предлагаем напоминание о перезвоне
    if (stage.needsReminder) {
      await ctx.editMessageText(
        `${stage.emoji} *${stage.name}* сохранена — сделка *#${dealId}*\n\n` +
        `🔔 Когда напомнить о *следующем контакте?*`,
        { parse_mode: 'Markdown', ...remindKeyboard(dealId) }
      );
      return;
    }

    // Остальные стадии → показываем обновлённую карточку
    const deal    = await getDeal(dealId);
    let contact   = null;
    if (deal.CONTACT_ID) {
      try { contact = await getContact(deal.CONTACT_ID); } catch (_) {}
    }
    const text = formatDealCard(deal, contact);

    await ctx.editMessageText(
      `${stage.emoji} *Стадия изменена: ${stage.name}*\n\n${text}`,
      { parse_mode: 'Markdown', ...dealActionsKeyboard(dealId) }
    );
  } catch (err) {
    console.error(`[StageHandler] Ошибка #${dealId}:`, err.message);
    await ctx.editMessageText('❌ Ошибка при смене стадии. Попробуйте ещё раз.',
      dealActionsKeyboard(dealId));
  }
}

// ─── Отмена ───────────────────────────────────────────────────────────────────
// Callback: cancel:{dealId}
async function handleCancel(ctx) {
  const dealId = ctx.callbackQuery.data.split(':')[1];
  clearSession(ctx.from.id);

  try {
    const deal    = await getDeal(dealId);
    let contact   = null;
    if (deal?.CONTACT_ID) {
      try { contact = await getContact(deal.CONTACT_ID); } catch (_) {}
    }
    await ctx.editMessageText(formatDealCard(deal, contact), {
      parse_mode: 'Markdown',
      ...dealActionsKeyboard(dealId),
    });
  } catch {
    await ctx.editMessageText('❌ Отменено.');
  }
  await ctx.answerCbQuery('Отменено');
}

module.exports = {
  handleShowStages,
  handleStageButton,
  handleConfirmStage,
  handleCancel,
};
