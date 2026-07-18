/**
 * LeadPages AI animated stroke icons.
 * SVG-only, currentColor, CSS-driven motion via lp-ai-icons.css.
 * Reusable across Website Studio and future AI tools.
 */
(function (global) {
  'use strict';

  var PATHS = {
    brain:
      '<path class="lp-ai-stroke" d="M12 5a4 4 0 0 0-4 4c0 .5-.2 1-.5 1.4A3.5 3.5 0 0 0 9 17h6a3.5 3.5 0 0 0 1.5-6.6c-.3-.4-.5-.9-.5-1.4a4 4 0 0 0-4-4z"/>' +
      '<path class="lp-ai-stroke" d="M9.5 10.5h.01M12 9.5h.01M14.5 10.5h.01M11 13h2"/>',
    wand:
      '<path class="lp-ai-stroke" d="m15 4-1.5 1.5L9 10l-1.5 1.5L4 15l5 5 4-4 4.5-4.5L19 10z"/>' +
      '<path class="lp-ai-wand-star lp-ai-stroke" d="M19 3v4M17 5h4"/>' +
      '<path class="lp-ai-wand-star lp-ai-stroke" d="M6 18v2M5 19h2"/>',
    brush:
      '<path class="lp-ai-stroke" d="m14.5 4.5 5 5-9.5 9.5H5v-5z"/>' +
      '<path class="lp-ai-stroke" d="m14 5 5 5"/>' +
      '<path class="lp-ai-stroke" d="M5.5 15.5c1.5 0 2.5 1 2.5 2.5"/>',
    layout:
      '<rect class="lp-ai-stroke" x="3" y="3" width="18" height="18" rx="2"/>' +
      '<path class="lp-ai-stroke" d="M3 9h18M9 21V9"/>',
    image:
      '<rect class="lp-ai-stroke" x="3" y="5" width="18" height="14" rx="2"/>' +
      '<circle class="lp-ai-stroke" cx="9" cy="10" r="1.5"/>' +
      '<path class="lp-ai-stroke" d="m21 15-4.5-4.5L8 19"/>',
    sparkles:
      '<path class="lp-ai-stroke" d="M12 3v4M12 17v4M3 12h4M17 12h4"/>' +
      '<path class="lp-ai-stroke" d="m6.5 6.5 2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2"/>' +
      '<circle class="lp-ai-stroke" cx="12" cy="12" r="2.5"/>',
    rocket:
      '<path class="lp-ai-stroke" d="M12 15 9 12a18 18 0 0 1 2-3.5A10 10 0 0 1 20 4c0 2.2-.6 6-5 9a18 18 0 0 1-3 2z"/>' +
      '<path class="lp-ai-stroke" d="M9 12H5s.5-2.5 1.8-3.5C8 7.5 11 8 11 8"/>' +
      '<path class="lp-ai-stroke" d="M12 15v4s2.5-.5 3.5-2c1-1.5 0-4 0-4"/>',
    website:
      '<rect class="lp-ai-stroke" x="3" y="4" width="18" height="16" rx="2"/>' +
      '<path class="lp-ai-stroke" d="M3 8h18M8 4v4"/>' +
      '<path class="lp-ai-stroke" d="M7 12h4M7 15h10"/>',
    search:
      '<circle class="lp-ai-stroke" cx="11" cy="11" r="6.5"/>' +
      '<path class="lp-ai-stroke" d="m16 16 4 4"/>',
    typography:
      '<path class="lp-ai-stroke" d="M4 7V5h16v2"/>' +
      '<path class="lp-ai-stroke" d="M12 5v14"/>' +
      '<path class="lp-ai-stroke" d="M8 19h8"/>',
    check:
      '<circle class="lp-ai-stroke" cx="12" cy="12" r="9"/>' +
      '<path class="lp-ai-stroke" d="m8 12 2.5 2.5L16 9"/>'
  };

  var DEFAULT_ANIM = {
    brain: 'pulse',
    wand: 'wand',
    brush: 'draw',
    layout: 'draw',
    image: 'float',
    sparkles: 'pulse',
    rocket: 'float',
    website: 'draw',
    search: 'spin',
    typography: 'fade',
    check: 'draw'
  };

  function svgMarkup(name, opts) {
    opts = opts || {};
    var inner = PATHS[name] || PATHS.sparkles;
    var size = opts.size || 48;
    var anim = opts.anim != null ? opts.anim : DEFAULT_ANIM[name] || 'pulse';
    var cls = 'lp-ai-icon' + (opts.className ? ' ' + opts.className : '');
    if (opts.playing) cls += ' is-playing';
    return (
      '<span class="' +
      cls +
      '" data-icon="' +
      name +
      '" data-anim="' +
      anim +
      '" style="--lp-ai-icon-size:' +
      size +
      'px" aria-hidden="true">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" focusable="false">' +
      inner +
      '</svg></span>'
    );
  }

  function mount(el, name, opts) {
    if (!el) return null;
    el.innerHTML = svgMarkup(name, opts);
    return el.firstChild;
  }

  function list() {
    return Object.keys(PATHS);
  }

  global.LPAiIcons = {
    svg: svgMarkup,
    mount: mount,
    list: list,
    PATHS: PATHS,
    DEFAULT_ANIM: DEFAULT_ANIM
  };
})(typeof window !== 'undefined' ? window : globalThis);
