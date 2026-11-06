/* "Built on LeadPages" gallery: loads each live preview when it scrolls into view, scales it
   to the card (desktop layout on wide cards, phone layout on narrow ones) and handles
   "See more". Previews are non-interactive; the card links to the live site. */
(function () {
  'use strict';
  var roots = document.querySelectorAll('[data-lpsl]');
  if (!roots.length) return;

  function fit(frame) {
    var view = frame.parentNode;
    if (!view) return;
    var w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    var base = w < 400 ? 430 : 1280;          // phone-width cards show the site's mobile layout
    var s = w / base;
    var fullH = Math.ceil(h / s);
    frame.style.width = base + 'px';
    frame.style.height = (fullH + 900) + 'px';
    frame.style.setProperty('--lpsl-s', String(s));
    frame.style.setProperty('--lpsl-scroll', (-Math.round(700 * s)) + 'px');
  }

  function load(frame) {
    if (frame.getAttribute('src')) return;
    var src = frame.getAttribute('data-lpsl-src');
    if (!src) return;
    fit(frame);
    frame.addEventListener('load', function () {
      setTimeout(function () { frame.classList.add('is-ready'); }, 250);
    }, { once: true });
    frame.setAttribute('src', src);
  }

  var frames = [];
  roots.forEach(function (root) {
    root.querySelectorAll('iframe[data-lpsl-src]').forEach(function (f) { frames.push(f); });
  });

  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { load(e.target); io.unobserve(e.target); }
    });
  }, { rootMargin: '300px 0px' }) : null;

  function watch(f) {
    if (io) io.observe(f); else load(f);
  }
  frames.forEach(function (f) {
    if (f.closest('[hidden]')) return;      // "See more" cards load when revealed
    watch(f);
  });

  var t = null;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () { frames.forEach(function (f) { if (f.getAttribute('src')) fit(f); }); }, 150);
  });

  roots.forEach(function (root) {
    var btn = root.querySelector('[data-lpsl-more]');
    if (!btn) return;
    var grid = document.getElementById(btn.getAttribute('aria-controls'));
    if (!grid) return;
    btn.addEventListener('click', function () {
      var open = grid.hasAttribute('hidden');
      if (open) {
        grid.removeAttribute('hidden');
        grid.querySelectorAll('iframe[data-lpsl-src]').forEach(watch);
      } else {
        grid.setAttribute('hidden', '');
        root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? btn.getAttribute('data-less') : btn.getAttribute('data-more');
    });
  });
})();
