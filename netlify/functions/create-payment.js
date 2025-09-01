const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Вспомогательная функция для приведения телефона к формату YooKassa (7xxxxxxxxxx)
function normalizePhone(phone) {
    if (!phone) return '';
    // Удаляем все символы, кроме цифр
    let digits = phone.replace(/\D/g, '');
    // Если номер начинается с 8, заменяем ее на 7
    if (digits.startsWith('8')) {
        digits = '7' + digits.slice(1);
    }
    return digits;
}

exports.handler = async function(event, context) {
    // Стандартные заголовки для CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Netlify требует обрабатывать OPTIONS запросы для CORS
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        const { userId, bikeId, tariffId } = JSON.parse(event.body);

        if (!userId) {
            throw new Error("Не передан ID пользователя (userId)");
        }

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        // Получаем данные клиента, чтобы взять номер телефона для чека
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('phone')
            .eq('id', userId)
            .single();

        if (clientError || !clientData || !clientData.phone) {
            throw new Error(`Не удалось найти телефон для клиента с ID ${userId}`);
        }
        
        // === ИСПРАВЛЕНИЕ №1: Очищаем номер телефона ===
        const normalizedPhone = normalizePhone(clientData.phone);
        if (normalizedPhone.length < 11) {
             throw new Error(`Некорректный формат номера телефона: ${clientData.phone}`);
        }

        const amount = 3750.00; // В будущем можно будет брать из базы по tariffId
        const description = `Аренда электровелосипеда #${bikeId} (тариф #${tariffId})`;
        const idempotenceKey = require('crypto').randomUUID(); // Ключ идемпотентности для защиты от двойных списаний

        const paymentData = {
            amount: { value: amount.toFixed(2), currency: "RUB" },
            confirmation: {
                type: "redirect",
                // === ИСПРАВЛЕНИЕ №2: Указываем твой реальный URL ===
                return_url: "https://lucent-marshmallow-217b1e.netlify.app/index.html" 
            },
            capture: true, // Сразу списываем деньги, а не холдируем
            description: description,
            metadata: { userId, bikeId, tariffId },
            receipt: {
                customer: { phone: normalizedPhone }, // Передаем очищенный номер
                items: [{
                    description: description,
                    quantity: "1.00",
                    amount: { value: amount.toFixed(2), currency: "RUB" },
                    vat_code: "1", // НДС не облагается
                    payment_mode: "full_payment",
                    payment_subject: "service"
                }]
            }
        };

        // Аутентификация в YooKassa
        const authString = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');

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
            // Если YooKassa вернула ошибку, логируем ее для отладки
            console.error("YooKassa API Error:", paymentResult);
            throw new Error(`Ошибка YooKassa: ${paymentResult.description || 'Invalid request parameter'}`);
        }

        // Если все хорошо, возвращаем ссылку на оплату на фронтенд
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ confirmation_url: paymentResult.confirmation.confirmation_url })
        };

    } catch (error) {
        // В случае любой ошибки, логируем ее и возвращаем на фронтенд
        console.error("Handler Error:", error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};