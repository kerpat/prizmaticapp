const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
    try {
        const notification = JSON.parse(event.body);

        if (notification.event === "payment.succeeded" && notification.object.status === "succeeded") {
            const payment = notification.object;
            const { userId, bikeId, tariffId } = payment.metadata;

            if (!userId || !bikeId) throw new Error("Нет userId или bikeId в метаданных");

            // Создаем админский клиент для записи в базу
            const supabaseAdmin = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY // Нужен service_role_key для обхода RLS
            );

            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + 7); // Аренда на 7 дней

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
        }

        return { statusCode: 200, body: "OK" };

    } catch (error) {
        console.error("Webhook Error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};