document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://avamqfmuhiwtlumjkzmv.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YW1xZm11aGl3dGx1bWprem12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjMyODcsImV4cCI6MjA3MjIzOTI4N30.EwEPM0pObAd3v_NXI89DLcgKVYrUiOn7iHuCXXaqU4I';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const chatListContainer = document.getElementById('chat-list-container');
    const chatWindowHeader = document.getElementById('chat-window-header');
    const chatHistoryContainer = document.getElementById('chat-history-container');
    const chatInput = document.getElementById('chat-input-admin');
    const sendBtn = document.getElementById('send-chat-admin-btn');
    const searchInput = document.getElementById('client-chat-search');

    // Элементы для привязки чата
    const linkChatBar = document.getElementById('link-chat-bar');
    const linkChatBtn = document.getElementById('link-chat-btn');
    const linkClientModal = document.getElementById('link-client-modal');
    const linkClientCancelBtn = document.getElementById('link-client-cancel-btn');
    const linkClientSearch = document.getElementById('link-client-search');
    const linkClientList = document.getElementById('link-client-list');

    let allClients = [];
    let allAnonymousChats = [];
    let activeChatClientId = null;
    let activeAnonymousChatId = null;

    // --- ОСНОВНЫЕ ФУНКЦИИ ---

    /**
     * Загружает всех клиентов и анонимные чаты
     */
    async function loadAllData() {
        try {
            // 1. Загружаем всех клиентов
            const { data: clients, error: clientError } = await supabase
                .from('clients')
                .select('id, name, phone')
                .order('created_at', { ascending: false });
            if (clientError) throw clientError;
            allClients = clients || [];

            // 2. Загружаем ID и последнее сообщение для каждого анонимного чата
            const { data: anonChats, error: anonError } = await supabase.rpc('get_anonymous_chats');
            if (anonError) throw anonError;
            allAnonymousChats = anonChats || [];

            // 3. Рендерим оба списка
            renderChatList();
        } catch (err) {
            console.error('Ошибка загрузки данных:', err);
            chatListContainer.innerHTML = '<p style="padding: 10px; color: red;">Ошибка загрузки чатов</p>';
        }
    }

    /**
     * Отрисовывает список чатов (клиентов и анонимов)
     */
    function renderChatList(filter = '') {
        chatListContainer.innerHTML = '';
        const lowerFilter = filter.toLowerCase();

        // Фильтруем и рендерим анонимные чаты
        allAnonymousChats.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'chat-list-item';
            item.dataset.anonymousId = chat.anonymous_chat_id;
            item.innerHTML = `
                <div class="chat-avatar" style="background-color: #718096;">?</div>
                <div class="chat-info">
                    <div class="chat-name">Анонимный чат</div>
                    <div class="last-message">${chat.message_text || '...'}</div>
                </div>
            `;
            item.addEventListener('click', () => openChat(null, null, chat.anonymous_chat_id));
            chatListContainer.appendChild(item);
        });

        // Фильтруем и рендерим чаты клиентов
        const filteredClients = allClients.filter(client => 
            client.name.toLowerCase().includes(lowerFilter) ||
            (client.phone && client.phone.includes(filter))
        );

        if (filteredClients.length === 0 && allAnonymousChats.length === 0) {
            chatListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">Чаты не найдены</p>';
            return;
        }

        filteredClients.forEach(client => {
            const initial = client.name ? client.name.charAt(0).toUpperCase() : '?';
            const item = document.createElement('div');
            item.className = 'chat-list-item';
            item.dataset.clientId = client.id;
            item.innerHTML = `
                <div class="chat-avatar">${initial}</div>
                <div class="chat-info">
                    <div class="chat-name">${client.name}</div>
                    <div class="last-message">${client.phone || 'Нет номера'}</div>
                </div>
            `;
            item.addEventListener('click', () => openChat(client.id, client.name, null));
            chatListContainer.appendChild(item);
        });
    }

    /**
     * Открывает чат с выбранным клиентом или анонимом
     */
    async function openChat(clientId, clientName, anonymousId) {
        activeChatClientId = clientId;
        activeAnonymousChatId = anonymousId;

        // Показываем или скрываем кнопку привязки
        linkChatBar.classList.toggle('hidden', !anonymousId);

        chatWindowHeader.textContent = clientName || `Анонимный чат #${anonymousId.slice(5, 10)}`;
        chatHistoryContainer.innerHTML = '<p style="text-align:center;">Загрузка сообщений...</p>';

        // Подсветка активного чата
        document.querySelectorAll('.chat-list-item').forEach(item => {
            const isClientMatch = clientId && item.dataset.clientId === clientId;
            const isAnonMatch = anonymousId && item.dataset.anonymousId === anonymousId;
            item.classList.toggle('active', isClientMatch || isAnonMatch);
        });

        try {
            let query = supabase.from('support_messages').select('*');
            if (clientId) {
                query = query.eq('client_id', clientId);
            } else {
                query = query.eq('anonymous_chat_id', anonymousId);
            }
            const { data, error } = await query.order('created_at', { ascending: true });

            if (error) throw error;

            chatHistoryContainer.innerHTML = '';
            if (!data || data.length === 0) {
                chatHistoryContainer.innerHTML = '<p style="text-align:center;">Сообщений пока нет.</p>';
                return;
            }

            data.forEach(msg => renderMessage(msg));
            chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;

        } catch (err) {
            console.error('Ошибка загрузки сообщений:', err);
            chatHistoryContainer.innerHTML = '<p style="padding: 10px; color: red;">Ошибка загрузки сообщений</p>';
        }
    }

    /**
     * Отрисовывает одно сообщение в окне чата
     */
    function renderMessage(message) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${message.sender === 'admin' ? 'admin-message' : 'client-message'}`;
        msgDiv.textContent = message.message_text;
        chatHistoryContainer.appendChild(msgDiv);
    }

    /**
     * Отправляет сообщение от имени администратора
     */
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text || (!activeChatClientId && !activeAnonymousChatId)) return;

        chatInput.disabled = true;
        sendBtn.disabled = true;

        const messagePayload = {
            sender: 'admin',
            message_text: text,
            is_read: false
        };

        if (activeChatClientId) {
            messagePayload.client_id = activeChatClientId;
        } else {
            messagePayload.anonymous_chat_id = activeAnonymousChatId;
        }

        try {
            const { data, error } = await supabase
                .from('support_messages')
                .insert(messagePayload)
                .select()
                .single();
            
            if (error) throw error;

            renderMessage(data);
            chatInput.value = '';
            chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;

        } catch (err) {
            console.error('Ошибка отправки сообщения:', err);
            alert('Не удалось отправить сообщение.');
        } finally {
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    }

    /**
     * Загружает всех клиентов для отображения в списке чатов
     */
    async function loadAllClients() {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('id, name, phone')
                .order('created_at', { ascending: false });
            if (error) throw error;
            allClients = data || [];
            renderChatList();
        } catch (err) {
            console.error('Ошибка загрузки клиентов:', err);
            chatListContainer.innerHTML = '<p style="padding: 10px; color: red;">Ошибка загрузки</p>';
        }
    }

    /**
     * Отрисовывает список чатов (клиентов)
     */
    function renderChatList(filter = '') {
        chatListContainer.innerHTML = '';
        const filteredClients = allClients.filter(client => 
            client.name.toLowerCase().includes(filter.toLowerCase()) ||
            (client.phone && client.phone.includes(filter))
        );

        if (filteredClients.length === 0) {
            chatListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">Клиенты не найдены</p>';
            return;
        }

        filteredClients.forEach(client => {
            const initial = client.name ? client.name.charAt(0).toUpperCase() : '?';
            const item = document.createElement('div');
            item.className = 'chat-list-item';
            item.dataset.clientId = client.id;
            item.innerHTML = `
                <div class="chat-avatar">${initial}</div>
                <div class="chat-info">
                    <div class="chat-name">${client.name}</div>
                    <div class="last-message">${client.phone || 'Нет номера'}</div>
                </div>
            `;
            item.addEventListener('click', () => openChat(client.id, client.name));
            chatListContainer.appendChild(item);
        });
    }

    /**
     * Открывает чат с выбранным клиентом
     */
    async function openChat(clientId, clientName) {
        activeChatClientId = clientId;
        chatWindowHeader.textContent = clientName;
        chatHistoryContainer.innerHTML = '<p style="text-align:center;">Загрузка сообщений...</p>';

        // Подсвечиваем активный чат
        document.querySelectorAll('.chat-list-item').forEach(item => {
            item.classList.toggle('active', item.dataset.clientId === clientId);
        });

        try {
            const { data, error } = await supabase
                .from('support_messages')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            chatHistoryContainer.innerHTML = '';
            if (!data || data.length === 0) {
                chatHistoryContainer.innerHTML = '<p style="text-align:center;">Сообщений пока нет.</p>';
                return;
            }

            data.forEach(msg => renderMessage(msg));
            chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;

        } catch (err) {
            console.error('Ошибка загрузки сообщений:', err);
            chatHistoryContainer.innerHTML = '<p style="padding: 10px; color: red;">Ошибка загрузки сообщений</p>';
        }
    }

    /**
     * Отрисовывает одно сообщение в окне чата
     */
    function renderMessage(message) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${message.sender === 'admin' ? 'admin-message' : 'client-message'}`;
        msgDiv.textContent = message.message_text;
        chatHistoryContainer.appendChild(msgDiv);
    }

    /**
     * Отправляет сообщение от имени администратора
     */
    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text || !activeChatClientId) return;

        chatInput.disabled = true;
        sendBtn.disabled = true;

        try {
            const { data, error } = await supabase
                .from('support_messages')
                .insert({
                    client_id: activeChatClientId,
                    sender: 'admin',
                    message_text: text,
                    is_read: false
                })
                .select()
                .single();
            
            if (error) throw error;

            renderMessage(data);
            chatInput.value = '';
            chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;

        } catch (err) {
            console.error('Ошибка отправки сообщения:', err);
            alert('Не удалось отправить сообщение.');
        } finally {
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    }

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---
    searchInput.addEventListener('input', (e) => {
        renderChatList(e.target.value);
    });

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    // --- ИНИЦИАЛИЗАЦИЯ ---
    loadAllData();

    // --- ЛОГИКА ПРИВЯЗКИ ЧАТА ---
    linkChatBtn.addEventListener('click', () => {
        renderLinkClientList();
        linkClientModal.classList.remove('hidden');
    });

    linkClientCancelBtn.addEventListener('click', () => {
        linkClientModal.classList.add('hidden');
    });

    linkClientSearch.addEventListener('input', (e) => {
        renderLinkClientList(e.target.value);
    });

    function renderLinkClientList(filter = '') {
        linkClientList.innerHTML = '';
        const lowerFilter = filter.toLowerCase();
        const filtered = allClients.filter(c => 
            c.name.toLowerCase().includes(lowerFilter) || 
            (c.phone && c.phone.includes(filter))
        );

        if (filtered.length === 0) {
            linkClientList.innerHTML = '<p>Клиенты не найдены</p>';
            return;
        }

        filtered.forEach(client => {
            const clientDiv = document.createElement('div');
            clientDiv.className = 'chat-list-item'; // Переиспользуем стиль
            clientDiv.innerHTML = `<span>${client.name} (${client.phone || 'Без номера'})</span>`;
            clientDiv.addEventListener('click', () => {
                if (confirm(`Привязать этот чат к клиенту ${client.name}?`)) {
                    linkChatToClient(client.id);
                }
            });
            linkClientList.appendChild(clientDiv);
        });
    }

    async function linkChatToClient(clientId) {
        if (!activeAnonymousChatId || !clientId) return;

        try {
            const response = await fetch('/.netlify/functions/link-anonymous-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    anonymousChatId: activeAnonymousChatId, 
                    clientId: clientId 
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            alert('Чат успешно привязан!');
            linkClientModal.classList.add('hidden');
            
            // Обновляем интерфейс
            loadAllData(); // Перезагружаем списки
            openChat(clientId, allClients.find(c => c.id === clientId)?.name, null); // Открываем уже как чат клиента

        } catch (err) {
            alert('Ошибка привязки чата: ' + err.message);
        }
    }
});
