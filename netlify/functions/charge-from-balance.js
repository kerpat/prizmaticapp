const { createClient } = require('@supabase/supabase-js');

/**
 * Charge a user from their internal balance for a new rental.
 * POST JSON: { userId: string(uuid), tariffId: number }
 * Behavior:
 *  - Checks if the user has enough balance.
 *  - If yes, deducts the amount and creates a new rental with 'pending_assignment' status.
 *  - If no, returns an error.
 */
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId, tariffId } = JSON.parse(event.body || '{}');
    if (!userId || !tariffId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userId and tariffId are required' }) };
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Get tariff price and user balance in parallel
    const [tariffResult, clientResult] = await Promise.all([
        supabaseAdmin.from('tariffs').select('price_rub, duration_days').eq('id', tariffId).single(),
        supabaseAdmin.from('clients').select('balance_rub').eq('id', userId).single()
    ]);

    if (tariffResult.error || !tariffResult.data) {
        throw new Error('Тариф не найден.');
    }
    if (clientResult.error || !clientResult.data) {
        throw new Error('Клиент не найден.');
    }

    const rentalCost = tariffResult.data.price_rub;
    const userBalance = clientResult.data.balance_rub;

    // 2. Check if balance is sufficient
    if (userBalance < rentalCost) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Недостаточно средств на балансе.' }) };
    }

    // 3. Perform the transaction (deduct balance, create rental and payment log)
    // We use an RPC call to make this atomic. Let's assume an RPC function
    // 'rent_from_balance' exists or we do it step-by-step with caution.
    // For now, let's do it step-by-step.

    const newBalance = userBalance - rentalCost;

    // Step 3.1: Update client's balance
    const { error: balanceError } = await supabaseAdmin
        .from('clients')
        .update({ balance_rub: newBalance })
        .eq('id', userId);

    if (balanceError) {
        throw new Error('Ошибка при обновлении баланса: ' + balanceError.message);
    }

    // Step 3.2: Create the new rental record
    const rentalDurationDays = tariffResult.data.duration_days;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + rentalDurationDays);

    const { data: newRental, error: rentalError } = await supabaseAdmin
        .from('rentals')
        .insert({
            user_id: userId,
            bike_id: null, // Admin will assign this later
            tariff_id: tariffId,
            starts_at: startDate.toISOString(),
            current_period_ends_at: endDate.toISOString(),
            status: 'pending_assignment',
            total_paid_rub: rentalCost
        })
        .select('id')
        .single();

    if (rentalError) {
        // Attempt to refund the balance if rental creation fails
        await supabaseAdmin.from('clients').update({ balance_rub: userBalance }).eq('id', userId);
        throw new Error('Ошибка при создании аренды: ' + rentalError.message);
    }

    // Step 3.3: Log the transaction in the payments table
    const { error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert({
            client_id: userId,
            rental_id: newRental.id,
            amount_rub: -rentalCost, // Negative amount to indicate a debit from balance
            status: 'succeeded',
            payment_type: 'balance_debit',
            payment_method_title: 'Списание с баланса'
        });

    if (paymentError) {
        // This is not critical enough to roll back, but we should log it.
        console.error(`Failed to log payment for rental ${newRental.id}:`, paymentError);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Аренда успешно оформлена! Ожидайте назначения велосипеда.' })
    };

  } catch (e) {
    console.error('Handler Error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
