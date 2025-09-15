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

    const dashboardMainSection = document.getElementById('dashboard-main-section');

    const tariffsSection = document.getElementById('tariffs-section');
    const clientsSection = document.getElementById('clients-section');
    const rentalsSection = document.getElementById('rentals-section');
    const paymentsSection = document.getElementById('payments-section');
    const bikesSection = document.getElementById('bikes-section');
    const assignmentsSection = document.getElementById('assignments-section');
    // duplicate removed: const templatesSection

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
    const clientInfoCloseBtn2 = document.getElementById('client-info-close-2');
    const clientInfoEditToggle = document.getElementById('client-info-edit-toggle');
    const clientInfoSaveBtn = document.getElementById('client-info-save');
    const recognizedDisplay = document.getElementById('recognized-display');
    const recognizedEditForm = document.getElementById('recognized-edit-form');
    const imageViewerOverlay = document.getElementById('image-viewer-overlay');
    const imageViewerImg = document.getElementById('image-viewer-img');
    const imageViewerClose = document.getElementById('image-viewer-close');
    const imageViewerPrev = document.getElementById('image-viewer-prev');
    const imageViewerNext = document.getElementById('image-viewer-next');
    let viewerImages = [];
    let viewerIndex = 0;
    // keep last caret position inside template editor
    let lastSelRange = null;
    const exportBtn = document.getElementById('export-clients-btn');
    const contractTemplateSelect = document.getElementById('contract-template-select');

    // Bike elements
    const bikesTableBody = document.querySelector('#bikes-table tbody');
    const bikeAddBtn = document.getElementById('bike-add-btn');
    const bikeForm = document.getElementById('bike-form');
    const bikeFormTitle = document.getElementById('bike-form-title');
    const bikeIdInput = document.getElementById('bike-id');
    const bikeCodeInput = document.getElementById('bike-code');
    const bikeModelInput = document.getElementById('bike-model');
    const bikeStatusSelect = document.getElementById('bike-status');
    const bikeCancelBtn = document.getElementById('bike-cancel-btn');

    // Assignment elements
    const assignmentsTableBody = document.querySelector('#assignments-table tbody');
    const assignBikeModal = document.getElementById('assign-bike-modal');
    const assignRentalIdInput = document.getElementById('assign-rental-id');
    const bikeSelect = document.getElementById('bike-select');
    const assignBikeCancelBtn = document.getElementById('assign-bike-cancel-btn');
    const assignBikeSubmitBtn = document.getElementById('assign-bike-submit-btn');

    // Invoice elements
    const invoiceCreateBtn = document.getElementById('invoice-create-btn');
    const invoiceModal = document.getElementById('invoice-modal');
    const invoiceCancelBtn = document.getElementById('invoice-cancel-btn');
    const invoiceSubmitBtn = document.getElementById('invoice-submit-btn');
    const invoiceClientIdInput = document.getElementById('invoice-client-id');
    const invoiceAmountInput = document.getElementById('invoice-amount');
    const invoiceDescriptionInput = document.getElementById('invoice-description');

    // Templates elements
    // duplicate removed: const templatesTableBody
    // duplicate removed: const templateNewBtn
    // duplicate removed: const templateSaveBtn
    // duplicate removed: const templateIdInput
    // duplicate removed: const templateNameInput
    // duplicate removed: const templateActiveCheckbox
    // duplicate removed: const templateEditor
    const chipsClient = document.getElementById('chips-client');
    const chipsTariff = document.getElementById('chips-tariff');
    const chipsRental = document.getElementById('chips-rental');
    const chipsAux = document.getElementById('chips-aux');

    // --- State Variables ---
    let clientsData = []; // Кэш данных клиентов для просмотра/редактирования
    let currentEditingId = null;
    let currentEditingExtra = null;

    // --- Supabase Initialization ---
    const SUPABASE_URL = 'https://avamqfmuhiwtlumjkzmv.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YW1xZm11aGl3dGx1bWprem12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjMyODcsImV4cCI6MjA3MjIzOTI4N30.EwEPM0pObAd3v_NXI89DLcgKVYrUiOn7iHuCXXaqU4I';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    function toggleButtonLoading(btn, isLoading, textIdle, textBusy) {
        if (!btn) return;
        btn.disabled = !!isLoading;
        if (isLoading) {
            btn.classList.add('loading');
            btn.setAttribute('data-original-text', btn.textContent);
            btn.textContent = textBusy || 'Загрузка...';
        } else {
            btn.classList.remove('loading');
            const originalText = btn.getAttribute('data-original-text');
            if (originalText) {
                btn.textContent = originalText;
                btn.removeAttribute('data-original-text');
            } else {
                btn.textContent = textIdle || btn.textContent;
            }
        }
    }

    // Toast Notification System
    function showToast(message, type = 'info', duration = 5000) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type} fade-in`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">${message}</div>
            <button class="toast-close" aria-label="Закрыть">&times;</button>
        `;

        toastContainer.appendChild(toast);

        // Auto remove after duration
        const timeoutId = setTimeout(() => {
            removeToast(toast);
        }, duration);

        // Manual close
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            clearTimeout(timeoutId);
            removeToast(toast);
        });

        function removeToast(toastElement) {
            toastElement.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (toastElement.parentNode) {
                    toastElement.parentNode.removeChild(toastElement);
                }
            }, 300);
        }
    }

    // Enhanced loading overlay
    function showLoadingOverlay(element, message = 'Загрузка...') {
        if (!element) return;

        const existing = element.querySelector('.loading-overlay');
        if (existing) return existing;

        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div style="text-align: center;">
                <div class="loading-spinner"></div>
                <p style="margin-top: var(--admin-space-sm); color: var(--admin-text-secondary);">${message}</p>
            </div>
        `;

        element.style.position = 'relative';
        element.appendChild(overlay);
        return overlay;
    }

    function hideLoadingOverlay(element) {
        const overlay = element?.querySelector('.loading-overlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => overlay.remove(), 300);
        }
    }

    // --- Tariff Extensions Logic ---

    // Helper: render client info modal (view + edit + photos + lightbox)
    async function renderClientInfo(clientId) {
        try {
            const { data: client, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
            if (error) throw error;

            const rec = client?.extra?.recognized_data || {};
            if (recognizedDisplay) {
                recognizedDisplay.innerHTML = '';
                const keys = Object.keys(rec);
                if (keys.length === 0) {
                    recognizedDisplay.innerHTML = '<p>Данных распознавания нет.</p>';
                } else {
                    keys.forEach(k => {
                        const row = document.createElement('div');
                        row.className = 'info-row';
                        row.innerHTML = `<strong>${k}:</strong><span>${rec[k] ?? ''}</span>`;
                        recognizedDisplay.appendChild(row);
                    });
                }
            }
            if (recognizedEditForm) {
                recognizedEditForm.innerHTML = '';
                Object.keys(rec).forEach(k => {
                    const item = document.createElement('div');
                    item.className = 'form-group';
                    const val = (rec[k] ?? '').toString().replace(/"/g,'&quot;');
                    item.innerHTML = `<label>${k}</label><input type="text" name="${k}" value="${val}">`;
                    recognizedEditForm.appendChild(item);
                });
                recognizedEditForm.classList.add('hidden');
                if (clientInfoEditToggle) clientInfoEditToggle.textContent = 'Редактировать';
                if (clientInfoSaveBtn) clientInfoSaveBtn.classList.add('hidden');
            }

            // Photos grid
            const photosDiv = document.getElementById('photo-links');
            if (photosDiv) {
                photosDiv.innerHTML = 'Загрузка...';
                try {
                    const { data: files, error: fErr } = await supabase.storage.from('passports').list(String(clientId));
                    if (fErr) throw fErr;
                    if (!files || files.length === 0) {
                        photosDiv.innerHTML = '<p>Фото не найдены.</p>';
                        viewerImages = [];
                    } else {
                        photosDiv.innerHTML = '';
                        viewerImages = files.map(f => supabase.storage.from('passports').getPublicUrl(`${clientId}/${f.name}`).data.publicUrl);
                        viewerIndex = 0;
                        viewerImages.forEach(u => {
                            const img = document.createElement('img');
                            img.src = u;
                            img.className = 'client-photo-thumb';
                            img.addEventListener('click', () => {
                                if (imageViewerOverlay && imageViewerImg) {
                                    imageViewerImg.src = u;
                                    viewerIndex = viewerImages.indexOf(u);
                                    imageViewerOverlay.classList.remove('hidden');
                                }
                            });
                            photosDiv.appendChild(img);
                        });
                    }
                } catch (e) {
                    photosDiv.innerHTML = `<p style="color:red;">Ошибка загрузки фото: ${e.message}</p>`;
                }
            }

            // Toggle edit/view
            currentEditingId = client.id;
            currentEditingExtra = client.extra || {};
            if (clientInfoEditToggle) {
                clientInfoEditToggle.onclick = () => {
                    const editing = !recognizedEditForm.classList.contains('hidden');
                    if (editing) {
                        recognizedEditForm.classList.add('hidden');
                        recognizedDisplay.classList.remove('hidden');
                        clientInfoEditToggle.textContent = 'Редактировать';
                        if (clientInfoSaveBtn) clientInfoSaveBtn.classList.add('hidden');
                    } else {
                        recognizedEditForm.classList.remove('hidden');
                        recognizedDisplay.classList.add('hidden');
                        clientInfoEditToggle.textContent = 'Просмотр';
                        if (clientInfoSaveBtn) clientInfoSaveBtn.classList.remove('hidden');
                    }
                };
            }
            if (clientInfoSaveBtn) {
                clientInfoSaveBtn.onclick = async () => {
                    const formData = new FormData(recognizedEditForm);
                    const updated = {};
                    for (const [k,v] of formData.entries()) updated[k] = String(v);
                    const extraObj = JSON.parse(JSON.stringify(currentEditingExtra || {}));
                    extraObj.recognized_data = updated;
                    const { error: uerr } = await supabase.from('clients').update({ extra: extraObj }).eq('id', currentEditingId);
                    if (uerr) { alert('Ошибка сохранения: ' + uerr.message); return; }
                    // refresh view
                    recognizedDisplay.innerHTML = '';
                    Object.keys(updated).forEach(k => {
                        const r = document.createElement('div');
                        r.className = 'info-row';
                        r.innerHTML = `<strong>${k}:</strong><span>${updated[k]}</span>`;
                        recognizedDisplay.appendChild(r);
                    });
                    currentEditingExtra = extraObj;
                    clientInfoEditToggle.click();
                };
            }

            // lightbox arrows
            if (imageViewerPrev) imageViewerPrev.onclick = () => {
                if (!viewerImages.length) return;
                viewerIndex = (viewerIndex - 1 + viewerImages.length) % viewerImages.length;
                imageViewerImg.src = viewerImages[viewerIndex];
            };
            if (imageViewerNext) imageViewerNext.onclick = () => {
                if (!viewerImages.length) return;
                viewerIndex = (viewerIndex + 1) % viewerImages.length;
                imageViewerImg.src = viewerImages[viewerIndex];
            };
        } catch (e) {
            console.error('Ошибка подготовки карточки клиента:', e);
        }
    }

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
        selectSection('dashboard-main');
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const email = loginEmail.value;
        const password = loginPassword.value;

        toggleButtonLoading(submitBtn, true, 'Войти', 'Вход...');

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                showToast('Ошибка входа: ' + error.message, 'error');
            } else if (data.user) {
                showToast('Успешный вход в систему', 'success');
                showDashboard();
            }
        } catch (err) {
            showToast('Произошла ошибка при входе', 'error');
        } finally {
            toggleButtonLoading(submitBtn, false, 'Войти');
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
        [dashboardMainSection, tariffsSection, clientsSection, rentalsSection, paymentsSection, bikesSection, assignmentsSection, templatesSection].forEach(sec => sec && sec.classList.add('hidden'));
        const sectionMap = {
            'dashboard-main': { element: dashboardMainSection, loader: loadDashboardData },
            'tariffs': { element: tariffsSection, loader: loadTariffs },
            'clients': { element: clientsSection, loader: loadClients },
            'rentals': { element: rentalsSection, loader: loadRentals },
            'payments': { element: paymentsSection, loader: loadPayments },
            'bikes': { element: bikesSection, loader: loadBikes },
            'assignments': { element: assignmentsSection, loader: loadAssignments },
            'templates': { element: templatesSection, loader: loadTemplates },
        };
        if (sectionMap[name]) {
            sectionMap[name].element.classList.remove('hidden');
            if (sectionMap[name].loader) {
                sectionMap[name].loader();
            }
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
        const submitBtn = tariffForm.querySelector('button[type="submit"]');
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

        toggleButtonLoading(submitBtn, true, 'Сохранить', 'Сохранение...');

        try {
            const { error } = id
                ? await supabase.from('tariffs').update(newTariffData).eq('id', id)
                : await supabase.from('tariffs').insert([newTariffData]);
            if (error) throw error;

            await loadTariffs();
            resetTariffForm();
            showToast(id ? 'Тариф успешно обновлен' : 'Тариф успешно создан', 'success');
        } catch (err) {
            showToast('Ошибка сохранения тарифа: ' + err.message, 'error');
        } finally {
            toggleButtonLoading(submitBtn, false, 'Сохранить');
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
                toggleButtonLoading(deleteBtn, true, 'Удалить', 'Удаление...');
                try {
                    const { error } = await supabase.from('tariffs').delete().eq('id', id);
                    if (error) throw error;
                    await loadTariffs();
                    showToast('Тариф успешно удален', 'success');
                } catch (err) {
                    showToast('Ошибка удаления: ' + err.message, 'error');
                } finally {
                    toggleButtonLoading(deleteBtn, false, 'Удалить');
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

    // --- Refund Logic ---
    const refundModal = document.getElementById('refund-modal');
    const refundCancelBtn = document.getElementById('refund-cancel-btn');
    const refundSubmitBtn = document.getElementById('refund-submit-btn');
    const refundPaymentIdInput = document.getElementById('refund-payment-id');
    const refundAmountInput = document.getElementById('refund-amount');
    const refundReasonInput = document.getElementById('refund-reason');
    const paymentsTableBody = document.querySelector('#payments-table tbody');

    if (paymentsTableBody) {
        paymentsTableBody.addEventListener('click', (e) => {
            const refundBtn = e.target.closest('.refund-btn');
            if (refundBtn) {
                const paymentId = refundBtn.dataset.paymentId;
                const amount = refundBtn.dataset.amount;
                refundPaymentIdInput.value = paymentId;
                refundAmountInput.value = amount;
                refundModal.classList.remove('hidden');
            }
        });
    }

    if (refundCancelBtn) {
        refundCancelBtn.addEventListener('click', () => refundModal.classList.add('hidden'));
    }
    if (refundModal) {
        refundModal.addEventListener('click', (e) => {
            if (e.target === refundModal) refundModal.classList.add('hidden');
        });
    }

    if (refundSubmitBtn) {
        refundSubmitBtn.addEventListener('click', async () => {
            const payment_id = refundPaymentIdInput.value;
            const amount = refundAmountInput.value;
            const reason = refundReasonInput.value;

            if (!payment_id || !amount) {
                alert('ID платежа и сумма обязательны.');
                return;
            }

            toggleButtonLoading(refundSubmitBtn, true, 'Выполнить возврат', 'Обработка...');

            try {
                const response = await fetch('/.netlify/functions/create-refund', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payment_id, amount, reason })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || `Ошибка сервера: ${response.status}`);
                }

                alert(result.message || 'Запрос на возврат успешно отправлен.');
                refundModal.classList.add('hidden');
                loadPayments(); // Refresh the payments list

            } catch (err) {
                alert('Ошибка возврата: ' + err.message);
            } finally {
                toggleButtonLoading(refundSubmitBtn, false, 'Выполнить возврат', 'Обработка...');
            }
        });
    }

    // --- Bikes CRUD ---
    function showBikeForm(bike = null) {
        bikeForm.classList.remove('hidden');
        bikeFormTitle.classList.remove('hidden');
        if (bike) {
            bikeFormTitle.textContent = 'Редактировать велосипед';
            bikeIdInput.value = bike.id;
            bikeCodeInput.value = bike.bike_code;
            bikeModelInput.value = bike.model_name;
            bikeStatusSelect.value = bike.status;
        } else {
            bikeFormTitle.textContent = 'Новый велосипед';
            bikeForm.reset();
            bikeIdInput.value = '';
        }
    }

    function hideBikeForm() {
        bikeForm.classList.add('hidden');
        bikeFormTitle.classList.add('hidden');
        bikeForm.reset();
        bikeIdInput.value = '';
    }

    async function loadBikes() {
        if (!bikesTableBody) return;
        bikesTableBody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
        try {
            const { data, error } = await supabase.from('bikes').select('*').order('id', { ascending: true });
            if (error) throw error;
            bikesTableBody.innerHTML = '';
            if (!data || data.length === 0) {
                bikesTableBody.innerHTML = '<tr><td colspan="5">Велосипеды еще не добавлены.</td></tr>';
                return;
            }
            data.forEach(bike => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${bike.id}</td>
                    <td>${bike.bike_code}</td>
                    <td>${bike.model_name || ''}</td>
                    <td>${bike.status}</td>
                    <td class="table-actions">
                        <button type="button" class="edit-bike-btn" data-id="${bike.id}">Ред.</button>
                        <button type="button" class="delete-bike-btn" data-id="${bike.id}">Удалить</button>
                    </td>`;
                bikesTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Ошибка загрузки велосипедов:', err);
            bikesTableBody.innerHTML = `<tr><td colspan="5">Ошибка: ${err.message}</td></tr>`;
        }
    }

    if (bikeAddBtn) {
        bikeAddBtn.addEventListener('click', () => showBikeForm());
    }
    if (bikeCancelBtn) {
        bikeCancelBtn.addEventListener('click', hideBikeForm);
    }

    if (bikeForm) {
        bikeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = bikeIdInput.value;
            const bikeData = {
                bike_code: bikeCodeInput.value,
                model_name: bikeModelInput.value,
                status: bikeStatusSelect.value,
            };

            try {
                const { error } = id
                    ? await supabase.from('bikes').update(bikeData).eq('id', id)
                    : await supabase.from('bikes').insert([bikeData]);
                if (error) throw error;
                await loadBikes();
                hideBikeForm();
            } catch (err) {
                alert('Ошибка сохранения велосипеда: ' + err.message);
            }
        });
    }

    if (bikesTableBody) {
        bikesTableBody.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-bike-btn');
            if (editBtn) {
                const id = editBtn.dataset.id;
                const { data, error } = await supabase.from('bikes').select('*').eq('id', id).single();
                if (error) {
                    alert('Не удалось загрузить данные велосипеда: ' + error.message);
                } else {
                    showBikeForm(data);
                }
                return;
            }

            const deleteBtn = e.target.closest('.delete-bike-btn');
            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                if (confirm(`Вы уверены, что хотите удалить велосипед с ID ${id}?`)) {
                    try {
                        const { error } = await supabase.from('bikes').delete().eq('id', id);
                        if (error) throw error;
                        await loadBikes();
                    } catch (err) {
                        alert('Ошибка удаления велосипеда: ' + err.message);
                    }
                }
            }
        });
    }

    // --- Clients Logic ---

    async function loadClients() {
    clientsTableBody.innerHTML = '<tr><td colspan="9">Загрузка клиентов...</td></tr>'; // Increased colspan
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        clientsData = data || []; 
        clientsTableBody.innerHTML = '';

        if (clientsData.length === 0) {
            clientsTableBody.innerHTML = '<tr><td colspan="9">Клиенты не найдены.</td></tr>';
            return;
        }

        clientsData.forEach(client => {
            const tr = document.createElement('tr');
            const date = new Date(client.created_at).toLocaleDateString();
            const status = client.verification_status || 'not_set';
            const tags = client.extra?.tags || [];
            
            let statusBadge = '';
            switch(status) {
                case 'approved': statusBadge = '<span class="status-badge status-approved">Одобрен</span>'; break;
                case 'rejected': statusBadge = '<span class="status-badge status-rejected">Отклонен</span>'; break;
                case 'pending': statusBadge = '<span class="status-badge status-pending">На проверке</span>'; break;
                default: statusBadge = '<span>Не задан</span>';
            }

            const verificationButtons = status === 'pending'
    ? `<button type="button" class="approve-btn" data-id="${client.id}">Одобрить</button> <button type="button" class="reject-btn" data-id="${client.id}">Отклонить</button>`
    : '';
            const tagsHtml = tags.map(tag => `<span class="chip" style="background-color: #eef7ff; border-color: #cfe6ff; color: #004a80; margin: 2px;">${tag}</span>`).join('');

            tr.innerHTML = `
                <td>${client.name}</td>
                <td>${client.phone || ''}</td>
                <td>${statusBadge}</td>
                <td><div class="chips">${tagsHtml}</div></td>
                <td>${date}</td>
                <td><button type="button" class="view-client-btn" data-id="${client.id}">Инфо/Фото</button></td>
                <td><button type="button" class="edit-client-btn" data-id="${client.id}">Ред. данных</button></td>
                <td>${verificationButtons}</td>
                <td><button type="button" class="delete-client-btn btn-danger" data-id="${client.id}" style="background-color:#e53e3e;color:white;">Удалить</button></td>`;
            clientsTableBody.appendChild(tr);
        });
    } catch (err) {
        console.error('Ошибка загрузки клиентов:', err);
        clientsTableBody.innerHTML = `<tr><td colspan="9">Ошибка: ${err.message}</td></tr>`;
    }
}
  
