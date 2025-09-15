export function renderDefaultView(mainContent) {
    mainContent.innerHTML = `
        <div class="bike-image-wrapper">
            <img src="bike-delivery.png" alt="Electric bike" class="bike-image" id="main-bike-image">
            <div id="bike-label" class="bike-label">00001</div>
        </div>
        <div class="progress-section">
            <div class="progress-bar-container"><div class="progress-bar" id="progress-bar-fill"></div></div>
            <div class="progress-labels"><span id="progress-start-label">0 дней</span><span id="progress-end-label">...</span></div>
        </div>
        <h2>Найти и арендовать электровелосипед рядом.</h2>
        <div class="info-cards">
            <div class="card"><div class="icon-wrapper"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div><div class="text-content"><span>Свободных</span><strong id="available-bikes-count">100</strong></div></div>
            <div class="card" id="balance-card"><div class="icon-wrapper dollar"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div><div class="text-content"><span>Баланс</span><strong id="balance-amount">0 ₽</strong></div></div>
        </div>
        <div class="action-buttons">
            <button class="btn btn-primary" id="scan-qr-btn">Сканировать QR-код</button>
            <div class="secondary-actions"><button class="btn btn-secondary" id="scan-icon-btn"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path></svg></button><button class="btn btn-secondary text-btn" id="id-input-btn">Ввести ID</button><button class="btn btn-secondary text-btn" id="booking-btn">Бронь</button></div>
        </div>
        <div id="extend-container" class="hidden extend-container"><button id="extend-rental-btn" class="btn btn-primary">Продлить аренду</button></div>
    `;
}

export function renderActiveRentalView(mainContent, rental) {
    const endsDate = new Date(rental.current_period_ends_at);
    const daysLeft = Math.ceil((endsDate - new Date()) / (1000 * 60 * 60 * 24));
    const durationDays = rental.tariffs?.duration_days || 7;
    const progress = Math.max(0, 100 - (daysLeft / durationDays * 100));

    mainContent.innerHTML = `
        <div class="bike-image-wrapper">
            <img src="bike00001.png" alt="Rented Electric bike" class="bike-image">
            <div class="bike-label">${rental.bike_id}</div>
        </div>
        <div class="progress-section">
            <div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%;"></div></div>
            <div class="progress-labels"><span>В аренде</span><span>Осталось ~${daysLeft} д.</span></div>
        </div>
        <h2>Ваша аренда активна</h2>
        <p style="text-align: center; color: var(--dark-green);">Следующее автоматическое списание ${endsDate.toLocaleDateString('ru-RU')}.</p>
        <div class="action-buttons">
            <button class="btn btn-primary" id="return-bike-btn">Сдать велосипед</button>
        </div>`;
}

export function renderOverdueRentalView(mainContent, rental) {
    mainContent.innerHTML = `
        <div class="bike-image-wrapper">
            <img src="bike00001.png" alt="Rented Electric bike" class="bike-image" style="filter: grayscale(1);">
            <div class="bike-label">${rental.bike_id}</div>
        </div>
        <h2 style="color: #e53e3e; text-align: center;">Аренда просрочена</h2>
        <p style="text-align: center; color: var(--dark-green);">Последний платеж не прошел. Пожалуйста, проверьте баланс карты.</p>
        <div class="action-buttons">
            <button class="btn btn-primary" id="retry-payment-btn">Повторить платеж</button>
            <button class="btn btn-secondary text-btn" id="return-bike-btn">Сдать велосипед</button>
        </div>`;
}

export function renderPendingReturnView(mainContent, rental) {
    mainContent.innerHTML = `
        <div class="bike-image-wrapper">
            <img src="bike00001.png" alt="Rented Electric bike" class="bike-image" style="opacity: 0.7;">
            <div class="bike-label">${rental.bike_id}</div>
        </div>
        <h2 style="text-align: center;">Ожидание сдачи</h2>
        <p style="text-align: center; color: var(--dark-green);">Заявка на сдачу принята. Автосписания остановлены. Ожидайте подтверждения администратора.</p>`;
}
