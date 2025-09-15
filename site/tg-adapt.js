// Small UX tweaks when running inside Telegram WebApp
(function () {
  function isTG() { return !!(window.Telegram && window.Telegram.WebApp); }

  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
  }

  onReady(() => {
    if (!isTG()) return;
    document.body.classList.add('tg-webapp');

    const path = (location.pathname || '').toLowerCase();

    // Index page tweaks: greeting + main subtitle centered
    if (path.endsWith('/index.html') || path.endsWith('/') || path.endsWith('/site/') || document.querySelector('#main-bike-image')) {
      const header = document.querySelector('.app-header');
      const h1 = document.querySelector('.app-header h1');
      if (header) header.classList.add('header-centered');
      if (h1) h1.textContent = 'Привет!';

      const h2 = document.querySelector('.app-main h2');
      if (h2) {
        h2.textContent = 'Найти и арендовать электровелосипед рядом.';
        h2.classList.add('tg-centered-title');
      }
    }

    // Stats page: simple centered title "История"
    if (path.endsWith('/stats.html') || document.querySelector('.stats-graph')) {
      const header = document.querySelector('.app-header');
      const h1 = document.querySelector('.app-header h1');
      if (header) header.classList.add('header-centered');
      if (h1) h1.textContent = 'История';
    }
  });
})();

