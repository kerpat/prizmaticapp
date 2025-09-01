const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch'); // Netlify functions используют Node.js

exports.handler = async function(event, context) {
    // Разрешаем запросы с любого домена (важно для CORS)
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        const { userId, bikeId, tariffId } = JSON.parse(event.body);

        if (!userId) {
            throw new Error("Не передан ID пользователя (userId)");
        }

        // Подключаемся к Supabase для получения телефона клиента
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY // Используем anon key, т.к. RLS защитит данные
        );

        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('phone')
            .eq('id', userId)
            .single();

        if (clientError || !clientData || !clientData.phone) {
            throw new Error(`Не удалось найти телефон для клиента с ID ${userId}`);
        }
        
        const amount = 3750.00;
        const description = `Аренда электровелосипеда #${bikeId} (тариф #${tariffId})`;
        const idempotenceKey = require('crypto').randomUUID();

        const paymentData = {
            amount: { value: amount.toFixed(2), currency: "RUB" },
            confirmation: {
                type: "redirect",
                // !!! ИЗМЕНИ НА СВОЙ ДОМЕН NETLIFY !!!
                return_url: "https://lucent-marshmallow-217b1e.netlify.app/index.html" 
            },
            capture: true,
            description: description,
            metadata: { userId, bikeId, tariffId },
            receipt: {
                customer: { phone: clientData.phone },
                items: [{
                    description: description,
                    quantity: "1.00",
                    amount: { value: amount.toFixed(2), currency: "RUB" },
                    vat_code: "1",
                    payment_mode: "full_payment",
                    payment_subject: "service"
                }]
            }
        };

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
            throw new Error(`Ошибка YooKassa: ${paymentResult.description || 'Неизвестная ошибка'}`);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ confirmation_url: paymentResult.confirmation.confirmation_url })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};