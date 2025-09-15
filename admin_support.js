document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://avamqfmuhiwtlumjkzmv.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YW1xZm11aGl3dGx1bWprem12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjMyODcsImV4cCI6MjA3MjIzOTI4N30.EwEPM0pObAd3v_NXI89DLcgKVYrUiOn7iHuCXXaqU4I';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- DOM Элементы ---
    const chatListContainer = document.getElementById('chat-list-container');
    const chatWindowHeader = document.getElementById('chat-window-header');
    const chatHistoryContainer = document.getElementById('chat-history-container');
    const chatInput = document.getElementById('chat-input-admin');
    const sendBtn = document.getElementById('send-chat-admin-btn');
    const searchInput = document.getElementById('client-chat-search');
    const linkChatBar = document.getElementById('link-chat-bar');
    const linkChatBtn = document.getElementById('link-chat-btn');
    const linkClientModal = document.getElementById('link-client-modal');
    const linkClientCancelBtn = document.getElementById('link-client-cancel-btn');
    const linkClientSearch = document.getElementById('link-client-search');
    const linkClientList = document.getElementById('link-client-list');

    // --- Состояние приложения ---
    let allClients = [];
    let allAnonymousChats = [];
    let activeChatClientId = null;
    let activeAnonymousChatId = null;
    let currentSubscription = null; // Для real-time подписки

    // --- ОСНОВНЫЕ ФУНКЦИИ ---

    async function loadAllData() {
        console.log('1. Starting data load...');
        try {
            const [clientsRes, anonChatsRes] = await Promise.all([
                supabase.from('clients').select('id, name, phone').order('created_at', { ascending: false }),
                supabase.rpc('get_anonymous_chats')
            ]);

            console.log('2. Fetched data from Supabase.');

            if (clientsRes.error) {
                console.error('CLIENTS FETCH ERROR:', clientsRes.error);
                throw clientsRes.error;
            }
            if (anonChatsRes.error) {
                console.error('ANONYMOUS CHATS RPC ERROR:', anonChatsRes.error);
                throw anonChatsRes.error;
            }

            allClients = clientsRes.data || [];
            allAnonymousChats = anonChatsRes.data || [];
            
            console.log('3. Clients found:', allClients.length);
            console.log('4. Anonymous chats found:', allAnonymousChats.length, allAnonymousChats);

            renderChatList();
            console.log('5. Rendered chat list.');

        } catch (err) {
            console.error('ОШИБКА В loadAllData:', err);
            chatListContainer.innerHTML = `<p style="padding: 10px; color: red;">Ошибка: ${err.message}</p>`;
        }
    }

    function renderChatList(filter = '') {
        chatListContainer.innerHTML = '';
        const lowerFilter = filter.toLowerCase();

        const filteredClients = filter ? allClients.filter(c => c.name.toLowerCase().includes(lowerFilter) || (c.phone && c.phone.includes(lowerFilter))) : allClients;
        const filteredAnonymous = filter ? allAnonymousChats.filter(c => (c.last_message_text && c.last_message_text.toLowerCase().includes(lowerFilter)) || c.anonymous_chat_id.includes(lowerFilter)) : allAnonymousChats;

        if (filteredClients.length === 0 && filteredAnonymous.length === 0) {
            chatListContainer.innerHTML = '<p style="padding: 10px; text-align: center;">Чаты не найдены</p>';
            return;
        }

        filteredAnonymous.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'chat-list-item';
            item.dataset.anonymousId = chat.anonymous_chat_id;
            item.innerHTML = `
                <div class="chat-avatar" style="background-color: #718096;">?</div>
                <div class="chat-info">
                    <div class="chat-name">Анонимный чат #${chat.anonymous_chat_id.slice(5, 10)}</div>
                    <div class="last-message">${chat.last_message_text || '...'}</div>
                </div>
            `;
            item.addEventListener('click', () => openChat(null, null, chat.anonymous_chat_id));
            chatListContainer.appendChild(item);
        });

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

    async function openChat(clientId, clientName, anonymousId) {
        activeChatClientId = clientId;
        activeAnonymousChatId = anonymousId;

        // Отписываемся от предыдущего чата, если были подписаны
        if (currentSubscription) {
            supabase.removeChannel(currentSubscription);
            currentSubscription = null;
        }

        linkChatBar.classList.toggle('hidden', !anonymousId);
        chatWindowHeader.textContent = clientName || `Анонимный чат #${anonymousId ? anonymousId.slice(5, 10) : ''}`;
        chatHistoryContainer.innerHTML = '<p style="text-align:center;">Загрузка сообщений...</p>';

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
            } else {
                let lastDate = null;
                data.forEach(msg => {
                    const messageDate = new Date(msg.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
                    if (messageDate !== lastDate) {
                        addDateSeparator(messageDate);
                        lastDate = messageDate;
                    }
                    renderMessage(msg);
                });
            }
            chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;

            // --- ПОДПИСКА НА REAL-TIME ОБНОВЛЕНИЯ ---
            const subscriptionId = clientId ? `client-${clientId}` : `anon-${anonymousId}`;
            currentSubscription = supabase.channel(`support-chat-${subscriptionId}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'support_messages', 
                    filter: clientId ? `client_id=eq.${clientId}` : `anonymous_chat_id=eq.${anonymousId}`
                }, payload => {
                    console.log('New message received:', payload.new);
                    renderMessage(payload.new);
                    chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
                })
                .subscribe();

        } catch (err) {
            console.error('Ошибка загрузки сообщений:', err);
            chatHistoryContainer.innerHTML = '<p style="padding: 10px; color: red;">Ошибка загрузки сообщений</p>';
        }
    }

    function addDateSeparator(dateText) {
        const separatorEl = document.createElement('div');
        separatorEl.className = 'date-separator';
        separatorEl.textContent = dateText;
        chatHistoryContainer.appendChild(separatorEl);
    }

    function renderMessage(message) {
        const time = new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${message.sender === 'admin' ? 'admin-message' : 'client-message'}`;
        
        let contentHTML = '';
        contentHTML += `<div class="message-text">${message.message_text}</div>`;
        contentHTML += `<div class="message-timestamp">${time}</div>`;

        msgDiv.innerHTML = contentHTML;
        chatHistoryContainer.appendChild(msgDiv);
    }

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text || (!activeChatClientId && !activeAnonymousChatId)) return;

        chatInput.disabled = true;
        sendBtn.disabled = true;

        const messagePayload = { sender: 'admin', message_text: text, is_read: false, created_at: new Date().toISOString() };
        if (activeChatClientId) {
            messagePayload.client_id = activeChatClientId;
        }
        else {
            messagePayload.anonymous_chat_id = activeAnonymousChatId;
        }

        try {
            const { data, error } = await supabase.from('support_messages').insert(messagePayload).select().single();
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

    function renderLinkClientList(filter = '') {
        linkClientList.innerHTML = '';
        const lowerFilter = filter.toLowerCase();
        const filtered = allClients.filter(c => c.name.toLowerCase().includes(lowerFilter) || (c.phone && c.phone.includes(filter)));

        if (filtered.length === 0) {
            linkClientList.innerHTML = '<p>Клиенты не найдены</p>';
            return;
        }

        filtered.forEach(client => {
            const clientDiv = document.createElement('div');
            clientDiv.className = 'chat-list-item';
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
                body: JSON.stringify({ anonymousChatId: activeAnonymousChatId, clientId: clientId })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            alert('Чат успешно привязан!');
            linkClientModal.classList.add('hidden');
            loadAllData();
            openChat(clientId, allClients.find(c => c.id === clientId)?.name, null);
        } catch (err) {
            alert('Ошибка привязки чата: ' + err.message);
        }
    }

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---
    searchInput.addEventListener('input', (e) => renderChatList(e.target.value));
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });
    linkChatBtn.addEventListener('click', () => { renderLinkClientList(); linkClientModal.classList.remove('hidden'); });
    linkClientCancelBtn.addEventListener('click', () => linkClientModal.classList.add('hidden'));
    linkClientSearch.addEventListener('input', (e) => renderLinkClientList(e.target.value));

    // --- ИНИЦИАЛИЗАЦИЯ ---
    loadAllData();
});
