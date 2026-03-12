const { setDealDetails, getDeal, getContact, addDealComment } = require('../bitrix');
const { formatDealCard, formatAmount } = require('../utils/formatter');
const { dealActionsKeyboard, cancelKeyboard } = require('../utils/keyboards');
const { getSession, setSession, setStep, STEPS } = require('../sessions/sessionManager');

// ─── Нажата кнопка действия ───────────────────────────────────────────────────
async function handleActionButton(ctx) {
  const parts  = ctx.callbackQuery.data.split(':');
  const dealId = parts[1];
  const action = parts[2];

  // Обновить карточку
  if (action === 'refresh') {
    await ctx.answerCbQuery('⏳');
    try {
      const deal = await getDeal(dealId);
      let contact = null;
      if (deal?.CONTACT_ID) {
        try { contact = await require('../bitrix').getContact(deal.CONTACT_ID); } catch (_) {}
      }
      await ctx.editMessageText(formatDealCard(deal, contact), {
        parse_mode: 'Markdown',
        ...dealActionsKeyboard(dealId),
      });
    } catch {
      await ctx.editMessageText('❌ Ошибка загрузки.', dealActionsKeyboard(dealId));
    }
    return;
  }

  // Ввод суммы
  if (action === 'amount') {
    setSession(ctx.from.id, { dealId, step: STEPS.WAIT_AMOUNT });
    await ctx.editMessageText(
      `💰 Введите *сумму сделки* #${dealId} в сумах:\n_Пример: 5000000_`,
      { parse_mode: 'Markdown', ...cancelKeyboard(dealId) }
    );
    await ctx.answerCbQuery();
    return;
  }

  // Ввод комментария
  if (action === 'comment') {
    setSession(ctx.from.id, { dealId, step: STEPS.WAIT_COMMENT });
    await ctx.editMessageText(
      `💬 Введите *комментарий* для сделки #${dealId}:`,
      { parse_mode: 'Markdown', ...cancelKeyboard(dealId) }
    );
    await ctx.answerCbQuery();
    return;
  }

  await ctx.answerCbQuery();
}

// ─── Обработка текстового ввода ───────────────────────────────────────────────
async function handleTextInput(ctx) {
  const session = getSession(ctx.from.id);
  if (!session.dealId || session.step === STEPS.IDLE) return false;

  const text   = ctx.message.text.trim();
  const dealId = session.dealId;

  try {
    // ── Сумма ────────────────────────────────────────────────────────────────
    if (session.step === STEPS.WAIT_AMOUNT) {
      const amount = parseAmount(text);
      if (amount === null) {
        await ctx.reply(
          '❌ Не удалось распознать сумму. Введите число, например: *5000000*',
          { parse_mode: 'Markdown', ...cancelKeyboard(dealId) }
        );
        return true;
      }
      setStep(ctx.from.id, STEPS.IDLE);
      await setDealDetails(dealId, { amount });
      const deal = await getDeal(dealId);
      let contact = null;
      if (deal?.CONTACT_ID) { try { contact = await require('../bitrix').getContact(deal.CONTACT_ID); } catch (_) {} }
      await ctx.reply(
        `✅ *Сумма обновлена:* ${formatAmount(amount)}\n\n${formatDealCard(deal, contact)}`,
        { parse_mode: 'Markdown', ...dealActionsKeyboard(dealId) }
      );
      return true;
    }

    // ── Комментарий → пишем в ленту сделки ───────────────────────────────────
    if (session.step === STEPS.WAIT_COMMENT) {
      setStep(ctx.from.id, STEPS.IDLE);

      // Имя автора из Telegram
      const authorName = [ctx.from.first_name, ctx.from.last_name]
        .filter(Boolean).join(' ') || ctx.from.username || 'Менеджер';

      await addDealComment(dealId, text, authorName);

      const deal = await getDeal(dealId);
      let contact = null;
      if (deal?.CONTACT_ID) { try { contact = await require('../bitrix').getContact(deal.CONTACT_ID); } catch (_) {} }
      await ctx.reply(
        `✅ *Комментарий добавлен в ленту сделки*\n\n${formatDealCard(deal, contact)}`,
        { parse_mode: 'Markdown', ...dealActionsKeyboard(dealId) }
      );
      return true;
    }

  } catch (err) {
    console.error(`[InputHandler] Ошибка #${dealId}:`, err.message);
    await ctx.reply('❌ Ошибка при обновлении. Попробуйте ещё раз.', cancelKeyboard(dealId));
  }

  return false;
}

// ─── Парсинг суммы ────────────────────────────────────────────────────────────
function parseAmount(text) {
  const clean = text.replace(/\s/g, '').replace(',', '.');
  const num   = parseFloat(clean);
  if (!isNaN(num) && num >= 0) return num;

  const lower = text.toLowerCase();
  const mlnMatch = lower.match(/(\d+[\.,]?\d*)\s*(млн|миллион)/);
  if (mlnMatch) return parseFloat(mlnMatch[1].replace(',', '.')) * 1_000_000;
  const tysMatch = lower.match(/(\d+[\.,]?\d*)\s*(тыс|тысяч)/);
  if (tysMatch) return parseFloat(tysMatch[1].replace(',', '.')) * 1_000;

  return null;
}

module.exports = { handleActionButton, handleTextInput };
