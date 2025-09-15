// Ensure the header always shows the brand title without greeting flicker
(function () {
  var BRAND = 'PRIZMATIC';
  function setBrand() {
    var header = document.querySelector('.app-header');
    if (!header) return;
    header.classList.add('header-centered');
    var h1 = header.querySelector('h1');
    if (h1) h1.textContent = BRAND;
    // Prevent any late scripts from replacing the title
    try {
      var target = h1 || header;
      var obs = new MutationObserver(function () {
        var h = document.querySelector('.app-header');
        if (!h) return;
        h.classList.add('header-centered');
        var t = h.querySelector('h1');
        if (t && t.textContent !== BRAND) t.textContent = BRAND;
      });
      obs.observe(target, { characterData: true, childList: true, subtree: true });
    } catch (_) {}

    document.documentElement.classList.add('brand-ready');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setBrand, { once: true });
  } else {
    setBrand();
  }
})();
