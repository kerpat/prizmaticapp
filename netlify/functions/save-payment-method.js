const fetch = require('node-fetch');

// Эта функция будет вызываться, когда пользователь захочет привязать карту
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
        const { userId } = JSON.parse(event.body);

        if (!userId) {
            throw new Error("Не передан ID пользователя для привязки карты");
        }

        const idempotenceKey = require('crypto').randomUUID();

        // Мы создаем специальный объект "способ оплаты"
        const saveData = {
            type: "bank_card",
            confirmation: {
                type: "redirect",
                // YooKassa вернет пользователя на эту страницу после привязки.
                // Параметр ?card_saved=true поможет нам показать сообщение об успехе.
                return_url: `https://lucent-marshmallow-217b1e.netlify.app/profile.html?card_saved=true`
            },
            // Сохраняем ID пользователя, чтобы потом в вебхуке понять, чья это карта
            metadata: { userId: userId, action: 'save_card' } 
        };

        const authString = Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`).toString('base64');

        // Отправляем запрос не в /payments, а в /payment_methods
        const response = await fetch("https://api.yookassa.ru/v3/payment_methods", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotence-Key": idempotenceKey,
                "Authorization": `Basic ${authString}`
            },
            body: JSON.stringify(saveData)
        });
        
        const result = await response.json();
        if (!response.ok) {
            console.error("YooKassa Save Card Error:", result);
            throw new Error(result.description || "Не удалось создать ссылку для привязки карты");
        }

        // Возвращаем на фронтенд ссылку, по которой пользователь должен перейти
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ confirmation_url: result.confirmation.confirmation_url })
        };
    } catch (error) {
        console.error("Save Card Handler Error:", error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};