const express = require('express');
const { getDeal } = require('../bitrix');
const { sendDealToRegion } = require('../handlers/dealNotifier');

const router = express.Router();

router.post('/bitrix', async (req, res) => {
  // Быстрый ответ — Bitrix ждёт не более 5 сек
  res.status(200).json({ ok: true });

  const { event, data } = req.body || {};
  if (!event) return;

  console.log(`[Webhook] ${event}`);

  try {
    switch (event) {

      // ── Новая сделка ────────────────────────────────────────────────────────
      case 'ONCRMDEALADD': {
        const dealId = data?.FIELDS?.ID;
        if (!dealId) break;

        // Проверяем что это воронка 32
        const deal = await getDeal(dealId);
        if (!deal) break;
        if (String(deal.CATEGORY_ID) !== '32') break;

        await sendDealToRegion(req.app.get('bot'), deal);
        break;
      }

      // ── Сделка изменена ─────────────────────────────────────────────────────
      case 'ONCRMDEALUPDATE': {
        const dealId = data?.FIELDS?.ID;
        console.log(`[Webhook] Обновлена сделка #${dealId}`);
        // Можно добавить уведомление при смене стадии если нужно
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`[Webhook] Ошибка обработки ${event}:`, err.message);
  }
});

router.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

module.exports = router;
