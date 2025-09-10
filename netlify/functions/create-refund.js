const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const crypto = require('crypto');

/**
 * Admin: Create a refund for a specific payment.
 * POST JSON: { payment_id: string, amount: number|string, reason: string }
 * Behavior:
 *  - Creates a refund object in YooKassa.
 *  - The actual refund process is handled by YooKassa and can be tracked via webhooks.
 */
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { payment_id, amount, reason } = JSON.parse(event.body || '{}');
    if (!payment_id || !amount) {
      return { statusCode: 400, body: JSON.stringify({ error: 'payment_id and amount are required' }) };
    }

    const value = Number(amount);
    if (!isFinite(value) || value <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid amount' }) };
    }

    const idempotenceKey = crypto.randomUUID();
    const auth = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');
    
    const body = {
      payment_id: payment_id,
      amount: { value: value.toFixed(2), currency: 'RUB' },
      description: reason || 'Возврат по требованию'
    };

    const resp = await fetch('https://api.yookassa.ru/v3/refunds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Idempotence-Key': idempotenceKey
      },
      body: JSON.stringify(body)
    });

    const data = await resp.json();

    if (!resp.ok) {
      const msg = data && data.description ? data.description : 'Ошибка при создании возврата';
      return { statusCode: 400, body: JSON.stringify({ error: msg, yookassa_response: data }) };
    }

    // Optionally, you could log this refund attempt in your own database here.

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Запрос на возврат успешно создан. Статус: ' + data.status,
        refund_id: data.id,
        status: data.status
      })
    };

  } catch (e) {
    console.error('Refund Handler Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};