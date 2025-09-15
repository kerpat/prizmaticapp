// Simple, smooth page transitions across HTML pages
// - Fades content in on load
// - Fades out on internal link clicks, then navigates
// - Respects prefers-reduced-motion
(function () {
  try {
    // Inject minimal CSS once
    var css = "\n.pt-container{will-change:opacity,transform;opacity:1;transform:none}\n@keyframes pt-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}\nhtml.pt-enter .pt-container{animation:pt-in .35s ease both}\nhtml.pt-leave .pt-container{opacity:0;transform:translateY(10px);transition:opacity .25s ease,transform .25s ease}\nhtml.pt-reduced .pt-container{transition:none!important;animation:none!important;transform:none!important;opacity:1!important}\n.pt-overlay{position:fixed;inset:0;pointer-events:none;background:radial-gradient(1000px 500px at var(--pt-x,50%) var(--pt-y,50%), rgba(41,226,154,.12), transparent 60%);opacity:0;transition:opacity .35s ease}\nhtml.pt-leave .pt-overlay{opacity:1;transition:opacity .25s ease}\n";
    if (!document.getElementById('pt-style')) {
      var style = document.createElement('style');
      style.id = 'pt-style';
      style.textContent = css;
      document.head.appendChild(style);
    }

    // Respect reduced motion
    var reduceMotion = false;
    try { reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
    if (reduceMotion) {
      document.documentElement.classList.add('pt-reduced');
    }

    // Pick a main container to animate
    function pickContainer() {
      return (
        document.querySelector('.app-screen') ||
        document.getElementById('admin-app') ||
        document.body
      );
    }

    var container = null;
    var overlay = null;
    var leaving = false;

    function ensureOverlay() {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'pt-overlay';
        document.body.appendChild(overlay);
      }
    }

    function onReady() {
      container = pickContainer();
      if (!container) return;
      container.classList.add('pt-container');
      ensureOverlay();

      // Trigger enter animation next frame
      requestAnimationFrame(function () {
        document.documentElement.classList.add('pt-enter');
        // Clean up the enter state after it finishes
        setTimeout(function () {
          document.documentElement.classList.remove('pt-enter');
        }, 450);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady, { once: true });
    } else {
      onReady();
    }

    // Intercept internal link clicks to animate the leave
    document.addEventListener('click', function (e) {
      if (leaving) return;
      var a = e.target && (e.target.closest ? e.target.closest('a') : null);
      if (!a) return;

      // Respect modifiers / special links
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;
      var href = a.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      var url;
      try { url = new URL(a.href); } catch (_) { return; }
      if (url.origin !== location.origin) return; // external

      // Same-path with only hash change — let browser handle
      if (url.pathname === location.pathname && url.hash && url.hash !== location.hash) return;

      // Modifier keys: open in new tab/window
      var withMod = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
      if (withMod) return;

      // Start leave transition
      e.preventDefault();
      leaving = true;

      // Fancy overlay origin from click point
      ensureOverlay();
      if (overlay && e.clientX != null && e.clientY != null) {
        overlay.style.setProperty('--pt-x', e.clientX + 'px');
        overlay.style.setProperty('--pt-y', e.clientY + 'px');
      }

      document.documentElement.classList.remove('pt-enter');
      document.documentElement.classList.add('pt-leave');

      // Navigate after transition; keep in sync with CSS duration
      var delay = reduceMotion ? 0 : 280;
      setTimeout(function () {
        window.location.href = a.href;
      }, delay);
    }, true);
  } catch (err) {
    // Fail-safe: never block navigation
    console.error('[transitions] init error:', err);
  }
})();
