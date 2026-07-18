/**
 * Optional reusable "Built with LeadPages" footer component.
 * Customer sites opt in via plan/settings — never auto-injected by Composer.
 *
 * Usage:
 *   LPBuiltWith.mount(container, { href: 'https://leadpages.example', pulse: true });
 */
(function (global) {
  'use strict';

  function mount(el, opts) {
    opts = opts || {};
    if (!el) return null;
    var href = opts.href || 'https://leadpages.au';
    var label = opts.label || 'Built with LeadPages';
    el.classList.add('lp-built-with');
    if (opts.footer) el.classList.add('lp-built-with--footer');
    if (el.tagName === 'A') {
      el.href = href;
      el.target = opts.target || '_blank';
      el.rel = 'noopener noreferrer';
    }
    el.innerHTML =
      '<span class="lp-built-with__mark leadpages-logo" data-lp-logo data-lp-logo-pulse="' +
      (opts.pulse === false ? 'false' : 'true') +
      '" aria-hidden="true"></span>' +
      '<span class="lp-built-with__label">' +
      String(label).replace(/</g, '&lt;') +
      '</span>';
    if (global.LPLogo && global.LPLogo.upgradeAll) {
      global.LPLogo.upgradeAll({ pulse: opts.pulse !== false });
    }
    return el;
  }

  global.LPBuiltWith = { mount: mount };
})(typeof window !== 'undefined' ? window : globalThis);
