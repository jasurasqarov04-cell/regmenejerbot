require('dotenv').config();

// ─── Проверка обязательных переменных ────────────────────────────────────────
['BOT_TOKEN', 'BITRIX_WEBHOOK_URL'].forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Нет обязательной переменной: ${key}`);
    process.exit(1);
  }
});

// ─── Воронка категория 32 ─────────────────────────────────────────────────────
const PIPELINE = {
  categoryId: 32,
  currency: 'UZS',

  // Поле в сделке, в котором хранится ID региона
  regionField: 'UF_CRM_6750379924C59',

  // ID значения поля → название региона
  regionMap: {
    '12428': 'TASHKENT',
    '12430': 'ANDIJON',
    '12432': 'NAMANGAN',
    '12434': 'FERGANA',
    '12436': 'SAMARKAND',
    '12438': 'BUKHARA',
    '12440': 'KHOREZM',
    '12592': 'JIZZAKH',
    '12636': 'NUKUS',
    '12722': 'KASHKADARYA',
    '13372': 'NAVOIY',
  },

  // Стадии воронки
  stages: [
    { id: 'C32:NEW',       name: 'Лид передан',       emoji: '🔵' },
    { id: 'C32:UC_XPNSAK', name: 'Обратная связь 1',  emoji: '🟡', needsReminder: true },
    { id: 'C32:UC_MW9MVA', name: 'Обратная связь 2',  emoji: '🟠', needsReminder: true },
    { id: 'C32:UC_GU5SQN', name: 'Отложенная продажа',emoji: '🔷' },
    { id: 'C32:UC_VM3PNJ', name: 'Повторная продажа', emoji: '🔄' },
    { id: 'C32:WON',       name: 'Продажа',           emoji: '🟢', won: true  },
    { id: 'C32:LOSE',      name: 'Отказ',             emoji: '⚫', lose: true },
  ],
};

// ─── Быстрый доступ к стадии по ID ───────────────────────────────────────────
PIPELINE.stageById = Object.fromEntries(PIPELINE.stages.map((s) => [s.id, s]));

// ─── Парсинг Telegram chat_id регионов из .env ────────────────────────────────
function parseRegionChats() {
  const map = {};
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('REGION_')) {
      map[key.replace('REGION_', '')] = process.env[key];
    }
  });
  return map;
}

// Читаемые названия регионов на русском
const REGION_LABELS = {
  TASHKENT:    '🏙 Ташкент',
  ANDIJON:     '🌆 Андижан',
  NAMANGAN:    '🌆 Наманган',
  FERGANA:     '🌆 Фергана',
  SAMARKAND:   '🌆 Самарканд',
  BUKHARA:     '🌆 Бухара',
  KHOREZM:     '🌆 Хоразм',
  JIZZAKH:     '🌆 Джизак',
  NUKUS:       '🌆 Нукус',
  KASHKADARYA: '🌆 Кашкадарья',
  NAVOIY:      '🌆 Навоий',
};

const config = {
  bot: {
    token: process.env.BOT_TOKEN,
  },
  bitrix: {
    webhookUrl: process.env.BITRIX_WEBHOOK_URL,
  },
  server: {
    port: parseInt(process.env.PORT) || 3000,
  },
  admin: {
    chatId: process.env.ADMIN_CHAT_ID || null,
  },
  pipeline: PIPELINE,
  regionChats: parseRegionChats(),   // { TASHKENT: '-100123...', ... }
  regionLabels: REGION_LABELS,
};

// ─── Хелперы ──────────────────────────────────────────────────────────────────

// Значение поля региона (12428) → ключ региона (TASHKENT)
config.getRegionKeyByFieldValue = (fieldValue) => {
  return PIPELINE.regionMap[String(fieldValue)] || null;
};

// Ключ региона → chat_id Telegram
config.getChatIdByRegionKey = (regionKey) => {
  return config.regionChats[regionKey] || null;
};

// Ключ региона → читаемое название
config.getRegionLabel = (regionKey) => {
  return REGION_LABELS[regionKey] || regionKey;
};

module.exports = config;
