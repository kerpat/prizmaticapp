// Файл: stats.js

document.addEventListener('DOMContentLoaded', () => {
    // --- ИНИЦИАЛИЗАЦИЯ SUPABASE ---
    const SUPABASE_URL = 'https://avamqfmuhiwtlumjkzmv.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YW1xZm11aGl3dGx1bWprem12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjMyODcsImV4cCI6MjA3MjIzOTI4N30.EwEPMpObAd3v_NXI89DLcgKVYrUiOn7iHuCXXaqU4I';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- ЭЛЕМЕНТЫ DOM ---
    const historyContainer = document.getElementById('history-list-container');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const periodDisplayText = document.getElementById('period-text');

    let allOperations = [];
    let currentFilter = 'all';

    // --- ИКОНКИ ДЛЯ ОПЕРАЦИЙ ---
    const icons = {
        rent: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>`,
        topup: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
    };

    /**
     * Рендерит отфильтрованный список операций
     */
    function renderHistory() {
        let operationsToRender = allOperations;
        if (currentFilter === 'rent') {
            operationsToRender = allOperations.filter(op => op.total_rub <= 0);
        } else if (currentFilter === 'topup') {
            operationsToRender = allOperations.filter(op => op.total_rub > 0);
        }
        
        historyContainer.innerHTML = '';
        if (operationsToRender.length === 0) {
            historyContainer.innerHTML = '<p class="empty-history">Операций за выбранный период нет.</p>';
            return;
        }

        const groupedByDate = operationsToRender.reduce((acc, op) => {
            const date = new Date(op.created_at).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
            if (!acc[date]) acc[date] = [];
            acc[date].push(op);
            return acc;
        }, {});

        for (const date in groupedByDate) {
            const dateHeader = document.createElement('h3');
            dateHeader.className = 'history-date-header';
            dateHeader.textContent = date;
            historyContainer.appendChild(dateHeader);

            groupedByDate[date].forEach(item => {
                const isTopup = item.total_rub > 0;
                const type = isTopup ? 'topup' : 'rent';
                const itemHTML = `
                    <div class="history-item">
                        <div class="history-item-left">
                            <div class="history-icon-wrapper ${type}">${icons[type]}</div>
                            <div class="history-details">
                                <span class="history-title">${isTopup ? 'Пополнение баланса' : `Аренда #${item.id}`}</span>
                                <span class="history-subtitle">${item.tariffs ? item.tariffs.title : 'Без тарифа'}</span>
                            </div>
                        </div>
                        <div class="history-cost ${isTopup ? 'positive' : 'negative'}">${isTopup ? '+' : ''}${item.total_rub.toLocaleString('ru-RU')} ₽</div>
                    </div>`;
                historyContainer.insertAdjacentHTML('beforeend', itemHTML);
            });
        }
    }

    /**
     * Загружает историю операций с сервера за указанный период
     * @param {Date} startDate - Начальная дата
     * @param {Date} endDate - Конечная дата
     */
    async function loadHistory(startDate, endDate) {
        historyContainer.innerHTML = '<p class="empty-history">Загрузка истории...</p>';
        const userId = localStorage.getItem('userId');
        if (!userId) {
            historyContainer.innerHTML = '<p class="empty-history">Не удалось определить пользователя.</p>';
            return;
        }

        try {
            let query = supabase
                .from('rentals')
                .select('id, created_at, total_rub, tariffs (title)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            // Добавляем фильтры по дате, если они есть
            if (startDate) query = query.gte('created_at', startDate.toISOString());
            if (endDate) query = query.lte('created_at', endDate.toISOString());

            const { data, error } = await query;

            if (error) throw error;
            
            allOperations = data;
            renderHistory();
        } catch (err) {
            console.error('Ошибка загрузки истории:', err);
            historyContainer.innerHTML = '<p class="empty-history">Не удалось загрузить историю поездок.</p>';
        }
    }

    // --- ЛОГИКА ФИЛЬТРОВ ---
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.filter;
            renderHistory(); // Просто перерисовываем с новым фильтром
        });
    });

    // --- ИНИЦИАЛИЗАЦИЯ КАЛЕНДАРЯ ---
    const fp = flatpickr("#period-display", {
        mode: "range",
        dateFormat: "d.m.Y",
        locale: "ru", // Требует подключения локализации, либо используйте без нее
        onClose: function(selectedDates) {
            if (selectedDates.length === 2) {
                const [start, end] = selectedDates;
                // Устанавливаем конец дня для второй даты, чтобы включить все операции за этот день
                end.setHours(23, 59, 59, 999); 
                
                const options = { day: 'numeric', month: 'short' };
                periodDisplayText.textContent = `${start.toLocaleDateString('ru-RU', options)} - ${end.toLocaleDateString('ru-RU', options)}`;
                loadHistory(start, end);
            }
        }
    });

    // --- НАЧАЛЬНАЯ ЗАГРУЗКА ДАННЫХ ЗА ТЕКУЩИЙ МЕСЯЦ ---
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    loadHistory(startOfMonth, endOfMonth);
});