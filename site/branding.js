// Ensure the header always shows the brand title without greeting flicker
(function () {
  function setBrand() {
    var h1 = document.querySelector('.app-header h1');
    if (h1) h1.textContent = 'PRIZMATIC';
    document.documentElement.classList.add('brand-ready');
  }
  if (document.readyState === 'loading') {
    // If injected at end of body, DOM is ready anyway, but keep safe
    document.addEventListener('DOMContentLoaded', setBrand, { once: true });
  } else {
    setBrand();
  }
})();

