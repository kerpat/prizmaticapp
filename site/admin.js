// Скрипт для админ‑панели.
//
// В этом файле реализована простая аутентификация и базовые операции
// CRUD для тарифов, а также каркас для отображения клиентов, аренд и
// платежей. Для работы с реальной базой требуется Supabase; чтобы
// активировать интеграцию, сохраните `supabaseUrl` и `supabaseAnonKey`
// в localStorage. Если Supabase не настроен, интерфейс по прежнему
// отобразится, но данные будут храниться только в памяти, и
// авторизация будет пропускаться.

document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('login-form');
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    const adminNav = document.getElementById('admin-nav');

    const tariffsSection = document.getElementById('tariffs-section');
    const clientsSection = document.getElementById('clients-section');
    const rentalsSection = document.getElementById('rentals-section');
    const paymentsSection = document.getElementById('payments-section');
    const tariffTableBody = document.querySelector('#tariffs-table tbody');
    const tariffForm = document.getElementById('tariff-form');
    const tariffFormTitle = document.getElementById('tariff-form-title');
    const tariffIdInput = document.getElementById('tariff-id');
    const tariffTitleInput = document.getElementById('tariff-title');
    // Убираем отдельные поля цены, длительности и депозита. Вместо них есть описание тарифа
    const tariffDescriptionInput = document.getElementById('tariff-description');
    const tariffActiveCheckbox = document.getElementById('tariff-active');
    const tariffCancelBtn = document.getElementById('tariff-cancel-btn');

    // Элементы для продлений (сроков аренды/продления)
    const extensionsList = document.getElementById('extensions-list');
    const addExtensionBtn = document.getElementById('add-extension-btn');

    /**
     * Создает строку для ввода срока и стоимости и добавляет её в список.
     * @param {number|string} daysVal
     * @param {number|string} priceVal
     */
    function addExtensionRow(daysVal = '', priceVal = '') {
        if (!extensionsList) return;
        const row = document.createElement('div');
        row.className = 'extension-row';
        const daysInput = document.createElement('input');
        daysInput.type = 'number';
        daysInput.placeholder = 'Дней';
        daysInput.value = daysVal;
        daysInput.className = 'ext-days';
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.placeholder = 'Стоимость (₽)';
        priceInput.value = priceVal;
        priceInput.className = 'ext-price';
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-extension-btn';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            row.remove();
        });
        row.appendChild(daysInput);
        row.appendChild(priceInput);
        row.appendChild(removeBtn);
        extensionsList.appendChild(row);
    }

    /**
     * Отрисовывает список сроков по массиву объектов { days, cost }.
     * @param {Array} extArr
     */
    function renderExtensions(extArr) {
        if (!extensionsList) return;
        extensionsList.innerHTML = '';
        if (Array.isArray(extArr)) {
            extArr.forEach(ext => {
                const d = ext && (ext.days || ext.duration || ext.day || ext.length);
                const c = ext && (ext.cost || ext.price || ext.amount);
                addExtensionRow(d || '', c || '');
            });
        }
    }

    /**
     * Считывает сроки из формы и возвращает массив объектов { days, cost }.
     */
    function getExtensionsFromForm() {
        if (!extensionsList) return [];
        const exts = [];
        extensionsList.querySelectorAll('.extension-row').forEach(row => {
            const days = parseInt(row.querySelector('.ext-days').value, 10);
            const cost = parseInt(row.querySelector('.ext-price').value, 10);
            if (!isNaN(days) && !isNaN(cost) && days > 0 && cost >= 0) {
                exts.push({ days, cost });
            }
        });
        return exts;
    }

    if (addExtensionBtn) {
        addExtensionBtn.addEventListener('click', () => addExtensionRow());
    }

    // Инициализируем Supabase клиент с заданными параметрами
    const SUPABASE_URL = 'https://avamqfmuhiwtlumjkzmv.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YW1xZm11aGl3dGx1bWprem12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjMyODcsImV4cCI6MjA3MjIzOTI4N30.EwEPM0pObAd3v_NXI89DLcgKVYrUiOn7iHuCXXaqU4I';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Проверка текущей сессии. Если есть действующая сессия, скрываем
    // форму входа и показываем дашборд
    async function checkSession() {
        if (!supabase) return false;
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session && !error) {
            showDashboard();
            return true;
        }
        return false;
    }

    // Если работаем оффлайн и уже проходили вход (флаг в localStorage), сразу показываем панель
    if (!supabase) {
        const authed = localStorage.getItem('isAdminAuth');
        if (authed === 'true') {
            showDashboard();
        }
    }

    // Отображаем админский интерфейс
    function showDashboard() {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        selectSection('tariffs');
        loadTariffs();
    }

    // Обработчик входа
    loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmail.value;
    const password = loginPassword.value;

    // Используем встроенную функцию Supabase для входа
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        alert('Ошибка входа: ' + error.message);
        return;
    }

    // Если вход успешный, показываем панель
    if (data.user) {
        showDashboard();
    }
});

    // Навигация по админским разделам
    adminNav.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-section]');
        if (!btn) return;
        const target = btn.getAttribute('data-section');
        adminNav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectSection(target);
    });

    function selectSection(name) {
        [tariffsSection, clientsSection, rentalsSection, paymentsSection].forEach(sec => {
            sec.classList.add('hidden');
        });
        switch (name) {
            case 'tariffs':
                tariffsSection.classList.remove('hidden');
                loadTariffs();
                break;
            case 'clients':
                clientsSection.classList.remove('hidden');
                loadClients();
                break;
            case 'rentals':
                rentalsSection.classList.remove('hidden');
                loadRentals();
                break;
            case 'payments':
                paymentsSection.classList.remove('hidden');
                loadPayments();
                break;
        }
    }

    // Store clients data loaded from API/localStorage for editing purposes
    let clientsData = [];

    // Загрузка тарифов
    async function loadTariffs() {
        // Показываем индикатор загрузки
        tariffTableBody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
        try {
            const { data, error } = await supabase
                .from('tariffs')
                .select('*')
                .order('id', { ascending: true });
            if (error) throw error;
            tariffTableBody.innerHTML = '';
            if (!data || data.length === 0) {
                tariffTableBody.innerHTML = '<tr><td colspan="6">Тарифы еще не созданы.</td></tr>';
                return;
            }
            data.forEach(t => {
                const tr = document.createElement('tr');
                tr.innerHTML = `\n                    <td>${t.title}</td>\n                    <td>${t.price_rub} ₽</td>\n                    <td>${t.duration_days} дн.</td>\n                    <td>${t.deposit_rub || 0} ₽</td>\n                    <td>${t.is_active ? 'Да' : 'Нет'}</td>\n                    <td>\n                        <button type="button" class="edit-tariff-btn" data-id="${t.id}">Ред.</button>\n                        <button type="button" class="delete-tariff-btn" data-id="${t.id}">Удалить</button>\n                    </td>`;
                tariffTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Ошибка загрузки тарифов:', err);
            tariffTableBody.innerHTML = `<tr><td colspan="6">Ошибка: ${err.message}</td></tr>`;
        }
    }

    // Сохранение/обновление тарифа
    tariffForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = tariffIdInput.value;
        const extArr = getExtensionsFromForm();
        const newTariffData = {
            title: tariffTitleInput.value,
            description: tariffDescriptionInput ? tariffDescriptionInput.value : '',
            is_active: tariffActiveCheckbox.checked,
            price_rub: extArr.length > 0 ? extArr[0].cost : 0,
            duration_days: extArr.length > 0 ? extArr[0].days : 0,
            slug: tariffTitleInput.value.trim().toLowerCase().replace(/\s+/g, '-'),
            extensions: extArr
        };
        try {
            let error;
            if (id) {
                const { error: updateError } = await supabase.from('tariffs').update(newTariffData).eq('id', id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase.from('tariffs').insert([newTariffData]);
                error = insertError;
            }
            if (error) throw error;
            await loadTariffs();
            resetTariffForm();
        } catch (err) {
            alert('Ошибка сохранения тарифа: ' + err.message);
        }
    });

    // Обработка клика на кнопку редактирования тарифа
    tariffTableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.edit-tariff-btn');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        editTariff(id);
    });
    tariffTableBody.addEventListener('click', async (e) => {
        // Ищем, была ли нажата именно кнопка удаления
        const btn = e.target.closest('.delete-tariff-btn');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        // Спрашиваем подтверждение у пользователя
        if (confirm(`Вы уверены, что хотите удалить тариф с ID ${id}? Это действие необратимо.`)) {
            try {
                // Удаляем тариф через Supabase
                const { error } = await supabase
                    .from('tariffs')
                    .delete()
                    .eq('id', id);
                if (error) {
                    alert('Ошибка удаления: ' + (error.message || 'Не удалось удалить тариф'));
                } else {
                    alert('Тариф успешно удален.');
                    loadTariffs();
                }
            } catch (err) {
                alert('Ошибка удаления: ' + (err.message || err));
            }
        }
    });

    tariffCancelBtn.addEventListener('click', resetTariffForm);

    async function editTariff(id) {
        if (!supabase) {
            try {
                let data;
                // Пробуем загрузить из API
                try {
                    const resp = await fetch(`/api/tariffs/${id}`);
                    if (resp.ok) {
                        data = await resp.json();
                    }
                } catch (e) {
                    data = null;
                }
                // Если не нашли, пробуем из localStorage
                if (!data) {
                    const arr = JSON.parse(localStorage.getItem('tariffs') || '[]');
                    data = arr.find(t => t.id === id);
                }
                if (!data) throw new Error('Тариф не найден');
                tariffIdInput.value = data.id;
                tariffTitleInput.value = data.title;
                // Заполняем описание. Используем поле description, если оно есть; иначе slug
                if (tariffDescriptionInput) {
                    tariffDescriptionInput.value = data.description || data.slug || '';
                }
                tariffActiveCheckbox.checked = data.is_active;
                // Попробуем прочитать сроки из поля extensions
                let extArr = [];
                if (data.extensions) {
                    try {
                        extArr = typeof data.extensions === 'string' ? JSON.parse(data.extensions) : data.extensions;
                    } catch (e) {
                        extArr = [];
                    }
                }
                renderExtensions(extArr);
                tariffFormTitle.textContent = 'Редактировать тариф';
                tariffCancelBtn.classList.remove('hidden');
            } catch (err) {
                alert('Ошибка загрузки тарифа: ' + (err.message || err));
            }
            return;
        }
        try {
            const { data, error } = await supabase
                .from('tariffs')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            tariffIdInput.value = data.id;
            tariffTitleInput.value = data.title;
                if (tariffDescriptionInput) {
                    tariffDescriptionInput.value = data.description || data.slug || '';
                }
            tariffActiveCheckbox.checked = data.is_active;
            // Попробуем прочитать сроки из поля extensions
            let extArr = [];
            if (data.extensions) {
                try {
                    extArr = typeof data.extensions === 'string' ? JSON.parse(data.extensions) : data.extensions;
                } catch (e) {
                    extArr = [];
                }
            }
            renderExtensions(extArr);
            tariffFormTitle.textContent = 'Редактировать тариф';
            tariffCancelBtn.classList.remove('hidden');
        } catch (err) {
            alert('Ошибка загрузки тарифа: ' + (err.message || err));
        }
    }

    function resetTariffForm() {
        tariffIdInput.value = '';
        tariffTitleInput.value = '';
        if (tariffDescriptionInput) {
            tariffDescriptionInput.value = '';
        }
        tariffActiveCheckbox.checked = true;
        tariffFormTitle.textContent = 'Создать новый тариф';
        tariffCancelBtn.classList.add('hidden');
        // Очищаем список сроков
        if (extensionsList) {
            extensionsList.innerHTML = '';
        }
    }

    // Загрузка клиентов
    async function loadClients() {
        const tbody = document.querySelector('#clients-table tbody');
        tbody.innerHTML = '';
        // Если нет Supabase, загружаем локально
        if (!supabase) {
            let data;
            try {
                const resp = await fetch('/api/clients');
                if (resp.ok) {
                    data = await resp.json();
                    localStorage.setItem('clients', JSON.stringify(data));
                } else {
                    throw new Error('API unavailable');
                }
            } catch (err) {
                // Фоллбэк: читаем из localStorage
                try {
                    data = JSON.parse(localStorage.getItem('clients') || '[]');
                } catch (e) {
                    data = [];
                }
            }
            clientsData = data || [];
            clientsData.forEach(c => {
                const tr = document.createElement('tr');
                const date = c.created_at ? new Date(c.created_at).toLocaleDateString() : '';
                // Parse passport summary from extra.recognized_data
                let passportSummary = '';
                if (c.extra) {
                    try {
                        const extraObj = JSON.parse(c.extra);
                        const rec = extraObj && extraObj.recognized_data;
                        if (rec) {
                            if (rec['Фамилия']) {
                                passportSummary = `${rec['Фамилия']} ${rec['Имя'] || ''}`.trim();
                            } else if (rec['ФИО']) {
                                passportSummary = rec['ФИО'];
                            }
                            // Append passport number if available
                            if (rec['Номер паспорта']) {
                                passportSummary += passportSummary ? ` (${rec['Номер паспорта']})` : rec['Номер паспорта'];
                            }
                        }
                    } catch (e) {}
                }
                tr.innerHTML = `<td>${c.name}</td>` +
                               `<td>${c.phone || ''}</td>` +
                               `<td>${c.city || ''}</td>` +
                               `<td>${date}</td>` +
                               `<td>${passportSummary}</td>` +
                               `<td>` +
                               `<button type="button" class="view-client-btn" data-id="${c.id}">Инфо</button> ` +
                               `<button type="button" class="edit-client-btn" data-id="${c.id}">Ред.</button>` +
                               `</td>`;
                tbody.appendChild(tr);
            });
            return;
        }
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('id,name,phone,city,created_at')
                .order('created_at', { ascending: false });
            if (error) throw error;
            data.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${c.name}</td><td>${c.phone}</td><td>${c.city || ''}</td><td>${new Date(c.created_at).toLocaleDateString()}</td>`;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
        }
    }

    // Загрузка аренд
    async function loadRentals() {
        const tbody = document.querySelector('#rentals-table tbody');
        tbody.innerHTML = '';
        if (!supabase) {
            let data;
            try {
                const resp = await fetch('/api/rentals');
                if (resp.ok) {
                    data = await resp.json();
                    localStorage.setItem('rentals', JSON.stringify(data));
                } else {
                    throw new Error('API unavailable');
                }
            } catch (err) {
                try {
                    data = JSON.parse(localStorage.getItem('rentals') || '[]');
                } catch (e) {
                    data = [];
                }
            }
            (data || []).forEach(r => {
                const tr = document.createElement('tr');
                const clientName = r.client_name || r.client_id;
                const tariffTitle = r.tariff_title || r.tariff_id || '';
                const start = r.starts_at ? new Date(r.starts_at).toLocaleString() : '';
                const end = r.ends_at ? new Date(r.ends_at).toLocaleString() : '';
                tr.innerHTML = `<td>${clientName}</td>` +
                               `<td>${tariffTitle}</td>` +
                               `<td>${start}</td>` +
                               `<td>${end}</td>` +
                               `<td>${r.status}</td>` +
                               `<td><button type="button" class="close-rental-btn" data-id="${r.id}">Закрыть</button></td>`;
                tbody.appendChild(tr);
            });
            return;
        }
        try {
            const { data, error } = await supabase
                .from('rentals')
                .select('id,client_id,tariff_id,starts_at,ends_at,status,total_rub, clients (name), tariffs (title)')
                .order('starts_at', { ascending: false });
            if (error) throw error;
            data.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${r.clients ? r.clients.name : r.client_id}</td>` +
                               `<td>${r.tariffs ? r.tariffs.title : r.tariff_id}</td>` +
                               `<td>${r.starts_at ? new Date(r.starts_at).toLocaleString() : ''}</td>` +
                               `<td>${r.ends_at ? new Date(r.ends_at).toLocaleString() : ''}</td>` +
                               `<td>${r.status}</td>` +
                               `<td><button type="button" class="close-rental-btn" data-id="${r.id}">Закрыть</button></td>`;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
        }
    }

    // Загрузка платежей
    async function loadPayments() {
        const tbody = document.querySelector('#payments-table tbody');
        tbody.innerHTML = '';
        if (!supabase) {
            let data;
            try {
                const resp = await fetch('/api/payments');
                if (resp.ok) {
                    data = await resp.json();
                    localStorage.setItem('payments', JSON.stringify(data));
                } else {
                    throw new Error('API unavailable');
                }
            } catch (err) {
                try {
                    data = JSON.parse(localStorage.getItem('payments') || '[]');
                } catch (e) {
                    data = [];
                }
            }
            (data || []).forEach(p => {
                const tr = document.createElement('tr');
                const clientName = p.client_id;
                const created = p.created_at ? new Date(p.created_at).toLocaleString() : '';
                tr.innerHTML = `<td>${clientName}</td>` +
                               `<td>${p.amount_rub}</td>` +
                               `<td>${p.method || ''}</td>` +
                               `<td>${p.status || ''}</td>` +
                               `<td>${created}</td>`;
                tbody.appendChild(tr);
            });
            return;
        }
        try {
            const { data, error } = await supabase
                .from('payments')
                .select('id,client_id,amount_rub,method,status,created_at, clients (name)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            data.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${p.clients ? p.clients.name : p.client_id}</td>` +
                               `<td>${p.amount_rub}</td>` +
                               `<td>${p.method}</td>` +
                               `<td>${p.status}</td>` +
                               `<td>${p.created_at ? new Date(p.created_at).toLocaleString() : ''}</td>`;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error(err);
        }
    }

    // Экспорт клиентов в CSV
    const exportBtn = document.getElementById('export-clients-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            if (!supabase) {
                // Экспортируем клиентов через локальный API
                try {
                    const resp = await fetch('/api/clients');
                    if (!resp.ok) throw new Error('Failed to load clients');
                    const data = await resp.json();
                    const csvRows = [];
                    csvRows.push(['id','name','phone','city','created_at'].join(','));
                    data.forEach(c => {
                        csvRows.push([c.id, c.name, c.phone || '', c.city || '', c.created_at || ''].join(','));
                    });
                    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'clients.csv';
                    link.click();
                    URL.revokeObjectURL(url);
                } catch (err) {
                    alert('Ошибка экспорта: ' + (err.message || err));
                }
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('clients')
                    .select('*');
                if (error) throw error;
                const csvRows = [];
                csvRows.push(['id','name','phone','city','tg_user_id','created_at'].join(','));
                data.forEach(c => {
                    csvRows.push([c.id, c.name, c.phone, c.city || '', c.tg_user_id || '', c.created_at].join(','));
                });
                const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'clients.csv';
                link.click();
                URL.revokeObjectURL(url);
            } catch (err) {
                alert('Ошибка экспорта: ' + (err.message || err));
            }
        });
    }

    // === Клиенты: редактирование паспортных данных ===
    const clientsSectionElement = document.getElementById('clients-section');
    const clientEditOverlay = document.getElementById('client-edit-overlay');
    const clientEditForm = document.getElementById('client-edit-form');
    const clientEditCancelBtn = document.getElementById('client-edit-cancel');
    const clientEditSaveBtn = document.getElementById('client-edit-save');
    let currentEditingId = null;
    let currentEditingExtra = null;

    if (clientsSectionElement) {
        clientsSectionElement.addEventListener('click', (e) => {
            // Handle view button
            const viewBtn = e.target.closest('.view-client-btn');
            if (viewBtn) {
                const id = parseInt(viewBtn.getAttribute('data-id'), 10);
                const client = (clientsData || []).find(c => parseInt(c.id, 10) === id);
                if (!client) return;
                // Parse recognized data
                let recognized = {};
                if (client.extra) {
                    try {
                        const extraObj = JSON.parse(client.extra);
                        recognized = extraObj.recognized_data || {};
                    } catch (err) {
                        recognized = {};
                    }
                }
                // Fill info overlay
                const infoOverlay = document.getElementById('client-info-overlay');
                const infoContent = document.getElementById('client-info-content');
                if (infoOverlay && infoContent) {
                    infoContent.innerHTML = '';
                    Object.keys(recognized).forEach(key => {
                        const row = document.createElement('div');
                        row.className = 'info-row';
                        const label = document.createElement('strong');
                        label.textContent = key + ': ';
                        const val = document.createElement('span');
                        val.textContent = recognized[key] || '';
                        row.appendChild(label);
                        row.appendChild(val);
                        infoContent.appendChild(row);
                    });
                    infoOverlay.classList.remove('hidden');
                }
                return;
            }
            // Handle edit button
            const btn = e.target.closest('.edit-client-btn');
            if (!btn) return;
            const id = parseInt(btn.getAttribute('data-id'), 10);
            const client = (clientsData || []).find(c => parseInt(c.id, 10) === id);
            if (!client) return;
            // Parse recognized data
            let recognized = {};
            if (client.extra) {
                try {
                    const extraObj = JSON.parse(client.extra);
                    recognized = extraObj.recognized_data || {};
                } catch (e) {
                    recognized = {};
                }
            }
            // Build dynamic form fields
            clientEditForm.innerHTML = '';
            Object.keys(recognized).forEach(key => {
                const wrapper = document.createElement('div');
                wrapper.className = 'form-group';
                const label = document.createElement('label');
                label.textContent = key;
                let inputEl;
                const longFieldKeys = ['Кем выдан', 'Адрес регистрации', 'Адрес регистрации в РФ'];
                if (longFieldKeys.includes(key)) {
                    inputEl = document.createElement('textarea');
                    inputEl.rows = 2;
                } else {
                    inputEl = document.createElement('input');
                    inputEl.type = 'text';
                }
                inputEl.name = key;
                inputEl.value = recognized[key] || '';
                // mirror the styles from the registration overlay for consistency
                inputEl.style.width = '100%';
                inputEl.style.padding = '14px';
                inputEl.style.border = '1px solid var(--border-color)';
                inputEl.style.borderRadius = '14px';
                inputEl.style.fontSize = '1rem';
                wrapper.appendChild(label);
                wrapper.appendChild(inputEl);
                clientEditForm.appendChild(wrapper);
            });
            currentEditingId = id;
            currentEditingExtra = client.extra || null;
            clientEditOverlay.classList.remove('hidden');
        });
    }

    // Cancel button hides the overlay without saving
    if (clientEditCancelBtn) {
        clientEditCancelBtn.addEventListener('click', () => {
            clientEditOverlay.classList.add('hidden');
        });
    }

    // Save button updates recognized data and sends to API/localStorage
    if (clientEditSaveBtn) {
        clientEditSaveBtn.addEventListener('click', async () => {
            if (!currentEditingId) return;
            // Build updated recognized data object
            const updatedRec = {};
            const inputs = clientEditForm.querySelectorAll('input[name]');
            inputs.forEach(inp => {
                updatedRec[inp.name] = inp.value.trim();
            });
            // Merge with existing extra
            let extraObj = {};
            if (currentEditingExtra) {
                try { extraObj = JSON.parse(currentEditingExtra); } catch (e) {}
            }
            extraObj.recognized_data = updatedRec;
            const extraStr = JSON.stringify(extraObj);
            // Attempt to update via API if available
            let updated = false;
            try {
                const resp = await fetch(`/api/clients/${currentEditingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ extra: extraStr })
                });
                if (resp.ok) {
                    updated = true;
                }
            } catch (e) {
                console.warn('API update failed, updating localStorage', e);
            }
            if (!updated) {
                // Update local copy and localStorage as fallback
                const idx = (clientsData || []).findIndex(c => parseInt(c.id, 10) === currentEditingId);
                if (idx >= 0) {
                    clientsData[idx].extra = extraStr;
                    try {
                        localStorage.setItem('clients', JSON.stringify(clientsData));
                    } catch (e) {}
                }
            }
            clientEditOverlay.classList.add('hidden');
            // Reload clients to reflect changes
            loadClients();
        });
    }

    // === Клиенты: просмотр паспортных данных ===
    const clientInfoOverlay = document.getElementById('client-info-overlay');
    const clientInfoCloseBtn = document.getElementById('client-info-close');
    if (clientInfoCloseBtn) {
        clientInfoCloseBtn.addEventListener('click', () => {
            if (clientInfoOverlay) clientInfoOverlay.classList.add('hidden');
        });
    }

    // Инициализируем — проверяем сессию, если возможно
    if (supabase) {
        checkSession();
    }
});
