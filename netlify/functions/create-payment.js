const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

/**
 * Вспомогательная функция для приведения номера телефона к формату,
 * который требует YooKassa (например, 79991234567).
 * @param {string} phone - Исходный номер телефона.
 * @returns {string} - Очищенный номер телефона.
 */
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

/**
 * Универсальная Netlify Function для создания платежей в YooKassa.
 * Поддерживает два сценария:
 * 1. Обычный платеж с редиректом на сайт YooKassa, если у пользователя нет привязанной карты.
 * 2. Автоматическое списание (автоплатеж), если карта уже привязана.
 */
exports.handler = async function(event, context) {
    // Стандартные заголовки для обработки CORS-запросов от браузера
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Netlify требует обрабатывать предварительные OPTIONS-запросы
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        // Получаем данные от клиента (из index.html или profile.html)
        const { userId, bikeId, tariffId, amount: amountFromClient } = JSON.parse(event.body);

        if (!userId) {
            throw new Error("Не передан ID пользователя (userId)");
        }

        // Подключаемся к Supabase для получения данных клиента
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY // Используем публичный ключ, т.к. RLS защитит данные
        );

        // 1. Ищем пользователя и его "ключ" от карты (yookassa_payment_method_id)
        const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('phone, yookassa_payment_method_id')
            .eq('id', userId)
            .single();

        if (clientError || !clientData) {
            throw new Error(`Клиент с ID ${userId} не найден в базе данных.`);
        }

        const normalizedPhone = normalizePhone(clientData.phone);
        if (!normalizedPhone) {
            throw new Error(`У клиента ${userId} не указан корректный номер телефона для чека.`);
        }
        
        // 2. Определяем сумму и описание платежа
        const amount = amountFromClient ? parseFloat(amountFromClient) : 3750.00;
        const description = bikeId ? `Аренда электровелосипеда #${bikeId}` : `Пополнение баланса`;
        
        const idempotenceKey = require('crypto').randomUUID();

        // 3. Формируем базовый объект платежа
        const paymentData = {
            // test: true, // ВРЕМЕННО ОТКЛЮЧАЕМ ДЛЯ РЕАЛЬНОГО ПЛАТЕЖА
            amount: { value: amount.toFixed(2), currency: "RUB" },
            confirmation: {
                type: "redirect",
                return_url: "https://lucent-marshmallow-217b1e.netlify.app/index.html"
            },
            capture: true,
            description: description,
            metadata: { userId, bikeId, tariffId },
            save_payment_method: true, // Просим YooKassa сохранить карту
        };

        // 4. ГЛАВНАЯ ЛОГИКА: Выбираем сценарий оплаты
        if (clientData.yookassa_payment_method_id) {
            // СЦЕНАРИЙ А: КАРТА ПРИВЯЗАНА -> АВТОСПИСАНИЕ
            console.log(`Инициирую автосписание для пользователя ${userId}`);
            paymentData.payment_method_id = clientData.yookassa_payment_method_id;
            // Поле `confirmation` не нужно, так как участие пользователя не требуется.
        } else {
            // СЦЕНАРИЙ Б: КАРТЫ НЕТ -> РЕДИРЕКТ НА СТРАНИЦУ ОПЛАТЫ
            console.log(`Создаю платеж с редиректом для пользователя ${userId}`);
            paymentData.confirmation = {
                type: "redirect",
                return_url: "https://lucent-marshmallow-217b1e.netlify.app/index.html"
            };
            // И просим YooKassa сохранить карту после успешной оплаты
            paymentData.save_payment_method = true; 
        }

        // 5. Добавляем данные для онлайн-чека (обязательно для РФ)
        paymentData.receipt = {
            customer: { phone: normalizedPhone },
            items: [{
                description: description,
                quantity: "1.00",
                amount: { value: amount.toFixed(2), currency: "RUB" },
                vat_code: "1", // НДС не облагается
                payment_mode: "full_payment",
                payment_subject: "service"
            }]
        };

        // 6. Отправляем запрос в YooKassa
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
            console.error("YooKassa API Error:", paymentResult);
            throw new Error(`Ошибка YooKassa: ${paymentResult.description || 'Неверный параметр запроса'}`);
        }

        // 7. Возвращаем разный результат в зависимости от сценария
        if (clientData.yookassa_payment_method_id) {
            // Для автосписания возвращаем статус (например, "pending")
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