const TelegramBot = require('node-telegram-bot-api');

// Токен бота
const token = '8126548981:AAGC86ZaJ0SYLICC0WbpS7aGOhU9t8iz_a4';

// Создаем бота
const bot = new TelegramBot(token, { polling: true });

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    // Приветственное сообщение
    const welcomeMessage = `👋 Привет! Я помогу вам открыть веб-приложение Prizmatic.

📱 Как открыть веб-приложение:

1️⃣ Зайдите в профиль бота
2️⃣ Нажмите кнопку "Открыть приложение"

Или в чате:
1️⃣ Нажмите кнопку "Открыть" в меню бота

🎥 Посмотрите видео-инструкцию ниже:`;

    // Отправляем приветственное сообщение
    bot.sendMessage(chatId, welcomeMessage)
        .then(() => {
            // Отправляем видео
            return bot.sendVideo(chatId, 'IMG_7164.MP4', {
                caption: '📹 Видео-инструкция по открытию веб-приложения'
            });
        })
        .catch((error) => {
            console.error('Ошибка при отправке сообщения:', error);
            bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
        });
});

// Обработчик всех текстовых сообщений
bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    // Если это не команда /start, отправляем подсказку
    if (msg.text && !msg.text.startsWith('/')) {
        bot.sendMessage(chatId, '📱 Для получения инструкции по открытию веб-приложения отправьте команду /start');
    }
});

console.log('🤖 Бот запущен! Ожидаем сообщения...');

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Бот остановлен');
    process.exit();
});