// Sync Telegram WebApp safe-area and viewport values to CSS variables
(function () {
  const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

  function px(n) { return (typeof n === 'number' && isFinite(n)) ? `${Math.max(0, Math.round(n))}px` : '0px'; }

  function sync() {
    try {
      const root = document.documentElement.style;

      // Viewport heights
      const vh = tg?.viewportHeight || window.innerHeight;
      const vsh = tg?.viewportStableHeight || vh;
      root.setProperty('--tg-viewport-height', px(vh));
      root.setProperty('--tg-viewport-stable-height', px(vsh));

      // Safe/content areas (try multiple shapes for broader client support)
      const csTop = tg?.contentSafeAreaInsetTop ?? tg?.contentSafeAreaInset?.top ?? tg?.safeAreaInsetTop ?? 0;
      const csBottom = tg?.contentSafeAreaInsetBottom ?? tg?.contentSafeAreaInset?.bottom ?? tg?.safeAreaInsetBottom ?? 0;
      root.setProperty('--tg-content-safe-area-inset-top', px(csTop));
      root.setProperty('--tg-content-safe-area-inset-bottom', px(csBottom));
      root.setProperty('--tg-safe-area-inset-top', px(tg?.safeAreaInsetTop ?? 0));
      root.setProperty('--tg-safe-area-inset-bottom', px(tg?.safeAreaInsetBottom ?? 0));

      // Our app’s top offset: base gap + content safe top
      const BASE_TOP_GAP = 14; // small visual breathing room below TG header
      root.setProperty('--app-top-offset', `calc(${BASE_TOP_GAP}px + ${px(csTop)})`);
    } catch (_) {
      /* no-op */
    }
  }

  // Initial sync and live updates
  if (tg && typeof tg.onEvent === 'function') {
    tg.onEvent('viewportChanged', sync);
    tg.onEvent('themeChanged', sync);
    try { tg.ready(); } catch (_) {}
    sync();
  } else {
    // Fallback for dev browser: still set stable height to prevent jumpiness
    const root = document.documentElement.style;
    root.setProperty('--tg-viewport-stable-height', px(window.innerHeight));
    sync();
    window.addEventListener('resize', sync);
  }
})();

