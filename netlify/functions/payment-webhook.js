const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
    try {
        const notification = JSON.parse(event.body);

        // Мы обрабатываем только одно событие: payment.succeeded
        if (notification.event !== "payment.succeeded" || notification.object.status !== "succeeded") {
            // Если это не успешный платеж, просто выходим
            return { statusCode: 200, body: "OK. Event ignored." };
        }

        const payment = notification.object;
        const metadata = payment.metadata || {};
        const { userId, bikeId, tariffId, payment_type } = metadata;
        const paymentAmount = parseFloat(payment.amount.value);
        const yookassaPaymentId = payment.id; // Уникальный ID платежа из YooKassa

        // Создаем админский клиент для работы с базой
        const supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // === 1. Сохранение/обновление метода оплаты (карты) ===
        // Этот шаг обязателен для всех будущих автосписаний
        if (payment.payment_method && payment.payment_method.id && userId) {
            const { error: updateError } = await supabaseAdmin
                .from('clients')
                .update({ yookassa_payment_method_id: payment.payment_method.id })
                .eq('id', userId);

            if (updateError) {
                console.error(`Ошибка сохранения карты для пользователя ${userId}:`, updateError.message);
                // Не прерываем выполнение, так как платеж уже прошел
            } else {
                console.log(`Карта ${payment.payment_method.id} успешно сохранена для пользователя ${userId}.`);
            }
        }

        // === 2. Создание аренды или пополнение баланса ===
        if (userId && tariffId && bikeId) {
            // --- СЦЕНАРИЙ: ЭТО ПЕРВИЧНАЯ АРЕНДА ---

            // 2.1 Получаем информацию о тарифе, чтобы узнать срок аренды
            const { data: tariffData, error: tariffError } = await supabaseAdmin
                .from('tariffs')
                .select('duration_days')
                .eq('id', tariffId)
                .single();

            if (tariffError || !tariffData) {
                throw new Error(`Тариф с ID ${tariffId} не найден.`);
            }

            const rentalDurationDays = tariffData.duration_days;
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + rentalDurationDays);

            // 2.2 Создаем новую запись об аренде со статусом pending_assignment
            const { data: newRental, error: rentalError } = await supabaseAdmin
                .from('rentals')
                .insert({
                    user_id: userId,
                    bike_id: null, // Bike is not assigned yet
                    tariff_id: tariffId,
                    starts_at: startDate.toISOString(),
                    current_period_ends_at: endDate.toISOString(),
                    status: 'pending_assignment', // New status
                    total_paid_rub: paymentAmount
                })
                .select('id') // Возвращаем ID созданной аренды
                .single();

            if (rentalError) throw rentalError;
            console.log(`Аренда #${newRental.id} для пользователя ${userId} успешно создана.`);

            // 2.3 Создаем запись о первом платеже, связанную с этой арендой
            const { error: paymentError } = await supabaseAdmin
                .from('payments')
                .insert({
                    client_id: userId,
                    rental_id: newRental.id, // Связываем платеж с арендой
                    amount_rub: paymentAmount,
                    status: 'succeeded',
                    payment_type: 'initial', // Указываем, что это первый платеж
                    payment_method_title: payment.payment_method?.title,
                    yookassa_payment_id: yookassaPaymentId
                });

            if (paymentError) throw paymentError;
            console.log(`Первый платеж для аренды #${newRental.id} зарегистрирован.`);

        } else if (userId) {
            // --- СЦЕНАРИЙ: ЭТО БЫЛО ОБЫЧНОЕ ПОПОЛНЕНИЕ БАЛАНСА ---
            
            // 1. Вызываем RPC функцию для атомарного обновления баланса
            const { error: balanceError } = await supabaseAdmin
                .rpc('add_to_balance', {
                    client_id_to_update: userId,
                    amount_to_add: paymentAmount
                });

            if (balanceError) {
                console.error(`Ошибка обновления баланса для пользователя ${userId}:`, balanceError);
                // Важно: даже если баланс не обновился, платеж нужно записать, чтобы не потерять деньги
            } else {
                console.log(`Баланс пользователя ${userId} успешно пополнен на ${paymentAmount}.`);
            }

            // 2. Записываем сам факт платежа в историю
            const typeOfPayment = payment_type === 'invoice' ? 'invoice' : 'top-up';

            const { error: paymentError } = await supabaseAdmin
                .from('payments')
                .insert({
                    client_id: userId,
                    rental_id: null,
                    amount_rub: paymentAmount,
                    status: 'succeeded',
                    payment_type: typeOfPayment, // Тип - пополнение или счет
                    payment_method_title: payment.payment_method?.title,
                    yookassa_payment_id: yookassaPaymentId
                });

            if (paymentError) throw paymentError;
            console.log(`Платеж (тип: ${typeOfPayment}) для пользователя ${userId} на сумму ${paymentAmount} зарегистрирован.`);
        }

        // YooKassa ждет от нас ответ 200 OK
        return { statusCode: 200, body: "OK" };

    } catch (error) {
        console.error("Webhook Error:", error);
        // Если что-то пошло не так, возвращаем ошибку 500
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};