const { GoogleGenerativeAI } = require("@google/generative-ai");
const formidable = require('formidable');
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString("base64"),
            mimeType
        },
    };
}

exports.handler = async function(event, context) {
    // Проверяем, что это POST запрос
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
    const prompt = "Ты — система верификации документов для сервиса аренды. Извлеки из этих изображений паспорта следующие данные в формате JSON: Фамилия, Имя, Отчество, Серия паспорта, Номер паспорта, Дата рождения, Место рождения, Кем выдан, Дата выдачи, Код подразделения, Адрес регистрации. Если каких-то данных нет, оставь поле пустым. Не добавляй никаких лишних слов или форматирования, только JSON.";

    return new Promise((resolve, reject) => {
        const form = formidable({});
        // Передаем тело запроса в formidable
        form.parse(event.body, async (err, fields, files) => {
            if (err) {
                return resolve({ statusCode: 500, body: JSON.stringify({ error: "Ошибка обработки файлов." }) });
            }

            try {
                const imageParts = [];
                if (files.photos) {
                    const photoFiles = Array.isArray(files.photos) ? files.photos : [files.photos];
                    for (const photo of photoFiles) {
                        imageParts.push(fileToGenerativePart(photo.filepath, photo.mimetype));
                    }
                }

                if (imageParts.length === 0) {
                    return resolve({ statusCode: 400, body: JSON.stringify({ error: "Не найдено фото для распознавания." }) });
                }

                const result = await model.generateContent([prompt, ...imageParts]);
                const response = await result.response;
                let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                const jsonData = JSON.parse(text);

                resolve({
                    statusCode: 200,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ data: jsonData })
                });
            } catch (e) {
                console.error("Gemini API Error:", e);
                resolve({ statusCode: 500, body: JSON.stringify({ error: "Ошибка при распознавании данных." }) });
            }
        });
    });
};
