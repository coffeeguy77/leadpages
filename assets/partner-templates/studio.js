/* Studio family partner designs: contact pop-up and phone menu. */
(function () {
  'use strict';
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function () {
    var dlg = document.getElementById('st-contact');
    document.addEventListener('click', function (e) {
      var open = e.target.closest && e.target.closest('[data-st-open="contact"]');
      if (open) {
        e.preventDefault();
        if (dlg && typeof dlg.showModal === 'function') {
          dlg.showModal();
          var first = dlg.querySelector('input[name="name"]');
          if (first) setTimeout(function () { first.focus(); }, 30);
        } else {
          var target = document.getElementById('contact');
          if (target) target.scrollIntoView({ behavior: 'smooth' });
          else if (dlg) dlg.setAttribute('open', '');
        }
        return;
      }
      if (dlg && e.target === dlg) dlg.close();   // click on the backdrop
      var navLink = e.target.closest && e.target.closest('.st-nav.is-open .st-links a');
      if (navLink) toggleMenu(false);
    });
    var nav = document.querySelector('.st-nav');
    var btn = document.querySelector('[data-st-menu]');
    function toggleMenu(on) {
      if (!nav || !btn) return;
      nav.classList.toggle('is-open', on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    if (btn) btn.addEventListener('click', function () { toggleMenu(!nav.classList.contains('is-open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggleMenu(false); });
  });
})();
