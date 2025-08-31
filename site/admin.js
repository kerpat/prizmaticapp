// Скрипт для админ‑панели.
//
// В этом файле реализована простая аутентификация и базовые операции
// CRUD для тарифов, а также каркас для отображения клиентов, аренд и
// платежей. Для работы с реальной базой требуется Supabase.

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
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

    // Tariff elements
    const tariffTableBody = document.querySelector('#tariffs-table tbody');
    const tariffForm = document.getElementById('tariff-form');
    const tariffFormTitle = document.getElementById('tariff-form-title');
    const tariffIdInput = document.getElementById('tariff-id');
    const tariffTitleInput = document.getElementById('tariff-title');
    const tariffDescriptionInput = document.getElementById('tariff-description');
    const tariffActiveCheckbox = document.getElementById('tariff-active');
    const tariffCancelBtn = document.getElementById('tariff-cancel-btn');
    const extensionsList = document.getElementById('extensions-list');
    const addExtensionBtn = document.getElementById('add-extension-btn');

    // Client elements
    const clientsTableBody = document.querySelector('#clients-table tbody');
    const clientEditOverlay = document.getElementById('client-edit-overlay');
    const clientEditForm = document.getElementById('client-edit-form');
    const clientEditCancelBtn = document.getElementById('client-edit-cancel');
    const clientEditSaveBtn = document.getElementById('client-edit-save');
    const clientInfoOverlay = document.getElementById('client-info-overlay');
    const clientInfoContent = document.getElementById('client-info-content');
    const clientInfoCloseBtn = document.getElementById('client-info-close');
    const exportBtn = document.getElementById('export-clients-btn');

    // --- State Variables ---
    let clientsData = []; // Кэш данных клиентов для просмотра/редактирования
    let currentEditingId = null;
    let currentEditingExtra = null;

    // --- Supabase Initialization ---
    const SUPABASE_URL = 'https://avamqfmuhiwtlumjkzmv.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YW1xZm11aGl3dGx1bWprem12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjMyODcsImV4cCI6MjA3MjIzOTI4N30.EwEPM0pObAd3v_NXI89DLcgKVYrUiOn7iHuCXXaqU4I';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- Tariff Extensions Logic ---

    function addExtensionRow(daysVal = '', priceVal = '') {
        if (!extensionsList) return;
        const row = document.createElement('div');
        row.className = 'extension-row';
        row.innerHTML = `
            <input type="number" placeholder="Дней" value="${daysVal}" class="ext-days">
            <input type="number" placeholder="Стоимость (₽)" value="${priceVal}" class="ext-price">
            <button type="button" class="remove-extension-btn" title="Удалить">×</button>
        `;
        row.querySelector('.remove-extension-btn').addEventListener('click', () => row.remove());
        extensionsList.appendChild(row);
    }

    function renderExtensions(extArr) {
        if (!extensionsList) return;
        extensionsList.innerHTML = '';
        if (Array.isArray(extArr)) {
            extArr.forEach(ext => {
                const d = ext?.days || ext?.duration;
                const c = ext?.cost || ext?.price;
                addExtensionRow(d || '', c || '');
            });
        }
    }

    function getExtensionsFromForm() {
        if (!extensionsList) return [];
        return Array.from(extensionsList.querySelectorAll('.extension-row')).map(row => {
            const days = parseInt(row.querySelector('.ext-days').value, 10);
            const cost = parseInt(row.querySelector('.ext-price').value, 10);
            return { days, cost };
        }).filter(ext => !isNaN(ext.days) && !isNaN(ext.cost) && ext.days > 0 && ext.cost >= 0);
    }

    if (addExtensionBtn) {
        addExtensionBtn.addEventListener('click', () => addExtensionRow());
    }

    // --- Authentication and Navigation ---

    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            showDashboard();
        }
    }

    function showDashboard() {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        selectSection('tariffs');
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginEmail.value;
        const password = loginPassword.value;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            alert('Ошибка входа: ' + error.message);
        } else if (data.user) {
            showDashboard();
        }
    });

    adminNav.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-section]');
        if (!btn) return;
        const target = btn.dataset.section;
        adminNav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectSection(target);
    });

    function selectSection(name) {
        [tariffsSection, clientsSection, rentalsSection, paymentsSection].forEach(sec => sec.classList.add('hidden'));
        const sectionMap = {
            'tariffs': { element: tariffsSection, loader: loadTariffs },
            'clients': { element: clientsSection, loader: loadClients },
            'rentals': { element: rentalsSection, loader: loadRentals },
            'payments': { element: paymentsSection, loader: loadPayments },
        };
        if (sectionMap[name]) {
            sectionMap[name].element.classList.remove('hidden');
            sectionMap[name].loader();
        }
    }

    // --- Tariffs CRUD ---

    function formatExtensionsForDisplay(exts) {
        if (!Array.isArray(exts) || exts.length === 0) return 'Не заданы';
        return exts.map(e => `${e.days} дн. - ${e.cost} ₽`).join('<br>');
    }

    async function loadTariffs() {
        tariffTableBody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
        try {
            const { data, error } = await supabase.from('tariffs').select('*').order('id', { ascending: true });
            if (error) throw error;
            tariffTableBody.innerHTML = '';
            if (!data || data.length === 0) {
                tariffTableBody.innerHTML = '<tr><td colspan="5">Тарифы еще не созданы.</td></tr>';
                return;
            }
            data.forEach(t => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${t.title}</td>
                    <td>${t.description || ''}</td>
                    <td>${formatExtensionsForDisplay(t.extensions)}</td>
                    <td>${t.is_active ? 'Да' : 'Нет'}</td>
                    <td>
                        <button type="button" class="edit-tariff-btn" data-id="${t.id}">Ред.</button>
                        <button type="button" class="delete-tariff-btn" data-id="${t.id}">Удалить</button>
                    </td>`;
                tariffTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Ошибка загрузки тарифов:', err);
            tariffTableBody.innerHTML = `<tr><td colspan="5">Ошибка: ${err.message}</td></tr>`;
        }
    }

    tariffForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = tariffIdInput.value;
        const extArr = getExtensionsFromForm();
        const newTariffData = {
            title: tariffTitleInput.value,
            description: tariffDescriptionInput.value,
            is_active: tariffActiveCheckbox.checked,
            price_rub: extArr.length > 0 ? extArr[0].cost : 0, // for legacy compatibility
            duration_days: extArr.length > 0 ? extArr[0].days : 0, // for legacy compatibility
            slug: tariffTitleInput.value.trim().toLowerCase().replace(/\s+/g, '-'),
            extensions: extArr
        };
        try {
            const { error } = id
                ? await supabase.from('tariffs').update(newTariffData).eq('id', id)
                : await supabase.from('tariffs').insert([newTariffData]);
            if (error) throw error;
            await loadTariffs();
            resetTariffForm();
        } catch (err) {
            alert('Ошибка сохранения тарифа: ' + err.message);
        }
    });

    tariffTableBody.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-tariff-btn');
        if (editBtn) {
            editTariff(editBtn.dataset.id);
            return;
        }

        const deleteBtn = e.target.closest('.delete-tariff-btn');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (confirm(`Вы уверены, что хотите удалить тариф с ID ${id}? Это действие необратимо.`)) {
                try {
                    const { error } = await supabase.from('tariffs').delete().eq('id', id);
                    if (error) throw error;
                    alert('Тариф успешно удален.');
                    loadTariffs();
                } catch (err) {
                    alert('Ошибка удаления: ' + err.message);
                }
            }
        }
    });

    async function editTariff(id) {
        try {
            const { data, error } = await supabase.from('tariffs').select('*').eq('id', id).single();
            if (error) throw error;
            tariffIdInput.value = data.id;
            tariffTitleInput.value = data.title;
            tariffDescriptionInput.value = data.description || '';
            tariffActiveCheckbox.checked = data.is_active;
            renderExtensions(data.extensions);
            tariffFormTitle.textContent = 'Редактировать тариф';
            tariffCancelBtn.classList.remove('hidden');
        } catch (err) {
            alert('Ошибка загрузки тарифа для редактирования: ' + err.message);
        }
    }

    function resetTariffForm() {
        tariffForm.reset();
        tariffIdInput.value = '';
        if (extensionsList) extensionsList.innerHTML = '';
        tariffFormTitle.textContent = 'Создать новый тариф';
        tariffCancelBtn.classList.add('hidden');
    }

    tariffCancelBtn.addEventListener('click', resetTariffForm);

    // --- Clients Logic ---

    async function loadClients() {
        clientsTableBody.innerHTML = '<tr><td colspan="6">Загрузка клиентов...</td></tr>';
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            clientsData = data || []; // Кэшируем данные для модальных окон
            clientsTableBody.innerHTML = '';

            if (clientsData.length === 0) {
                clientsTableBody.innerHTML = '<tr><td colspan="6">Клиенты не найдены.</td></tr>';
                return;
            }

            clientsData.forEach(client => {
                const tr = document.createElement('tr');
                const date = new Date(client.created_at).toLocaleDateString();
                const recognizedData = client.extra?.recognized_data || {};
                const passportSummary = `${recognizedData['Фамилия'] || ''} ${recognizedData['Имя'] || ''}`.trim();

                tr.innerHTML = `
                    <td>${client.name}</td>
                    <td>${client.phone || ''}</td>
                    <td>${client.city || ''}</td>
                    <td>${date}</td>
                    <td>${passportSummary || 'Нет данных'}</td>
                    <td>
                        <button type="button" class="view-client-btn" data-id="${client.id}">Инфо</button>
                        <button type="button" class="edit-client-btn" data-id="${client.id}">Ред.</button>
                    </td>`;
                clientsTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Ошибка загрузки клиентов:', err);
            clientsTableBody.innerHTML = `<tr><td colspan="6">Ошибка: ${err.message}</td></tr>`;
        }
    }
    
    // --- Rentals and Payments Loaders ---

    async function loadRentals() {
        const tbody = document.querySelector('#rentals-table tbody');
        tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
        try {
            const { data, error } = await supabase
                .from('rentals')
                .select('id, starts_at, ends_at, status, clients (name), tariffs (title)')
                .order('starts_at', { ascending: false });
            if (error) throw error;
            tbody.innerHTML = '';
            data.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${r.clients?.name || 'Н/Д'}</td>
                    <td>${r.tariffs?.title || 'Н/Д'}</td>
                    <td>${new Date(r.starts_at).toLocaleString()}</td>
                    <td>${new Date(r.ends_at).toLocaleString()}</td>
                    <td>${r.status}</td>
                    <td><button type="button" class="close-rental-btn" data-id="${r.id}">Закрыть</button></td>`;
                tbody.appendChild(tr);
            });
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6">Ошибка загрузки аренд: ${err.message}</td></tr>`;
        }
    }
    
    async function loadPayments() {
        const tbody = document.querySelector('#payments-table tbody');
        tbody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
        try {
            const { data, error } = await supabase
                .from('payments')
                .select('id, amount_rub, method, status, created_at, clients (name)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            tbody.innerHTML = '';
            data.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.clients?.name || 'Н/Д'}</td>
                    <td>${p.amount_rub}</td>
                    <td>${p.method}</td>
                    <td>${p.status}</td>
                    <td>${new Date(p.created_at).toLocaleString()}</td>`;
                tbody.appendChild(tr);
            });
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="5">Ошибка загрузки платежей: ${err.message}</td></tr>`;
        }
    }

    // --- Client Info/Edit Modals Logic ---
    if (clientsSection) {
        clientsSection.addEventListener('click', async (e) => {
            const viewBtn = e.target.closest('.view-client-btn');
            const editBtn = e.target.closest('.edit-client-btn');
            if (!viewBtn && !editBtn) return;

            const clientId = parseInt(viewBtn ? viewBtn.dataset.id : editBtn.dataset.id, 10);
            const client = clientsData.find(c => c.id === clientId);
            if (!client) return;

            const recognizedData = client.extra?.recognized_data || {};

            // --- ЛОГИКА ДЛЯ ПРОСМОТРА ИНФОРМАЦИИ И ФОТО ---
            if (viewBtn) {
                const recognizedContainer = document.getElementById('recognized-data-container');
                const photoLinksDiv = document.getElementById('photo-links');

                // Убедимся, что все нужные элементы существуют, прежде чем работать с ними
                if (!clientInfoOverlay || !recognizedContainer || !photoLinksDiv) {
                    console.error('Ошибка: один или несколько элементов модального окна не найдены в HTML.');
                    alert('Ошибка интерфейса: не найдены элементы для отображения информации. Проверьте HTML-структуру.');
                    return;
                }

                // 1. Очищаем и заполняем текстовые данные
                recognizedContainer.innerHTML = '';
                if (Object.keys(recognizedData).length > 0) {
                    for (const key in recognizedData) {
                        recognizedContainer.innerHTML += `<div><strong>${key}:</strong> ${recognizedData[key] || 'Н/Д'}</div>`;
                    }
                } else {
                    recognizedContainer.innerHTML = '<p>Распознанные данные отсутствуют.</p>';
                }

                // 2. Показываем оверлей и начинаем загрузку фото
                photoLinksDiv.innerHTML = 'Загрузка...';
                clientInfoOverlay.classList.remove('hidden');

                // 3. Запрашиваем и отображаем ссылки на фото
                try {
                    const { data: files, error } = await supabase.storage.from('passports').list(client.id.toString());
                    if (error) throw error;

                    if (!files || files.length === 0) {
                        photoLinksDiv.innerHTML = '<p>Фото не найдены.</p>';
                    } else {
                        const links = files.map(file => {
                            const { data } = supabase.storage.from('passports').getPublicUrl(`${client.id}/${file.name}`);
                            return `<a href="${data.publicUrl}" target="_blank" rel="noopener noreferrer" style="display: block; margin-bottom: 5px;">${file.name}</a>`;
                        });
                        photoLinksDiv.innerHTML = links.join('');
                    }
                } catch (err) {
                    console.error('Ошибка загрузки фото:', err);
                    photoLinksDiv.innerHTML = `<p style="color: red;">Ошибка загрузки фото: ${err.message}</p>`;
                }
            }

            // --- ЛОГИКА ДЛЯ РЕДАКТИРОВАНИЯ ---
            if (editBtn) {
                clientEditForm.innerHTML = '';
                for (const key in recognizedData) {
                    const longFieldKeys = ['Кем выдан', 'Адрес регистрации', 'Адрес регистрации в РФ'];
                    let inputEl;
                    if (longFieldKeys.includes(key)) {
                        inputEl = `<textarea name="${key}" rows="2">${recognizedData[key] || ''}</textarea>`;
                    } else {
                        inputEl = `<input type="text" name="${key}" value="${recognizedData[key] || ''}">`;
                    }
                    clientEditForm.innerHTML += `<div class="form-group"><label>${key}</label>${inputEl}</div>`;
                }
                currentEditingId = client.id;
                currentEditingExtra = client.extra;
                clientEditOverlay.classList.remove('hidden');
            }
        });
    }

    if (clientInfoCloseBtn) {
        clientInfoCloseBtn.addEventListener('click', () => clientInfoOverlay.classList.add('hidden'));
    }

    if (clientEditCancelBtn) {
        clientEditCancelBtn.addEventListener('click', () => clientEditOverlay.classList.add('hidden'));
    }
    
    if (clientEditSaveBtn) {
        clientEditSaveBtn.addEventListener('click', async () => {
            if (!currentEditingId) return;

            const updatedRec = {};
            clientEditForm.querySelectorAll('input, textarea').forEach(inp => {
                updatedRec[inp.name] = inp.value.trim();
            });
            
            // Создаем новый объект `extra` на основе старого, но с обновленными данными
            const extraObj = JSON.parse(JSON.stringify(currentEditingExtra || {}));
            extraObj.recognized_data = updatedRec;

            try {
                const { error } = await supabase
                    .from('clients')
                    .update({ extra: extraObj })
                    .eq('id', currentEditingId);
                if (error) throw error;
                
                alert('Данные клиента успешно обновлены.');
                clientEditOverlay.classList.add('hidden');
                await loadClients(); // Перезагружаем список клиентов для отображения изменений
            } catch (err) {
                alert('Ошибка сохранения данных: ' + err.message);
            }
        });
    }

    // --- Export Logic ---
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                const { data, error } = await supabase.from('clients').select('*');
                if (error) throw error;

                const headers = ['id', 'name', 'phone', 'city', 'tg_user_id', 'created_at'];
                const csvRows = [headers.join(',')];
                data.forEach(c => {
                    const row = headers.map(header => JSON.stringify(c[header] || ''));
                    csvRows.push(row.join(','));
                });

                const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
                URL.revokeObjectURL(url);
            } catch (err) {
                alert('Ошибка экспорта: ' + err.message);
            }
        });
    }

    // --- Initial Load ---
    checkSession();
});