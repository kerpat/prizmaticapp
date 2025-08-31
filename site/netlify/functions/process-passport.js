// Файл: netlify/functions/process-passport.js

const { GoogleGenerativeAI } = require("@google/generative-ai");
const formidable = require('formidable');
const fs = require('fs');

// Инициализируем Gemini с ключом из переменных окружения на Netlify
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Вспомогательная функция для преобразования файла в формат, понятный Gemini
function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString("base64"),
            mimeType
        },
    };
}

// Основная функция, которую будет запускать Netlify
exports.handler = async function(event) {
    // Проверяем, что запрос был отправлен методом POST
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
    const prompt = "Ты — система верификации документов для сервиса аренды. Извлеки из этих изображений паспорта следующие данные в формате JSON: Фамилия, Имя, Отчество, Серия паспорта, Номер паспорта, Дата рождения, Место рождения, Кем выдан, Дата выдачи, Код подразделения, Адрес регистрации. Если каких-то данных нет, оставь поле пустым. Не добавляй никаких лишних слов или форматирования, только JSON.";

    // Используем Promise, так как formidable работает с колбэками
    return new Promise((resolve) => {
        const form = formidable({});
        
        // formidable парсит тело запроса (event.body), которое содержит наши файлы
        form.parse(event.body, async (err, fields, files) => {
            if (err) {
                return resolve({ statusCode: 500, body: JSON.stringify({ error: "Ошибка обработки файлов." }) });
            }

            try {
                const imageParts = [];
                // `files.photos` - это имя поля из нашей HTML-формы
                if (files.photos) {
                    const photoFiles = Array.isArray(files.photos) ? files.photos : [files.photos];
                    for (const photo of photoFiles) {
                        imageParts.push(fileToGenerativePart(photo.filepath, photo.mimetype));
                    }
                }

                if (imageParts.length === 0) {
                    return resolve({ statusCode: 400, body: JSON.stringify({ error: "Не найдено фото для распознавания." }) });
                }

                // Отправляем запрос в Gemini
                const result = await model.generateContent([prompt, ...imageParts]);
                const response = await result.response;
                let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                const jsonData = JSON.parse(text);

                // Возвращаем успешный ответ
                resolve({
                    statusCode: 200,
                    headers: { 
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*", // Разрешаем запросы с любого домена
                        "Access-Control-Allow-Headers": "Content-Type",
                        "Access-Control-Allow-Methods": "POST, OPTIONS"
                    },
                    body: JSON.stringify({ data: jsonData })
                });
            } catch (e) {
                console.error("Gemini API Error:", e);
                resolve({ statusCode: 500, body: JSON.stringify({ error: "Ошибка при распознавании данных." }) });
            }
        });
    });
};
