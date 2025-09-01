const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
    try {
        const notification = JSON.parse(event.body);

        // Мы обрабатываем только одно событие: payment.succeeded
        if (notification.event === "payment.succeeded" && notification.object.status === "succeeded") {
            const payment = notification.object;
            const metadata = payment.metadata || {};
            const { userId, bikeId, tariffId } = metadata;

            // Создаем админский клиент для работы с базой
            const supabaseAdmin = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            // === ГЛАВНОЕ ДОПОЛНЕНИЕ: ЛОГИКА СОХРАНЕНИЯ КАРТЫ ===
            // YooKassa присылает payment_method, только если карта была сохранена
            if (payment.payment_method && payment.payment_method.id && userId) {
                const { error: updateError } = await supabaseAdmin
                    .from('clients')
                    .update({ yookassa_payment_method_id: payment.payment_method.id })
                    .eq('id', userId);
                
                if (updateError) {
                    console.error(`Ошибка сохранения карты для пользователя ${userId}:`, updateError.message);
                } else {
                    console.log(`Карта ${payment.payment_method.id} успешно сохранена для пользователя ${userId}.`);
                }
            }
            // === КОНЕЦ ДОПОЛНЕНИЯ ===

            // Если в метаданных есть bikeId, значит, это была аренда, а не просто привязка
            if (userId && bikeId && tariffId) {
                // Логика создания аренды остается такой же
                const startDate = new Date();
                const endDate = new Date();
                endDate.setDate(startDate.getDate() + 7);

                const { error: rentalError } = await supabaseAdmin
                    .from('rentals')
                    .insert({
                        user_id: userId,
                        bike_id: bikeId,
                        tariff_id: tariffId,
                        starts_at: startDate.toISOString(),
                        ends_at: endDate.toISOString(),
                        status: 'active',
                        total_rub: parseFloat(payment.amount.value)
                    });
                
                if (rentalError) throw rentalError;

                console.log(`Аренда для пользователя ${userId} успешно создана.`);
            }
        }

        // YooKassa ждет от нас ответ 200 OK, чтобы понять, что мы получили уведомление
        return { statusCode: 200, body: "OK" };

    } catch (error) {
        console.error("Webhook Error:", error);
        // Если что-то пошло не так, возвращаем ошибку 500, и YooKassa попробует прислать уведомление еще раз
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};