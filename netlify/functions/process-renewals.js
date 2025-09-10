const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async function(event, context) {
    // Эта функция должна запускаться только по расписанию, а не через публичный URL
    // (настроим безопасность в Netlify позже)

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        // 1. Находим все аренды, которые нужно продлить сегодня
        const today = new Date().toISOString();
        const { data: rentalsToRenew, error: rentalsError } = await supabaseAdmin
            .from('rentals')
            .select(`
                id,
                user_id,
                total_paid_rub,
                clients ( yookassa_payment_method_id ),
                tariffs ( price_rub, duration_days )
            `)
            .eq('status', 'active')
            .lte('current_period_ends_at', today); // <= сегодня

        if (rentalsError) throw rentalsError;

        if (rentalsToRenew.length === 0) {
            console.log('Нет аренд для продления сегодня.');
            return { statusCode: 200, body: 'No renewals to process.' };
        }

        // 2. Проходим по каждой аренде и пытаемся списать деньги
        for (const rental of rentalsToRenew) {
            const { id: rentalId, clients, tariffs } = rental;
            const paymentMethodId = clients?.yookassa_payment_method_id;
            const renewalAmount = tariffs?.price_rub;
            const rentalDuration = tariffs?.duration_days;

            if (!paymentMethodId || !renewalAmount || !rentalDuration) {
                console.warn(`Пропуск аренды #${rentalId}: отсутствуют данные для платежа.`);
                // Меняем статус на просроченный, так как без данных оплата невозможна
                await supabaseAdmin.from('rentals').update({ status: 'overdue' }).eq('id', rentalId);
                continue;
            }

            // 3. Формируем и отправляем запрос на автоплатеж в YooKassa
            const idempotenceKey = crypto.randomUUID();
            const authString = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');
            
            const response = await fetch("https://api.yookassa.ru/v3/payments", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotence-Key": idempotenceKey,
                    "Authorization": `Basic ${authString}`
                },
                body: JSON.stringify({
                    amount: { value: renewalAmount.toFixed(2), currency: "RUB" },
                    capture: true,
                    payment_method_id: paymentMethodId,
                    description: `Автопродление аренды #${rentalId}`
                })
            });

            const paymentResult = await response.json();

            // 4. Обрабатываем результат платежа
            if (response.ok && paymentResult.status === 'succeeded') {
                // --- ПЛАТЕЖ УСПЕШЕН ---
                console.log(`Успешное автосписание для аренды #${rentalId}.`);
                
                // Продлеваем дату окончания периода
                const newEndDate = new Date();
                newEndDate.setDate(newEndDate.getDate() + rentalDuration);

                await supabaseAdmin
                    .from('rentals')
                    .update({
                        current_period_ends_at: newEndDate.toISOString(),
                        total_paid_rub: rental.total_paid_rub + renewalAmount
                    })
                    .eq('id', rentalId);

                // Записываем успешный платеж в историю
                await supabaseAdmin.from('payments').insert({
                    rental_id: rentalId,
                    client_id: rental.user_id,
                    amount_rub: renewalAmount,
                    status: 'succeeded',
                    payment_type: 'renewal',
                    yookassa_payment_id: paymentResult.id
                });

            } else {
                // --- ПЛАТЕЖ НЕУДАЧЕН ---
                console.error(`Ошибка автосписания для аренды #${rentalId}:`, paymentResult);

                // Меняем статус аренды на "просрочена"
                await supabaseAdmin.from('rentals').update({ status: 'overdue' }).eq('id', rentalId);
                
                // Записываем неудачный платеж в историю
                await supabaseAdmin.from('payments').insert({
                    rental_id: rentalId,
                    client_id: rental.user_id,
                    amount_rub: renewalAmount,
                    status: 'failed',
                    payment_type: 'renewal',
                    yookassa_payment_id: paymentResult.id || `failed-${idempotenceKey}`
                });
            }
        }

        return { statusCode: 200, body: `Processed ${rentalsToRenew.length} renewals.` };

    } catch (error) {
        console.error("Renewal function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};