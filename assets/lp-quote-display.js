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

  global.LPQuoteDisplay = {
    IMAGE_SIZES: IMAGE_SIZES,
    IMAGE_SIZE_OPTIONS: IMAGE_SIZE_OPTIONS,
    inferDisplayMode: inferDisplayMode,
    normalizeImageScale: normalizeImageScale,
    normalizeImageSize: normalizeImageSize,
    displayPx: displayPx,
    choiceVisualHtml: choiceVisualHtml
  };
})(window);
