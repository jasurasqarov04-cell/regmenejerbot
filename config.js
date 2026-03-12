require('dotenv').config();

['BOT_TOKEN', 'BITRIX_WEBHOOK_URL'].forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Нет обязательной переменной: ${key}`);
    process.exit(1);
  }
});

// ─── Воронка 32 ───────────────────────────────────────────────────────────────
const PIPELINE = {
  categoryId: 32,
  currency: 'UZS',
  regionField: 'UF_CRM_6750379924C59',
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
  stages: [
    { id: 'C32:NEW',       name: 'Лид передан',        emoji: '🔵' },
    { id: 'C32:UC_XPNSAK', name: 'Обратная связь 1',   emoji: '🟡', needsReminder: true },
    { id: 'C32:UC_MW9MVA', name: 'Обратная связь 2',   emoji: '🟠', needsReminder: true },
    { id: 'C32:UC_GU5SQN', name: 'Отложенная продажа', emoji: '🔷' },
    { id: 'C32:UC_VM3PNJ', name: 'Повторная продажа',  emoji: '🔄' },
    { id: 'C32:WON',       name: 'Продажа',            emoji: '🟢', won: true  },
    { id: 'C32:LOSE',      name: 'Отказ',              emoji: '⚫', lose: true },
  ],
};
PIPELINE.stageById = Object.fromEntries(PIPELINE.stages.map((s) => [s.id, s]));

// ─── Менеджеры: Telegram ID → регион ─────────────────────────────────────────
// Формат в .env: MANAGER_123456789=TASHKENT
function parseManagers() {
  const map = {};
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('MANAGER_')) {
      const telegramId = key.replace('MANAGER_', '');
      map[telegramId] = process.env[key]; // TASHKENT, ANDIJON, etc.
    }
  });
  return map;
}

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
  bot: { token: process.env.BOT_TOKEN },
  bitrix: { webhookUrl: process.env.BITRIX_WEBHOOK_URL },
  server: { port: parseInt(process.env.PORT) || 3000 },
  admin: { telegramId: process.env.ADMIN_TELEGRAM_ID || null },
  pipeline: PIPELINE,
  managers: parseManagers(),   // { '123456': 'TASHKENT', '789012': 'ANDIJON' }
  regionLabels: REGION_LABELS,
};

// ─── Хелперы ──────────────────────────────────────────────────────────────────
config.getRegionByTelegramId = (telegramId) => {
  return config.managers[String(telegramId)] || null;
};

config.getRegionKeyByFieldValue = (fieldValue) => {
  return PIPELINE.regionMap[String(fieldValue)] || null;
};

config.getRegionLabel = (regionKey) => {
  return REGION_LABELS[regionKey] || regionKey;
};

// Получить всех менеджеров региона (массив telegram_id)
config.getManagersByRegion = (regionKey) => {
  return Object.entries(config.managers)
    .filter(([, region]) => region === regionKey)
    .map(([telegramId]) => telegramId);
};

config.isAdmin = (telegramId) => {
  return String(telegramId) === String(config.admin.telegramId);
};

module.exports = config;
