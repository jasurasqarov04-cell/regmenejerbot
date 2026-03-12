const { Markup } = require('telegraf');
const config = require('../config');

// ─── Кнопки стадий воронки (динамически из конфига) ──────────────────────────
function stageKeyboard(dealId) {
  const stages = config.pipeline.stages;

  // Группируем по 2 кнопки в ряд
  const rows = [];
  for (let i = 0; i < stages.length; i += 2) {
    const row = [
      Markup.button.callback(
        `${stages[i].emoji} ${stages[i].name}`,
        `stage:${dealId}:${stages[i].id}`
      ),
    ];
    if (stages[i + 1]) {
      row.push(
        Markup.button.callback(
          `${stages[i + 1].emoji} ${stages[i + 1].name}`,
          `stage:${dealId}:${stages[i + 1].id}`
        )
      );
    }
    rows.push(row);
  }

  return Markup.inlineKeyboard(rows);
}

// ─── Кнопки действий с уже открытой сделкой ──────────────────────────────────
function dealActionsKeyboard(dealId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📊 Сменить стадию',    `actions:${dealId}:stage`),
    ],
    [
      Markup.button.callback('💰 Внести сумму',      `actions:${dealId}:amount`),
      Markup.button.callback('💬 Комментарий',       `actions:${dealId}:comment`),
    ],
    [
      Markup.button.callback('🔄 Обновить карточку', `actions:${dealId}:refresh`),
    ],
  ]);
}

// ─── Подтверждение смены стадии ───────────────────────────────────────────────
function confirmStageKeyboard(dealId, stageId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Подтвердить', `confirm:${dealId}:${stageId}`),
      Markup.button.callback('❌ Отмена',      `cancel:${dealId}`),
    ],
  ]);
}

// ─── Клавиатура напоминания о перезвоне ──────────────────────────────────────
function remindKeyboard(dealId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⏰ Через 30 мин',  `remind:${dealId}:30m`)],
    [Markup.button.callback('⏰ Через 1 час',   `remind:${dealId}:1h`)],
    [Markup.button.callback('⏰ Через 2 часа',  `remind:${dealId}:2h`)],
    [Markup.button.callback('⏰ Через 3 часа',  `remind:${dealId}:3h`)],
    [Markup.button.callback('📅 Завтра в 9:00', `remind:${dealId}:tomorrow`)],
    [Markup.button.callback('🚫 Без напоминания',`remind:${dealId}:none`)],
  ]);
}

// ─── Отмена текущего действия ─────────────────────────────────────────────────
function cancelKeyboard(dealId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❌ Отмена', `cancel:${dealId}`)],
  ]);
}

// ─── Главное меню ─────────────────────────────────────────────────────────────
function mainMenuKeyboard() {
  return Markup.keyboard([
    ['🔍 Найти сделку'],
    ['❓ Помощь'],
  ]).resize();
}

module.exports = {
  stageKeyboard,
  dealActionsKeyboard,
  confirmStageKeyboard,
  remindKeyboard,
  cancelKeyboard,
  mainMenuKeyboard,
};