clientsTableBody.addEventListener('click', async (e) => {
    const target = e.target;
    const clientId = target.dataset.id;

    if (!clientId) return;

    let newStatus = '';
    if (target.classList.contains('approve-btn')) newStatus = 'approved';
    if (target.classList.contains('reject-btn')) newStatus = 'rejected';

    if (newStatus) {
        if (!confirm(`Вы уверены, что хотите изменить статус клиента #${clientId} на "${newStatus}"?`)) return;
        
        try {
            const { error } = await supabase
                .from('clients')
                .update({ verification_status: newStatus })
                .eq('id', clientId);

            if (error) throw error;
            
            alert('Статус клиента успешно обновлен!');
            loadClients(); // Перезагружаем список, чтобы увидеть изменения
        } catch (err) {
            alert(`Ошибка обновления статуса: ${err.message}`);
        }
        return;
    }

    if (target.classList.contains('delete-client-btn')) {
        if (confirm(`ВНИМАНИЕ!\n\nВы уверены, что хотите НАВСЕГДА удалить клиента с ID ${clientId}?\n\nЭто действие также удалит всю его историю аренд и платежей. Отменить это будет невозможно.`)) {
            try {
                target.disabled = true;
                target.textContent = 'Удаление...';
                
                // Сначала удаляем связанные записи, чтобы избежать ошибок внешнего ключа
                await supabase.from('payments').delete().eq('client_id', clientId);
                await supabase.from('rentals').delete().eq('user_id', clientId);
                
                // Наконец, удаляем самого клиента
                const { error } = await supabase.from('clients').delete().eq('id', clientId);
                if (error) throw error;
                
                alert('Клиент успешно удален.');
                loadClients(); // Обновляем список
            } catch (err) {
                alert(`Ошибка удаления: ${err.message}`);
                target.disabled = false;
                target.textContent = 'Удалить';
            }
        }
    }
});
    // --- Rentals and Payments Loaders ---

    async function loadRentals() {
        const tbody = document.querySelector('#rentals-table tbody');
        tbody.innerHTML = '<tr><td colspan="8">Загрузка...</td></tr>';
        try {
            const { data, error } = await supabase
                .from('rentals')
                .select('id, bike_id, starts_at, current_period_ends_at, total_paid_rub, status, clients (name, phone)')
                .order('starts_at', { ascending: false });
            if (error) throw error;
            tbody.innerHTML = '';
            (data || []).forEach(r => {
                const tr = document.createElement('tr');
                const start = r.starts_at ? new Date(r.starts_at).toLocaleString('ru-RU') : '—';
                const end = r.current_period_ends_at ? new Date(r.current_period_ends_at).toLocaleString('ru-RU') : '—';
                
                const actionsCell = (r.status === 'active')
                    ? `<button type="button" class="end-rental-btn" data-id="${r.id}">Завершить</button>`
                    : '';

                tr.innerHTML = `
                    <td>${r.clients?.name || 'Н/Д'}</td>
                    <td>${r.clients?.phone || 'Н/Д'}</td>
                    <td>${r.bike_id || '—'}</td>
                    <td>${start}</td>
                    <td>${end}</td>
                    <td>${typeof r.total_paid_rub === 'number' ? r.total_paid_rub : 0}</td>
                    <td>${r.status || ''}</td>
                    <td>${actionsCell}</td>`;
                tbody.appendChild(tr);
            });
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="8">Ошибка загрузки аренд: ${err.message}</td></tr>`;
        }
    }

    const rentalsTableBody = document.querySelector('#rentals-table tbody');
    if (rentalsTableBody) {
        rentalsTableBody.addEventListener('click', async (e) => {
            const endBtn = e.target.closest('.end-rental-btn');
            if (endBtn) {
                const rentalId = endBtn.dataset.id;
                if (confirm(`Вы уверены, что хотите принудительно завершить аренду с ID ${rentalId}?`)) {
                    try {
                        const { error } = await supabase
                            .from('rentals')
                            .update({ status: 'completed_by_admin' })
                            .eq('id', rentalId);

                        if (error) throw error;
                        
                        alert('Аренда успешно завершена.');
                        loadRentals(); // Refresh the list
                    } catch (err) {
                        alert('Ошибка завершения аренды: ' + err.message);
                    }
                }
            }
        });
    }

    function renderPaymentsChart(paymentsData) {
        const chartCanvas = document.getElementById('payments-chart');
        if (!chartCanvas) return; // Don't do anything if canvas isn't on the page

        if (window.paymentsChart instanceof Chart) {
            window.paymentsChart.destroy();
        }
        
        const successfulPayments = (paymentsData || []).filter(p => p.status === 'succeeded' && p.amount_rub > 0);
        const paymentsByDay = successfulPayments.reduce((acc, p) => {
            const day = new Date(p.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            acc[day] = (acc[day] || 0) + p.amount_rub;
            return acc;
        }, {});

        const labels = Object.keys(paymentsByDay).reverse();
        const chartData = Object.values(paymentsByDay).reverse();

        window.paymentsChart = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Доход по дням, ₽',
                    data: chartData,
                    backgroundColor: 'rgba(38, 185, 153, 0.6)',
                    borderColor: 'rgba(38, 185, 153, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true },
                    x: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#083830',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 12 },
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false,
                    }
                }
            }
        });
    }
    
    async function loadPayments() {
        const tbody = document.querySelector('#payments-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
        try {
            const { data, error } = await supabase
                .from('payments')
                .select('id, yookassa_payment_id, amount_rub, payment_method_title, payment_type, status, created_at, clients (name)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            tbody.innerHTML = '';
            (data || []).forEach(p => {
                const methodRuMap = { initial: 'Аренда', renewal: 'Продление', 'top-up': 'Пополнение', invoice: 'Списание по счёту', adjustment: 'Корректировка' };
                const statusRuMap = { succeeded: 'Успешно', pending: 'Ожидает', canceled: 'Отменён', failed: 'Ошибка' };
                const method = p.payment_method_title || methodRuMap[p.payment_type] || '—';
                const status = statusRuMap[p.status] || p.status || '';
                
                const actionsCell = (p.status === 'succeeded' && p.yookassa_payment_id && !p.yookassa_payment_id.startsWith('manual'))
                    ? `<button type="button" class="refund-btn" data-payment-id="${p.yookassa_payment_id}" data-amount="${p.amount_rub}">Вернуть</button>`
                    : '';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.clients?.name || 'Н/Д'}</td>
                    <td>${p.amount_rub ?? 0}</td>
                    <td>${method}</td>
                    <td>${status}</td>
                    <td>${p.created_at ? new Date(p.created_at).toLocaleString('ru-RU') : '—'}</td>
                    <td>${actionsCell}</td>`;
                tbody.appendChild(tr);
            });
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="6">Ошибка загрузки платежей: ${err.message}</td></tr>`;
            console.error('Ошибка загрузки платежей:', err);
        }
    }

    async function loadDashboardData() {
        // 1. Load Bike Stats
        const metricsContainer = document.getElementById('dashboard-metrics');
        if (metricsContainer) {
            const loadingOverlay = showLoadingOverlay(metricsContainer, 'Загрузка метрик...');
            try {
                const { data, error } = await supabase.from('bikes').select('status');
                if (error) throw error;

                const stats = data.reduce((acc, bike) => {
                    acc[bike.status] = (acc[bike.status] || 0) + 1;
                    return acc;
                }, {});

                const total = data.length;
                const available = stats.available || 0;
                const rented = stats.rented || 0;
                const in_service = stats.in_service || 0;

                metricsContainer.innerHTML = `
                    <div class="card fade-in">
                        <div class="icon-wrapper">🚲</div>
                        <div class="text-content">
                            <strong class="text-xl">${total}</strong>
                            <span>Всего велосипедов</span>
                        </div>
                    </div>
                    <div class="card success fade-in">
                        <div class="icon-wrapper">✅</div>
                        <div class="text-content">
                            <strong class="text-xl">${available}</strong>
                            <span>Свободно</span>
                        </div>
                    </div>
                    <div class="card warning fade-in">
                        <div class="icon-wrapper">🔄</div>
                        <div class="text-content">
                            <strong class="text-xl">${rented}</strong>
                            <span>В аренде</span>
                        </div>
                    </div>
                    <div class="card error fade-in">
                        <div class="icon-wrapper">🔧</div>
                        <div class="text-content">
                            <strong class="text-xl">${in_service}</strong>
                            <span>В ремонте</span>
                        </div>
                    </div>
                `;
                hideLoadingOverlay(metricsContainer);
            } catch (err) {
                hideLoadingOverlay(metricsContainer);
                metricsContainer.innerHTML = `<div class="card error"><div class="text-content"><strong>Ошибка загрузки</strong><span>Не удалось загрузить статистику</span></div></div>`;
                showToast('Ошибка загрузки статистики велосипедов', 'error');
            }
        }

        // 2. Load Payments for Chart
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            const chartLoading = showLoadingOverlay(chartContainer, 'Загрузка графика...');
            try {
                const { data, error } = await supabase
                    .from('payments')
                    .select('created_at, amount_rub, status')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                renderPaymentsChart(data);
                hideLoadingOverlay(chartContainer);
            } catch (err) {
                hideLoadingOverlay(chartContainer);
                console.error('Ошибка загрузки данных для графика платежей:', err);
                showToast('Ошибка загрузки данных графика', 'error');
            }
        }
    }

    // --- Client Info/Edit Modals Logic ---
    // --- Client Info/Edit Modals Logic ---
// --- Client Info/Edit Modals Logic ---
// --- Client Info/Edit Modals Logic ---
if (clientsSection) {
    clientsSection.addEventListener('click', async (e) => {
        const viewBtn = e.target.closest('.view-client-btn');
        const editBtn = e.target.closest('.edit-client-btn');
        if (!viewBtn && !editBtn) return;

        const clientId = viewBtn ? viewBtn.dataset.id : editBtn.dataset.id;
        const client = clientsData.find(c => c.id == clientId);
        if (!client) return;

        const recognizedData = client.extra?.recognized_data || {};

        // --- ЛОГИКА ДЛЯ ПРОСМОТРА ИНФОРМАЦИИ И ФОТО ---
        if (viewBtn) {
            currentEditingId = client.id; // Set the current client ID
            const recognizedContainer = document.getElementById('recognized-data-container');
            const photoLinksDiv = document.getElementById('photo-links');

            if (!clientInfoOverlay || !recognizedContainer || !photoLinksDiv) {
                console.error('Ошибка: один или несколько элементов модального окна не найдены в HTML.');
                alert('Ошибка интерфейса: не найдены элементы для отображения информации. Проверьте HTML-структуру.');
                return;
            }

            // Заполняем текстовые данные
            recognizedContainer.innerHTML = '';
            if (Object.keys(recognizedData).length > 0) {
                for (const key in recognizedData) {
                    recognizedContainer.innerHTML += `<div><strong>${key}:</strong> ${recognizedData[key] || 'Н/Д'}</div>`;
                }
            } else {
                recognizedContainer.innerHTML = '<p>Распознанные данные отсутствуют.</p>';
            }

            // Показываем оверлей и начинаем загрузку фото
            photoLinksDiv.innerHTML = 'Загрузка...';
            clientInfoOverlay.classList.remove('hidden');

            // Запрашиваем и отображаем ссылки на фото
            try {
                const { data: files, error } = await supabase.storage.from('passports').list(client.id.toString());
                if (error) throw error;

                if (!files || files.length === 0) {
                    photoLinksDiv.innerHTML = '<p>Фото не найдены.</p>';
                } else {
                    // ===== ИЗМЕНЕНИЕ ЗДЕСЬ =====
                    // Вместо текстовой ссылки создаем тег <img>, обернутый в ссылку
                    const links = files.map(file => {
                        const { data } = supabase.storage.from('passports').getPublicUrl(`${client.id}/${file.name}`);
                        return `
                            <a href="${data.publicUrl}" target="_blank" rel="noopener noreferrer" title="Нажмите, чтобы открыть в полном размере">
                                <img src="${data.publicUrl}" alt="${file.name}" style="max-width: 100%; height: auto; display: block; margin-bottom: 10px; border-radius: 8px; border: 1px solid #eee;">
                            </a>
                        `;
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
    if (typeof clientInfoCloseBtn2 !== 'undefined' && clientInfoCloseBtn2) {
        clientInfoCloseBtn2.addEventListener('click', () => clientInfoOverlay.classList.add('hidden'));
    }
    if (typeof imageViewerOverlay !== 'undefined' && imageViewerOverlay) {
        const closer = document.getElementById('image-viewer-close');
        if (closer) closer.addEventListener('click', () => imageViewerOverlay.classList.add('hidden'));
        imageViewerOverlay.addEventListener('click', (e) => { if (e.target === imageViewerOverlay) imageViewerOverlay.classList.add('hidden'); });
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

    // Enhanced viewer/editor for client info within the info overlay
    if (clientsSection) {
        clientsSection.addEventListener('click', async (e) => {
            const btn = e.target.closest('.view-client-btn');
            if (!btn) return;
            const clientId = btn.dataset.id;
            try {
                // небольшая задержка, чтобы базовый обработчик показал модалку
                setTimeout(async () => {
                    const recWrap = document.getElementById('recognized-data-container');
                    const recView = document.getElementById('recognized-display');
                    const recForm = document.getElementById('recognized-edit-form');
                    const photosDiv = document.getElementById('photo-links');
                    if (!recWrap || !recView || !recForm || !photosDiv) return;

                    const { data: client, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
                    if (error) throw error;
                    currentEditingId = client.id; // Set the current client ID
                    const rec = client?.extra?.recognized_data || {};
                    renderNotes(client.extra?.notes);
                    renderTags(client.extra?.tags);

                    // render view
                    recView.innerHTML = '';
                    const keys = Object.keys(rec);
                    if (keys.length === 0) {
                        recView.innerHTML = '<p>Данных распознавания нет.</p>';
                    } else {
                        keys.forEach(k => {
                            const row = document.createElement('div');
                            row.className = 'info-row';
                            row.innerHTML = `<strong>${k}:</strong><span>${rec[k] ?? ''}</span>`;
                            recView.appendChild(row);
                        });
                    }

                    // render form
                    recForm.innerHTML = '';
                    keys.forEach(k => {
                        const block = document.createElement('div');
                        block.className = 'form-group';
                        block.innerHTML = `<label>${k}</label><input type="text" name="${k}" value="${(rec[k] ?? '').toString().replace(/"/g,'&quot;')}">`;
                        recForm.appendChild(block);
                    });
                    recForm.classList.add('hidden');
                    recView.classList.remove('hidden');
                    if (clientInfoEditToggle) clientInfoEditToggle.classList.remove('hidden');
                    if (clientInfoSaveBtn) clientInfoSaveBtn.classList.add('hidden');
                    
                    // edit toggle
                    if (clientInfoEditToggle) {
                        clientInfoEditToggle.onclick = () => {
                            const editing = !recForm.classList.contains('hidden');
                            if (editing) {
                                recForm.classList.add('hidden');
                                recView.classList.remove('hidden');
                                if (clientInfoSaveBtn) clientInfoSaveBtn.classList.add('hidden');
                                clientInfoEditToggle.textContent = 'Редактировать';
                            } else {
                                recForm.classList.remove('hidden');
                                recView.classList.add('hidden');
                                if (clientInfoSaveBtn) clientInfoSaveBtn.classList.remove('hidden');
                                clientInfoEditToggle.textContent = 'Просмотр';
                            }
                        };
                    }
                    if (clientInfoSaveBtn) {
                        clientInfoSaveBtn.onclick = async () => {
                            const formData = new FormData(recForm);
                            const updated = {};
                            for (const [k,v] of formData.entries()) updated[k] = String(v);
                            const extraObj = JSON.parse(JSON.stringify(client.extra || {}));
                            extraObj.recognized_data = updated;
                            const { error: uerr } = await supabase.from('clients').update({ extra: extraObj }).eq('id', clientId);
                            if (uerr) { alert('Ошибка сохранения: ' + uerr.message); return; }
                            // refresh view
                            recView.innerHTML = '';
                            Object.keys(updated).forEach(k => {
                                const row = document.createElement('div');
                                row.className = 'info-row';
                                row.innerHTML = `<strong>${k}:</strong><span>${updated[k]}</span>`;
                                recView.appendChild(row);
                            });
                            clientInfoEditToggle.click();
                        };
                    }

                    // photos grid + lightbox
                    photosDiv.innerHTML = 'Загрузка...';
                    try {
                        const { data: files, error: ferr } = await supabase.storage.from('passports').list(String(clientId));
                        if (ferr) throw ferr;
                        if (!files || files.length === 0) {
                            photosDiv.innerHTML = '<p>Фото не найдены.</p>';
                        } else {
                            photosDiv.innerHTML = '';
                            files.forEach(file => {
                                const { data } = supabase.storage.from('passports').getPublicUrl(`${clientId}/${file.name}`);
                                const img = document.createElement('img');
                                img.src = data.publicUrl;
                                img.alt = file.name;
                                img.className = 'client-photo-thumb';
                                img.addEventListener('click', () => {
                                    const overlay = document.getElementById('image-viewer-overlay');
                                    const viewerImg = document.getElementById('image-viewer-img');
                                    if (overlay && viewerImg) {
                                        viewerImg.src = data.publicUrl;
                                        overlay.classList.remove('hidden');
                                    }
                                });
                                photosDiv.appendChild(img);
                            });
                            // На случай, если другой обработчик отрисовал <a>, перерисуем в превью
                            setTimeout(() => {
                                const anchors = photosDiv.querySelectorAll('a');
                                if (anchors.length) {
                                    const urls = Array.from(anchors).map(a => a.href);
                                    photosDiv.innerHTML = '';
                                    urls.forEach(u => {
                                        const img = document.createElement('img');
                                        img.src = u;
                                        img.className = 'client-photo-thumb';
                                        img.addEventListener('click', () => {
                                            const overlay = document.getElementById('image-viewer-overlay');
                                            const viewerImg = document.getElementById('image-viewer-img');
                                            if (overlay && viewerImg) { viewerImg.src = u; overlay.classList.remove('hidden'); }
                                        });
                                        photosDiv.appendChild(img);
                                    });
                                }
                            }, 600);
                        }
                    } catch (err2) {
                        console.error('Ошибка загрузки фото:', err2);
                        photosDiv.innerHTML = `<p style="color:red;">Ошибка загрузки фото: ${err2.message}</p>`;
                    }
                }, 0);
            } catch (err) {
                console.error('Ошибка подготовки карточки клиента:', err);
            }
        });
    }

    // --- Balance Adjustment Logic ---
    const balanceModal = document.getElementById('balance-modal');
    const balanceAdjustBtn = document.getElementById('balance-adjust-btn');
    const balanceCancelBtn = document.getElementById('balance-cancel-btn');
    const balanceSubmitBtn = document.getElementById('balance-submit-btn');
    const balanceClientIdInput = document.getElementById('balance-client-id');
    const balanceAmountInput = document.getElementById('balance-amount');
    const balanceReasonInput = document.getElementById('balance-reason');

    // Token Generation Button
    const generateTokenBtn = document.getElementById('generate-token-btn');

    if (balanceAdjustBtn) {
        balanceAdjustBtn.addEventListener('click', () => {
            if (currentEditingId && balanceModal) {
                balanceClientIdInput.value = currentEditingId;
                if (clientInfoOverlay) clientInfoOverlay.classList.add('hidden');
                balanceModal.classList.remove('hidden');
            } else {
                alert('Сначала выберите клиента.');
            }
        });
    }

    if (balanceCancelBtn) {
        balanceCancelBtn.addEventListener('click', () => {
            if (balanceModal) balanceModal.classList.add('hidden');
        });
    }

    if (balanceModal) {
        balanceModal.addEventListener('click', (e) => {
            if (e.target === balanceModal) {
                balanceModal.classList.add('hidden');
            }
        });
    }

    if (balanceSubmitBtn) {
        balanceSubmitBtn.addEventListener('click', async () => {
            const userId = balanceClientIdInput.value;
            const amount = balanceAmountInput.value;
            const reason = balanceReasonInput.value;

            if (!userId || !amount || !reason) {
                alert('Пожалуйста, заполните все поля: сумма и причина.');
                return;
            }

            toggleButtonLoading(balanceSubmitBtn, true, 'Применить', 'Применяем...');

            try {
                const response = await fetch('/.netlify/functions/adjust-balance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, amount, reason })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || `Ошибка сервера: ${response.status}`);
                }
                
                alert(result.message || 'Баланс успешно скорректирован.');
                balanceModal.classList.add('hidden');
                balanceAmountInput.value = '';
                balanceReasonInput.value = '';

            } catch (err) {
                alert('Ошибка: ' + err.message);
            } finally {
                toggleButtonLoading(balanceSubmitBtn, false, 'Применить', 'Применяем...');
            }
        });
    }

    // --- Token Generation Logic ---
    if (generateTokenBtn) {
        generateTokenBtn.addEventListener('click', async () => {
            if (!currentEditingId) {
                alert('Клиент не выбран.');
                return;
            }

            if (!confirm(`Сгенерировать новый токен доступа для клиента ID: ${currentEditingId}? Старый токен перестанет работать.`)) {
                return;
            }

            toggleButtonLoading(generateTokenBtn, true, 'Сгенерировать токен', 'Генерация...');

            try {
                const response = await fetch('/.netlify/functions/reset-auth-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentEditingId })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Ошибка сервера');

                // Показываем токен администратору, чтобы он мог его скопировать и передать клиенту
                prompt("Скопируйте этот токен и отправьте клиенту:", result.newToken);

            } catch (err) {
                alert('Ошибка генерации токена: ' + err.message);
            } finally {
                toggleButtonLoading(generateTokenBtn, false, 'Сгенерировать токен', 'Генерация...');
            }
        });
    }

    // --- Client Tags Logic ---
    const clientTagsContainer = document.getElementById('client-tags-container');
    const clientTagInput = document.getElementById('client-tag-input');
    const addTagBtn = document.getElementById('add-tag-btn');

    function renderTags(tags = []) {
        if (!clientTagsContainer) return;
        clientTagsContainer.innerHTML = '';
        if (!tags || tags.length === 0) {
            clientTagsContainer.innerHTML = '<p style="color: #6b6b6b;">Тегов нет.</p>';
            return;
        }
        tags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'chip'; // Re-using chip style for tags
            tagEl.style.cursor = 'pointer';
            tagEl.style.backgroundColor = '#e0f8f1';
            tagEl.style.borderColor = '#26b999';
            tagEl.style.color = '#083830';
            tagEl.textContent = tag;
            const removeBtn = document.createElement('span');
            removeBtn.textContent = ' ×';
            removeBtn.style.fontWeight = 'bold';
            removeBtn.style.marginLeft = '4px';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeTag(tag);
            };
            tagEl.appendChild(removeBtn);
            clientTagsContainer.appendChild(tagEl);
        });
    }

    async function updateClientTags(newTags) {
        try {
            const { data: client, error: fetchError } = await supabase
                .from('clients')
                .select('extra')
                .eq('id', currentEditingId)
                .single();
            if (fetchError) throw fetchError;

            const extra = client.extra || {};
            extra.tags = newTags;

            const { error: updateError } = await supabase
                .from('clients')
                .update({ extra: extra })
                .eq('id', currentEditingId);
            if (updateError) throw updateError;

            return newTags;
        } catch (err) {
            alert('Не удалось обновить теги: ' + err.message);
            return null;
        }
    }

    async function addTag() {
        const tagText = clientTagInput.value.trim();
        if (!tagText || !currentEditingId) return;

        toggleButtonLoading(addTagBtn, true, 'Добавить', '...');
        const { data: client, error } = await supabase.from('clients').select('extra').eq('id', currentEditingId).single();
        const currentTags = client.extra?.tags || [];
        if (currentTags.includes(tagText)) {
            alert('Такой тег уже существует.');
            toggleButtonLoading(addTagBtn, false, 'Добавить', '...');
            return;
        }
        const newTags = [...currentTags, tagText];
        const updatedTags = await updateClientTags(newTags);
        if (updatedTags !== null) {
            renderTags(updatedTags);
            clientTagInput.value = '';
            loadClients(); // Refresh the main table to show new tags
        }
        toggleButtonLoading(addTagBtn, false, 'Добавить', '...');
    }

    async function removeTag(tagToRemove) {
        const { data: client, error } = await supabase.from('clients').select('extra').eq('id', currentEditingId).single();
        const currentTags = client.extra?.tags || [];
        const newTags = currentTags.filter(t => t !== tagToRemove);
        const updatedTags = await updateClientTags(newTags);
        if (updatedTags !== null) {
            renderTags(updatedTags);
            loadClients(); // Refresh the main table
        }
    }

    if (addTagBtn) {
        addTagBtn.addEventListener('click', addTag);
    }
    if (clientTagInput) {
        clientTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
            }
        });
    }

    // --- Assignments Logic ---
    async function loadAssignments() {
        if (!assignmentsTableBody) return;
        assignmentsTableBody.innerHTML = '<tr><td colspan="4">Загрузка...</td></tr>';
        try {
            const { data, error } = await supabase
                .from('rentals')
                .select('id, created_at, clients(name), tariffs(title)')
                .eq('status', 'pending_assignment')
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                assignmentsTableBody.innerHTML = '<tr><td colspan="4">Нет активных заявок на аренду.</td></tr>';
                return;
            }

            assignmentsTableBody.innerHTML = '';
            data.forEach(assignment => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${assignment.clients.name || 'N/A'}</td>
                    <td>${assignment.tariffs.title || 'N/A'}</td>
                    <td>${new Date(assignment.created_at).toLocaleString('ru-RU')}</td>
                    <td class="table-actions">
                        <button class="btn btn-primary assign-bike-btn" data-rental-id="${assignment.id}">Привязать</button>
                        <button class="btn btn-secondary reject-rental-btn" data-rental-id="${assignment.id}" style="background-color: #fff1f2; color: #e53e3e;">Отклонить</button>
                    </td>
                `;
                assignmentsTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Ошибка загрузки заявок:', err);
            assignmentsTableBody.innerHTML = `<tr><td colspan="4">Ошибка: ${err.message}</td></tr>`;
        }
    }

    if (assignmentsTableBody) {
        assignmentsTableBody.addEventListener('click', async (e) => {
            const assignBtn = e.target.closest('.assign-bike-btn');
            const rejectBtn = e.target.closest('.reject-rental-btn');

            if (assignBtn) {
                const rentalId = assignBtn.dataset.rentalId;
                assignRentalIdInput.value = rentalId;

                // Load available bikes
                try {
                    const { data, error } = await supabase
                        .from('bikes')
                        .select('id, bike_code, model_name')
                        .eq('status', 'available');
                    if (error) throw error;

                    bikeSelect.innerHTML = '<option value="">-- Выберите велосипед --</option>';
                    data.forEach(bike => {
                        const option = document.createElement('option');
                        option.value = bike.id;
                        option.textContent = `${bike.model_name} (#${bike.bike_code})`;
                        bikeSelect.appendChild(option);
                    });

                    assignBikeModal.classList.remove('hidden');
                } catch (err) {
                    alert('Не удалось загрузить список свободных велосипедов: ' + err.message);
                }
            }

            if (rejectBtn) {
                const rentalId = rejectBtn.dataset.rentalId;
                if (confirm(`Вы уверены, что хотите отклонить заявку #${rentalId} и вернуть средства клиенту?`)) {
                    toggleButtonLoading(rejectBtn, true, 'Отклонить', '...');
                    try {
                        const response = await fetch('/.netlify/functions/reject-rental', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ rental_id: rentalId })
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.error || 'Ошибка сервера');
                        
                        alert(result.message);
                        loadAssignments(); // Refresh the list

                    } catch (err) {
                        alert('Ошибка отклонения заявки: ' + err.message);
                    } finally {
                        toggleButtonLoading(rejectBtn, false, 'Отклонить', '...');
                    }
                }
            }
        });
    }

    if (assignBikeCancelBtn) {
        assignBikeCancelBtn.addEventListener('click', () => assignBikeModal.classList.add('hidden'));
    }

    if (assignBikeSubmitBtn) {
        assignBikeSubmitBtn.addEventListener('click', async () => {
            const rentalId = assignRentalIdInput.value;
            const bikeId = bikeSelect.value;

            if (!rentalId || !bikeId) {
                alert('Пожалуйста, выберите велосипед.');
                return;
            }

            toggleButtonLoading(assignBikeSubmitBtn, true, 'Привязать и активировать', 'Активация...');

            try {
                const response = await fetch('/.netlify/functions/assign-bike', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rental_id: rentalId, bike_id: bikeId })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Ошибка сервера');

                alert('Аренда успешно активирована!');
                assignBikeModal.classList.add('hidden');
                loadAssignments();

            } catch (err) {
                alert('Ошибка активации аренды: ' + err.message);
            } finally {
                toggleButtonLoading(assignBikeSubmitBtn, false, 'Привязать и активировать', 'Активация...');
            }
        });
    }

    // --- Client Notes Logic ---
    const clientNotesList = document.getElementById('client-notes-list');
    const clientNoteInput = document.getElementById('client-note-input');
    const addNoteBtn = document.getElementById('add-note-btn');

    function renderNotes(notes = []) {
        if (!clientNotesList) return;
        if (!notes || notes.length === 0) {
            clientNotesList.innerHTML = '<p style="color: #6b6b6b; text-align: center;">Заметок пока нет.</p>';
            return;
        }
        clientNotesList.innerHTML = '';
        notes.slice().reverse().forEach(note => {
            const noteEl = document.createElement('div');
            noteEl.style.borderBottom = '1px solid var(--progress-bar-bg)';
            noteEl.style.padding = '8px 0';
            noteEl.style.marginBottom = '8px';
            const author = note.author || 'Неизвестный автор';
            const date = note.timestamp ? new Date(note.timestamp).toLocaleString('ru-RU') : '';
            noteEl.innerHTML = `
                <p style="margin:0; white-space: pre-wrap; word-wrap: break-word;">${note.text}</p>
                <small style="color: #6b6b6b;">- ${author} (${date})</small>
            `;
            clientNotesList.appendChild(noteEl);
        });
    }

    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', async () => {
            const noteText = clientNoteInput.value.trim();
            if (!noteText || !currentEditingId) return;

            toggleButtonLoading(addNoteBtn, true, 'Добавить заметку', 'Добавление...');

            try {
                const { data: { user } } = await supabase.auth.getUser();
                const authorEmail = user ? user.email : 'admin';

                const newNote = {
                    text: noteText,
                    author: authorEmail,
                    timestamp: new Date().toISOString()
                };

                // Fetch the latest extra data to avoid overwriting other changes
                const { data: client, error: fetchError } = await supabase
                    .from('clients')
                    .select('extra')
                    .eq('id', currentEditingId)
                    .single();

                if (fetchError) throw fetchError;

                const extra = client.extra || {};
                const notes = extra.notes || [];
                notes.push(newNote);
                extra.notes = notes;

                const { error: updateError } = await supabase
                    .from('clients')
                    .update({ extra: extra })
                    .eq('id', currentEditingId);

                if (updateError) throw updateError;

                clientNoteInput.value = '';
                renderNotes(notes); // Re-render the notes list

            } catch (err) {
                alert('Не удалось добавить заметку: ' + err.message);
            } finally {
                toggleButtonLoading(addNoteBtn, false, 'Добавить заметку', 'Добавление...');
            }
        });
    }

    // --- Invoice Logic ---
    if (invoiceCreateBtn) {
        invoiceCreateBtn.addEventListener('click', () => {
            // currentEditingId is set when the client info modal is opened
            if (currentEditingId && invoiceModal) {
                invoiceClientIdInput.value = currentEditingId;
                // It's better to hide the info overlay before showing the invoice one
                if (clientInfoOverlay) clientInfoOverlay.classList.add('hidden');
                invoiceModal.classList.remove('hidden');
            } else {
                alert('Сначала выберите клиента для выставления счета.');
            }
        });
    }

    if (invoiceCancelBtn) {
        invoiceCancelBtn.addEventListener('click', () => {
            if (invoiceModal) {
                invoiceModal.classList.add('hidden');
            }
        });
    }
    
    // Also close on overlay click
    if (invoiceModal) {
        invoiceModal.addEventListener('click', (e) => {
            if (e.target === invoiceModal) {
                invoiceModal.classList.add('hidden');
            }
        });
    }

    if (invoiceSubmitBtn) {
        invoiceSubmitBtn.addEventListener('click', async () => {
            const userId = invoiceClientIdInput.value;
            const amount = invoiceAmountInput.value;
            const description = invoiceDescriptionInput.value;

            if (!userId || !amount || !description) {
                alert('Пожалуйста, заполните все поля: сумма и описание.');
                return;
            }

            toggleButtonLoading(invoiceSubmitBtn, true, 'Выставить и списать', 'Отправка...');

            try {
                const response = await fetch('/.netlify/functions/create-invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, amount, description })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || `Ошибка сервера: ${response.status}`);
                }

                const responseText = await response.text();
                
                // Если ответ пустой, считаем, что все прошло успешно
                if (!responseText) {
                    alert('Счет успешно создан и отправлен на списание.');
                } else {
                    // Иначе, пытаемся парсить JSON
                    const result = JSON.parse(responseText);
                    alert(result.message || 'Счет успешно создан и отправлен на списание.');
                }

                invoiceModal.classList.add('hidden');
                invoiceAmountInput.value = '';
                invoiceDescriptionInput.value = '';

            } catch (err) {
                // Умное сообщение об ошибке
                if (err.message.includes('Unexpected token')) {
                    alert('Ошибка: получен некорректный ответ от сервера. Возможно, он временно недоступен.');
                } else {
                    alert('Ошибка: ' + err.message);
                }
            } finally {
                toggleButtonLoading(invoiceSubmitBtn, false, 'Выставить и списать', 'Отправка...');
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

    // ==== Templates Manager (Шаблоны договоров) ====
    const templatesSection = document.getElementById('templates-section');
    const templatesTableBody = document.querySelector('#templates-table tbody');
    const templateNewBtn = document.getElementById('template-new-btn');
    const templateSaveBtn = document.getElementById('template-save-btn');
    const templateIdInput = document.getElementById('template-id');
    const templateNameInput = document.getElementById('template-name');
    const templateActiveCheckbox = document.getElementById('template-active');
    const templateEditor = document.getElementById('template-editor');
    // duplicate removed: const contractTemplateSelect
    // duplicate removed: const chipsClient
    // duplicate removed: const chipsTariff
    // duplicate removed: const chipsRental
    // duplicate removed: const chipsAux
    // duplicate removed: const editorToolbar

    const PLACEHOLDERS = {
      client: [
        ['client.full_name','ФИО'], ['client.first_name','Имя'], ['client.last_name','Фамилия'], ['client.middle_name','Отчество'],
        ['client.passport_series','Серия паспорта'], ['client.passport_number','Номер паспорта'], ['client.issued_by','Кем выдан'],
        ['client.issued_at','Дата выдачи'], ['client.birth_date','Дата рождения'], ['client.city','Город'], ['client.address','Адрес']
      ],
      tariff: [ ['tariff.title','Тариф'], ['tariff.duration_days','Дней'], ['tariff.price_rub','Сумма ₽'] ],
      rental: [ ['rental.id','№ аренды'], ['rental.starts_at','Начало'], ['rental.ends_at','Конец'], ['rental.bike_id','ID велосипеда'] ],
      aux: [ ['now.date','Дата'], ['now.time','Время'] ]
    };

    function mountChips(container, items) {
      if (!container) return;
      container.innerHTML = '';
      items.forEach(([value,label]) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = label;
        chip.title = `Вставить {{${value}}}`;
        chip.addEventListener('click', () => insertAtCaret(`{{${value}}}`));
        container.appendChild(chip);
      });
    }

    function insertAtCaret(text) {
      if (!templateEditor) return;
      templateEditor.focus();
      document.execCommand('insertText', false, text);
    }

    function toolbarAction(e) {
      const btn = e.target.closest('button[data-cmd]');
      if (!btn || !templateEditor) return;
      const cmd = btn.dataset.cmd;
      templateEditor.focus();
      document.execCommand(cmd, false, null);
    }

    // selection tracking inside editor
    function isWithinEditor(node){ return templateEditor && node && (node === templateEditor || templateEditor.contains(node)); }
    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection ? window.getSelection() : null;
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      if (isWithinEditor(r.startContainer)) {
        lastSelRange = r.cloneRange();
      }
    });

    function insertAtSavedRange(token){
      if (!templateEditor) return;
      templateEditor.focus();
      const sel = window.getSelection();
      try{
        if (lastSelRange && isWithinEditor(lastSelRange.startContainer)) {
          sel.removeAllRanges();
          sel.addRange(lastSelRange);
        }
        const range = sel.rangeCount ? sel.getRangeAt(0) : null;
        if (range) {
          range.deleteContents();
          const span = document.createElement('span');
          span.className = 'ph';
          span.textContent = token;
          range.insertNode(span);
          // move caret after inserted
          range.setStartAfter(span);
          range.collapse(true);
          sel.removeAllRanges(); sel.addRange(range);
        } else {
          document.execCommand('insertText', false, token);
        }
      } catch {
        document.execCommand('insertText', false, token);
      }
      // highlight
      highlightPlaceholdersInEditor();
    }

    // --- Drag&Drop и подсветка плейсхолдеров ---
    function enableDnDForChips() {
      document.querySelectorAll('.chips .chip').forEach(chip => {
        if (chip.dataset.dnd === '1') return;
        chip.dataset.dnd = '1';
        chip.setAttribute('draggable', 'true');
        chip.addEventListener('dragstart', (e) => {
          const token = `{{${chip.title.replace('Вставить ', '').replace(/[{}]/g,'').trim()}}}`;
          e.dataTransfer.setData('text/plain', token);
          chip.classList.add('dragging');
        });
        chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
        // после клика (вставки) подсветить
        chip.addEventListener('click', () => setTimeout(highlightPlaceholdersInEditor, 0));
      });
      if (templateEditor) {
        templateEditor.addEventListener('dragover', (e)=>{ e.preventDefault(); templateEditor.classList.add('drag-over'); });
        templateEditor.addEventListener('dragleave', ()=> templateEditor.classList.remove('drag-over'));
        templateEditor.addEventListener('drop', (e)=>{
          e.preventDefault();
          templateEditor.classList.remove('drag-over');
          const text = e.dataTransfer.getData('text/plain');
          if (text) {
            templateEditor.focus();
            document.execCommand('insertText', false, text);
            highlightPlaceholdersInEditor();
            templateEditor.classList.add('drop-anim');
            setTimeout(()=>templateEditor.classList.remove('drop-anim'), 300);
          }
        });
        templateEditor.addEventListener('blur', highlightPlaceholdersInEditor);
      }
    }

    function highlightPlaceholdersInEditor() {
      if (!templateEditor) return;
      try {
        let html = templateEditor.innerHTML;
        html = html.replace(/<span class=\"ph\">(.*?)<\/span>/g, '$1');
        html = html.replace(/(\{\{\s*[\w\.\-]+\s*\}\})/g, '<span class="ph">$1<\/span>');
        templateEditor.innerHTML = html;
      } catch {}
    }

    // Навешиваем кликовую вставку, которая сохраняет позицию курсора
    function addChipClickHandlers() {
      document.querySelectorAll('.chips .chip').forEach(chip => {
        if (chip.dataset.clickBound === '1') return;
        chip.dataset.clickBound = '1';
        chip.addEventListener('mousedown', (e) => e.preventDefault());
        chip.addEventListener('click', () => {
          const m = /\{\{.*?\}\}/.exec(chip.title || '');
          const token = m ? m[0] : `{{${chip.textContent.trim()}}}`;
          insertAtSavedRange(token);
        });
      });
    }

    // --- Предпросмотр шаблона ---
    const templatePreviewBtn = document.getElementById('template-preview-btn');
    const templatePreviewOverlay = document.getElementById('template-preview-overlay');
    const templatePreviewContent = document.getElementById('template-preview-content');
    const templatePreviewClose = document.getElementById('template-preview-close');

    function pathGet(obj, path){ try{ return path.split('.').reduce((o,k)=>(o&&o[k]!=null)?o[k]:'', obj); }catch{return ''} }
    function buildPreviewHTML(){
      const ctx = {
        client:{ full_name:'Иванов Иван Иванович', first_name:'Иван', last_name:'Иванов', middle_name:'Иванович', passport_series:'12 34', passport_number:'567890', issued_by:'ОВД г. Москва', issued_at:'01.01.2020', birth_date:'02.02.1990', city:'Москва', address:'ул. Пушкина, д.1' },
        tariff:{ title:'Золотой', duration_days:7, price_rub:3750 },
        rental:{ id:12345, starts_at:'2025-09-01', ends_at:'2025-09-08', bike_id:'00001' },
        now:{ date: new Date().toLocaleDateString('ru-RU'), time: new Date().toLocaleTimeString('ru-RU') }
      };
      let html = templateEditor ? templateEditor.innerHTML : '';
      html = html.replace(/\{\{\s*([\w\.\-]+)\s*\}\}/g, (_,k)=>{ const v = pathGet(ctx,k); return v===undefined? '': String(v)});
      return html;
    }
    function openTemplatePreview(){ if (!templatePreviewOverlay||!templatePreviewContent) return; templatePreviewContent.innerHTML = buildPreviewHTML(); templatePreviewOverlay.classList.remove('hidden'); }
    function closeTemplatePreview(){ if (templatePreviewOverlay) templatePreviewOverlay.classList.add('hidden'); }
    if (templatePreviewBtn) templatePreviewBtn.addEventListener('click', openTemplatePreview);
    if (templatePreviewClose) templatePreviewClose.addEventListener('click', closeTemplatePreview);
    if (templatePreviewOverlay) templatePreviewOverlay.addEventListener('click', (e)=>{ if (e.target === templatePreviewOverlay) closeTemplatePreview(); });

    async function loadTemplates() {
      try {
        // chips
        mountChips(chipsClient, PLACEHOLDERS.client);
        mountChips(chipsTariff, PLACEHOLDERS.tariff);
        mountChips(chipsRental, PLACEHOLDERS.rental);
        mountChips(chipsAux, PLACEHOLDERS.aux);
        addChipClickHandlers();

        // включаем перетаскивание и постподсветку
        enableDnDForChips();

        const { data, error } = await supabase.from('contract_templates').select('*').order('id', { ascending: true });
        if (error) throw error;
        if (templatesTableBody) {
          templatesTableBody.innerHTML = '';
          (data||[]).forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>${t.name}</td>
              <td>${t.is_active ? 'Да' : 'Нет'}</td>
              <td class="table-actions">
                <button type="button" class="template-edit-btn" data-id="${t.id}">Ред.</button>
                <button type="button" class="template-delete-btn" data-id="${t.id}">Удалить</button>
              </td>`;
            templatesTableBody.appendChild(tr);
          });
        }
        if (contractTemplateSelect) {
          const selected = contractTemplateSelect.value;
          contractTemplateSelect.innerHTML = '<option value="">— Не выбран —</option>' + (data||[]).map(t => `<option value="${t.id}">${t.name}</option>`).join('');
          if (selected) contractTemplateSelect.value = selected;
        }
      } catch (err) {
        console.error('Ошибка загрузки шаблонов:', err);
      }
    }

    async function saveTemplate() {
      if (!templateEditor) return;
      const id = (document.getElementById('template-id')||{}).value;
      const name = (document.getElementById('template-name')||{}).value || 'Без названия';
      const isActive = (document.getElementById('template-active')||{checked:true}).checked;
      const content = templateEditor.innerHTML || '';
      const rec = { name, content, is_active: isActive, placeholders: PLACEHOLDERS };
      try {
        let resp;
        if (id) resp = await supabase.from('contract_templates').update(rec).eq('id', id).select('id').single();
        else resp = await supabase.from('contract_templates').insert([rec]).select('id').single();
        if (resp.error) throw resp.error;
        document.getElementById('template-id').value = resp.data?.id || id || '';
        await loadTemplates();
        alert('Шаблон сохранён');
      } catch (err) {
        alert('Ошибка сохранения шаблона: ' + err.message);
      }
    }

    function newTemplate() {
      (document.getElementById('template-id')||{}).value = '';
      (document.getElementById('template-name')||{}).value = '';
      (document.getElementById('template-active')||{}).checked = true;
      if (templateEditor) templateEditor.innerHTML = '';
    }

    if (editorToolbar) editorToolbar.addEventListener('click', toolbarAction);
    document.getElementById('templates-table')?.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.template-edit-btn');
      const delBtn = e.target.closest('.template-delete-btn');
      if (editBtn) {
        const id = editBtn.dataset.id;
        const { data, error } = await supabase.from('contract_templates').select('*').eq('id', id).single();
        if (!error && data) {
          document.getElementById('template-id').value = data.id;
          document.getElementById('template-name').value = data.name;
          document.getElementById('template-active').checked = !!data.is_active;
          if (templateEditor) templateEditor.innerHTML = data.content || '';
        }
      }
      if (delBtn) {
        const id = delBtn.dataset.id;
        if (!confirm('Удалить шаблон?')) return;
        const { error } = await supabase.from('contract_templates').delete().eq('id', id);
        if (error) alert('Ошибка удаления: ' + error.message);
        await loadTemplates();
      }
    });
    if (templateSaveBtn) templateSaveBtn.addEventListener('click', saveTemplate);
    if (templateNewBtn) templateNewBtn.addEventListener('click', newTemplate);

    // Попробуем заранее загрузить шаблоны (для выпадающего списка у тарифов)
    loadTemplates().catch(()=>{});
});
