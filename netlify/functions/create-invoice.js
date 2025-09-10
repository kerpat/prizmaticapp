const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const crypto = require('crypto');

/**
 * Admin: Create and charge an invoice for a client.
 * POST JSON: { userId: string(uuid), amount: number|string, description: string }
 * Behavior:
 *  - Tries to charge saved card (clients.yookassa_payment_method_id) via YooKassa.
 *  - Records a pending payment row immediately; payment-webhook will mark succeeded.
 *  - If no saved card, returns 400 with message for the UI.
 */
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { userId, amount, description } = JSON.parse(event.body || '{}');
    if (!userId || !amount || !description) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId, amount, description are required' }) };
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: client, error: cErr } = await supabase
      .from('clients')
      .select('id, yookassa_payment_method_id')
      .eq('id', userId)
      .single();
    if (cErr || !client) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Клиент не найден' }) };
    }

    const methodId = client.yookassa_payment_method_id;
    if (!methodId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'У клиента нет сохранённой карты. Попросите привязать карту.' }) };
    }

    const value = Number(amount);
    if (!isFinite(value) || value <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Некорректная сумма' }) };
    }

    // Create payment in YooKassa using saved payment method
    const idempotenceKey = crypto.randomUUID();
    const auth = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');
    const body = {
      amount: { value: value.toFixed(2), currency: 'RUB' },
      capture: true,
      description: description.slice(0, 255),
      payment_method_id: methodId,
      metadata: { userId, payment_type: 'invoice' }
    };

    const resp = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Idempotence-Key': idempotenceKey
      },
      body: JSON.stringify(body)
    });

    const data = await resp.json();

    // Pre-create payment row as pending (webhook will update to succeeded)
    try {
      await supabase.from('payments').insert({
        client_id: userId,
        rental_id: null,
        amount_rub: value,
        status: data.status || 'pending',
        payment_type: 'invoice',
        payment_method_title: data.payment_method && data.payment_method.title,
        yookassa_payment_id: data.id || null
      });
    } catch (_) {}

    if (!resp.ok) {
      const msg = data && data.description ? data.description : 'Ошибка при создании платежа';
      return { statusCode: 400, body: JSON.stringify({ error: msg }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Счёт создан и отправлен на списание с карты клиента',
        payment_id: data.id,
        status: data.status
      })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

