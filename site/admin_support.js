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

    let allClients = [];
    let activeChatClientId = null;

    // --- ОСНОВНЫЕ ФУНКЦИИ ---

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
    loadAllClients();
});
