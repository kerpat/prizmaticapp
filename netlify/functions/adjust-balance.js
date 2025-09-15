const { createClient } = require('@supabase/supabase-js');

/**
 * Admin: Manually adjust a client's balance and log the transaction.
 * POST JSON: { userId: string(uuid), amount: number, reason: string }
 * Behavior:
 *  - Uses an RPC call 'add_to_balance' to atomically update the balance.
 *  - Creates a record in the 'payments' table to log the adjustment.
 */
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId, amount, reason } = JSON.parse(event.body || '{}');
    if (!userId || !amount || !reason) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId, amount, and reason are required' }) };
    }

    const value = Number(amount);
    if (!isFinite(value)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid amount' }) };
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Call the RPC function to update the balance
    const { error: rpcError } = await supabaseAdmin
        .rpc('add_to_balance', {
            client_id_to_update: userId,
            amount_to_add: value
        });

    if (rpcError) {
        console.error(`Error updating balance for user ${userId}:`, rpcError);
        throw new Error('Failed to update balance: ' + rpcError.message);
    }

    // 2. Log the adjustment in the payments table for history
    const { error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert({
            client_id: userId,
            rental_id: null,
            amount_rub: value,
            status: 'succeeded',
            payment_type: 'adjustment', // Special type for manual adjustments
            payment_method_title: reason, // Use this field to store the reason
            yookassa_payment_id: `manual-${Date.now()}`
        });

    if (paymentError) {
        // Even if logging fails, the balance was updated. Log error but don't fail the request.
        console.error(`Failed to log balance adjustment for user ${userId}:`, paymentError);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Баланс успешно скорректирован.' })
    };

  } catch (e) {
    console.error('Handler Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};