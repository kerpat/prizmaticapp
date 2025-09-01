const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Вспомогательная функция для очистки номера телефона
function normalizePhone(phone) {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('8')) {
        digits = '7' + digits.slice(1);
    }
    return digits;
}

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        const { userId, bikeId, tariffId, amount: amountFromClient } = JSON.parse(event.body);

        if (!userId) {
            throw new Error("Не передан ID пользователя (userId)");
        }

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

        // 1. Получаем данные клиента: телефон и привязанную карту
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('phone, yookassa_payment_method_id')
            .eq('id', userId)
            .single();

        if (clientError || !clientData) {
            throw new Error(`Не удалось найти клиента с ID ${userId}`);
        }

        const normalizedPhone = normalizePhone(clientData.phone);
        if (!normalizedPhone) {
            throw new Error(`У клиента ${userId} не указан корректный номер телефона.`);
        }
        
        // Определяем сумму. Если пришла с клиента (для пополнения), берем ее. Иначе - стандартная цена аренды.
        const amount = amountFromClient ? parseFloat(amountFromClient) : 3750.00;
        const description = bikeId ? `Аренда электровелосипеда #${bikeId}` : `Пополнение баланса`;
        
        const idempotenceKey = require('crypto').randomUUID();

        // 2. Формируем базовый объект платежа
        const paymentData = {
            amount: { value: amount.toFixed(2), currency: "RUB" },
            capture: true,
            description: description,
            metadata: { userId, bikeId, tariffId },
        };

        // 3. Главная логика: автоплатеж или редирект?
        if (clientData.yookassa_payment_method_id) {
            // КАРТА ПРИВЯЗАНА -> АВТОСПИСАНИЕ
            console.log(`Инициирую автосписание для пользователя ${userId}`);
            paymentData.payment_method_id = clientData.yookassa_payment_method_id;
            // Поле `confirmation` не нужно, т.к. подтверждение не требуется
        } else {
            // КАРТЫ НЕТ -> РЕДИРЕКТ НА СТРАНИЦУ ОПЛАТЫ
            console.log(`Создаю платеж с редиректом для пользователя ${userId}`);
            paymentData.confirmation = {
                type: "redirect",
                return_url: "https://lucent-marshmallow-217b1e.netlify.app/index.html"
            };
            // И предлагаем сохранить карту для будущих платежей
            paymentData.save_payment_method = true; 
        }

        // 4. Добавляем данные для чека
        paymentData.receipt = {
            customer: { phone: normalizedPhone },
            items: [{
                description: description,
                quantity: "1.00",
                amount: { value: amount.toFixed(2), currency: "RUB" },
                vat_code: "1",
                payment_mode: "full_payment",
                payment_subject: "service"
            }]
        };

        const authString = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');

        // 5. Отправляем запрос в YooKassa
        const response = await fetch("https://api.yookassa.ru/v3/payments", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotence-Key": idempotenceKey,
                "Authorization": `Basic ${authString}`
            },
            body: JSON.stringify(paymentData)
        });

        const paymentResult = await response.json();
        
        if (!response.ok) {
            console.error("YooKassa API Error:", paymentResult);
            throw new Error(`Ошибка YooKassa: ${paymentResult.description || 'Неизвестная ошибка'}`);
        }

        // 6. Возвращаем разный результат в зависимости от сценария
        if (clientData.yookassa_payment_method_id) {
            // Для автосписания не нужна ссылка, просто сообщаем статус
            // (он будет 'pending', а потом 'succeeded' придет на вебхук)
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    status: paymentResult.status, 
                    message: "Автоплатеж инициирован. Ожидайте подтверждения." 
                })
            };
        } else {
            // Для обычной оплаты возвращаем ссылку для редиректа
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ confirmation_url: paymentResult.confirmation.confirmation_url })
            };
        }

    } catch (error) {
        console.error("Handler Error:", error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};