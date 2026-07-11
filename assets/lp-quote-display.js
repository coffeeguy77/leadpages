/**
 * Browser mirror of lib/quote-system/display.js + choice HTML helpers.
 */
(function(global) {
  'use strict';

  var IMAGE_SIZES = { compact: 56, standard: 80, large: 120, hero: 180 };

  var IMAGE_SIZE_OPTIONS = [
    { id: 'compact', label: 'Compact (56px)' },
    { id: 'standard', label: 'Standard (80px)' },
    { id: 'large', label: 'Large (120px)' },
    { id: 'hero', label: 'Hero (180px)' }
  ];

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function inferDisplayMode(item) {
    if (!item || typeof item !== 'object') return 'text';
    if (item.displayMode === 'text' || item.displayMode === 'icon' || item.displayMode === 'image') {
      return item.displayMode;
    }
    if (item.imageUrl) return 'image';
    if (item.icon) return 'icon';
    return 'text';
  }

  function normalizeImageScale(scale) {
    var n = parseInt(scale, 10);
    if (isNaN(n)) return 100;
    return clamp(n, 50, 250);
  }

  function normalizeImageSize(size) {
    return IMAGE_SIZES[size] ? size : 'standard';
  }

  function displayPx(size, scale) {
    var base = IMAGE_SIZES[normalizeImageSize(size)] || IMAGE_SIZES.standard;
    return Math.round(base * normalizeImageScale(scale) / 100);
  }

  function choiceVisualHtml(item, helpers) {
    var h = helpers || {};
    var esc = h.esc || function(s) { return String(s == null ? '' : s); };
    var mode = inferDisplayMode(item);
    var label = esc(item && item.label);
    var desc = item && item.description ? '<span>' + esc(item.description) + '</span>' : '';

    if (mode === 'image' && item.imageUrl) {
      var px = displayPx(item.imageSize, item.imageScale);
      return '<img class="lp-oq-choice-img" src="' + esc(item.imageUrl) + '" alt="" style="height:' + px + 'px;width:auto;max-width:100%;object-fit:contain;display:block;margin:0 0 8px;border-radius:8px">' +
        '<strong>' + label + '</strong>' + desc;
    }
    if (mode === 'icon' && item.icon && h.iconHtml) {
      return h.iconHtml(item.icon) + '<strong>' + label + '</strong>' + desc;
    }
    return '<strong>' + label + '</strong>' + desc;
  }

  function wizardLayout(shellOrWizard) {
    var w = shellOrWizard && shellOrWizard.wizard ? shellOrWizard.wizard : shellOrWizard;
    return (w && w.layout) || 'cards';
  }

  function layoutClass(shellOrWizard) {
    return ' lp-oq-layout-' + wizardLayout(shellOrWizard);
  }

  function wrapStepBody(parts, layout) {
    parts = parts || {};
    layout = layout || 'cards';
    var intro = parts.intro || '';
    var fields = parts.fields || '';
    var choices = parts.choices || '';
    var extra = parts.extra || '';

    if (layout === 'split' && choices) {
      return '<div class="lp-oq-split">' +
        '<div class="lp-oq-aside">' + intro + fields + extra + '</div>' +
        '<div class="lp-oq-choices">' + choices + '</div></div>';
    }
    return '<div class="lp-oq-stack">' + intro + fields + choices + extra + '</div>';
  }

  function layoutCss(brandVar) {
    var b = brandVar || 'var(--pipe, var(--accent, #1f7a63))';
    return [
      '.lp-oq-layout-cards .lp-oq-choice{padding:16px 18px;margin-bottom:10px;border-radius:14px}',
      '.lp-oq-layout-list .lp-oq-choice{display:flex;flex-direction:row;align-items:center;gap:12px;padding:9px 12px;margin-bottom:4px;border-radius:8px}',
      '.lp-oq-layout-list .lp-oq-choice .lp-oq-choice-text{flex:1;min-width:0}',
      '.lp-oq-layout-list .lp-oq-choice strong{display:block}',
      '.lp-oq-layout-list .lp-oq-choice span{display:block;margin-top:2px;font-size:12px}',
      '.lp-oq-layout-list .lp-oq-choice .lp-oq-ic{flex-shrink:0;margin-right:0}',
      '.lp-oq-layout-list .lp-oq-choice-img{flex-shrink:0;margin:0!important;height:44px!important;width:44px!important;object-fit:cover}',
      '.lp-oq-layout-split .lp-oq-split{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);gap:24px;align-items:start}',
      '.lp-oq-layout-split .lp-oq-aside .lp-oq-intro{font-size:15px;font-weight:600;color:var(--ink,var(--text,inherit));margin:0 0 12px}',
      '.lp-oq-layout-split .lp-oq-choices{display:flex;flex-direction:column;gap:8px}',
      '.lp-oq-layout-split .lp-oq-choices .lp-oq-choice{margin-bottom:0}',
      '@media(max-width:720px){.lp-oq-layout-split .lp-oq-split{grid-template-columns:1fr}}'
    ].join('').replace(/\$brand/g, b);
  }

  global.LPQuoteDisplay = {
    IMAGE_SIZES: IMAGE_SIZES,
    IMAGE_SIZE_OPTIONS: IMAGE_SIZE_OPTIONS,
    inferDisplayMode: inferDisplayMode,
    normalizeImageScale: normalizeImageScale,
    normalizeImageSize: normalizeImageSize,
    displayPx: displayPx,
    choiceVisualHtml: choiceVisualHtml,
    wizardLayout: wizardLayout,
    layoutClass: layoutClass,
    wrapStepBody: wrapStepBody,
    layoutCss: layoutCss
  };
})(window);
