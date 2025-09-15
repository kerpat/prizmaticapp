const { createClient } = require('@supabase/supabase-js');

/**
 * Admin: Reject a pending rental and refund the cost to the client's internal balance.
 * POST JSON: { rental_id: number }
 */
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { rental_id } = JSON.parse(event.body || '{}');
    if (!rental_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'rental_id is required' }) };
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Fetch the rental to get user_id and amount paid
    const { data: rental, error: fetchError } = await supabaseAdmin
        .from('rentals')
        .select('user_id, total_paid_rub, status')
        .eq('id', rental_id)
        .single();

    if (fetchError) throw new Error('Аренда не найдена: ' + fetchError.message);
    if (rental.status !== 'pending_assignment') {
        return { statusCode: 400, body: JSON.stringify({ error: `Нельзя отклонить заявку со статусом "${rental.status}".` }) };
    }

    const { user_id, total_paid_rub } = rental;

    // 2. Refund the amount to the user's balance using the RPC function
    const { error: rpcError } = await supabaseAdmin
        .rpc('add_to_balance', {
            client_id_to_update: user_id,
            amount_to_add: total_paid_rub
        });

    if (rpcError) {
        throw new Error('Ошибка возврата средств на баланс: ' + rpcError.message);
    }

    // 3. Update the rental status to 'rejected'
    const { error: updateError } = await supabaseAdmin
        .from('rentals')
        .update({ status: 'rejected', bike_id: null })
        .eq('id', rental_id);

    if (updateError) {
        // If this fails, the user got their money back, but the rental is still pending.
        // This is a state that requires manual admin intervention, but we won't roll back the refund.
        console.error(`CRITICAL: Failed to update rental ${rental_id} to rejected after refunding balance.`);
        throw new Error('Статус заявки не обновлен после возврата средств. Требуется ручная проверка.');
    }
    
    // 4. Log the refund transaction for history
    await supabaseAdmin.from('payments').insert({
        client_id: user_id,
        rental_id: rental_id,
        amount_rub: total_paid_rub, // Positive amount for a refund log
        status: 'succeeded',
        payment_type: 'refund_to_balance',
        payment_method_title: 'Возврат за отклоненную заявку'
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Заявка успешно отклонена, средства возвращены на баланс клиента.' })
    };

  } catch (e) {
    console.error('Handler Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
