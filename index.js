require('dotenv').config();
const express = require('express');
const bot     = require('./bot');
const config  = require('./config');
const webhook = require('./webhook/bitrixWebhook');

// Пинг чтобы Render не засыпал
require('./keepalive');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('bot', bot);
app.use('/webhook', webhook);

async function start() {
  console.log('🚀 Запуск бота — Региональные менеджеры (воронка 32)...');

  app.listen(config.server.port, () => {
    console.log(`✅ Сервер: порт ${config.server.port}`);
    console.log(`📡 Вебхук Bitrix24: POST /webhook/bitrix`);
  });

  await bot.launch();
  console.log('✅ Telegram бот запущен');

  const regions = Object.keys(config.regionChats);
  console.log(`📍 Регионов в конфиге: ${regions.length} — ${regions.join(', ')}`);
}

process.once('SIGINT',  () => { bot.stop('SIGINT');  process.exit(0); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });

start().catch((err) => { console.error('❌ Ошибка запуска:', err.message); process.exit(1); });
