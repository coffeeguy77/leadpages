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
    // Phones show each site's mobile layout; everything else shows the desktop site.
    var base = (window.innerWidth || w) < 640 ? 430 : 1280;
    var s = w / base;
    frame.style.width = base + 'px';
    frame.style.height = Math.ceil(h / s) + 'px';
    frame.style.setProperty('--lpsl-s', String(s));
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

  // Industry chips: show only cards of that trade (all of them, including "See more" ones).
  roots.forEach(function (root) {
    var chips = root.querySelectorAll('[data-lpsl-chip]');
    if (!chips.length) return;
    var grid = root.querySelector('.lpsl-grid');
    var more = root.querySelector('.lpsl-foot');
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var want = chip.getAttribute('data-lpsl-chip');
        chips.forEach(function (c) { var on = c === chip; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        root.querySelectorAll('[data-lpsl-card]').forEach(function (card) {
          card.hidden = !!want && card.getAttribute('data-lpsl-ind') !== want;
        });
        root.classList.toggle('is-filtered', !!want);
        if (grid) {
          if (want) grid.removeAttribute('hidden'); else grid.setAttribute('hidden', '');
          grid.querySelectorAll('iframe[data-lpsl-src]').forEach(function (f) { if (!f.closest('[hidden]')) watch(f); });
        }
        if (more) {
          more.hidden = !!want;
          var mb = more.querySelector('[data-lpsl-more]');
          if (mb && !want) { mb.setAttribute('aria-expanded', 'false'); mb.textContent = mb.getAttribute('data-more'); }
        }
      });
    });
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
