// Small UX tweaks when running inside Telegram WebApp
(function () {
  function hasTGQuery() {
    const q = (location.search || '').toLowerCase();
    return q.includes('tgwebapp') || q.includes('tg_web_app') || q.includes('tgwebappplatform');
  }
  function isTG() {
    return !!(window.Telegram && window.Telegram.WebApp) || hasTGQuery() || sessionStorage.getItem('tgWebApp') === '1';
  }

  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
  }

  function applyIndexTweaks(){
    const header = document.querySelector('.app-header');
    const h1 = document.querySelector('.app-header h1');
    if (header) header.classList.add('header-centered');
    if (h1 && h1.textContent !== 'PRIZMATIC') h1.textContent = 'PRIZMATIC';
    const h2 = document.querySelector('.app-main h2');
    if (h2) {
      h2.textContent = 'Найти и арендовать электровелосипед рядом.';
      h2.classList.add('tg-centered-title');
    }
  }

  function applyStatsTweaks(){
    const header = document.querySelector('.app-header');
    const h1 = document.querySelector('.app-header h1');
    if (header) header.classList.add('header-centered');
    if (h1 && h1.textContent !== 'История') h1.textContent = 'История';
  }

  function applyTweaks(){
    if (!isTG()) return;
    document.body.classList.add('tg-webapp');
    const path = (location.pathname || '').toLowerCase();
    if (path.endsWith('/stats.html') || document.querySelector('.stats-graph')) applyStatsTweaks();
    if (path.endsWith('/index.html') || path.endsWith('/') || path.endsWith('/site/') || document.querySelector('#main-bike-image')) applyIndexTweaks();
  }

  // Run early, and again after load to override late scripts
  onReady(applyTweaks);
  window.addEventListener('load', applyTweaks);

  // Keep it applied if other scripts overwrite content
  const mo = new MutationObserver(() => applyTweaks());
  onReady(() => mo.observe(document.body, { childList: true, subtree: true, characterData: true }));
})();
