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

  /** Portfolio-style equipment card markup (uses fp-* classes from site theme). */
  function equipmentCardHtml(item, helpers, opts) {
    var h = helpers || {};
    var o = opts || {};
    var esc = h.esc || function(s) { return String(s == null ? '' : s); };
    var mode = inferDisplayMode(item);
    var ofit = (item.imageFit && ['cover', 'contain', 'fill'].indexOf(item.imageFit) >= 0) ? item.imageFit : 'cover';
    var oposMap = { left: 'left center', right: 'right center', top: 'center top', bottom: 'center bottom', center: 'center' };
    var opos = oposMap[item.imagePos] || 'center';
    var shot = '';

    if (mode === 'image' && item.imageUrl) {
      shot = '<img class="fp-img" src="' + esc(item.imageUrl) + '" alt="' + esc(item.label || '') + '" loading="lazy" style="object-fit:' + ofit + ';object-position:' + opos + '">';
    } else if (mode === 'icon' && item.icon && h.iconHtml) {
      shot = '<div class="fp-ph lp-oq-eq-ph-icon">' + h.iconHtml(item.icon) + '</div>';
    } else {
      shot = '<div class="fp-ph">' + esc(item.label || 'Equipment') + '</div>';
    }

    var badge = (item.badge && String(item.badge).trim())
      ? '<span class="fp-tag">' + esc(item.badge) + '</span>' : '';
    var title = item.label ? '<h3 class="fp-title">' + esc(item.label) + '</h3>' : '';
    var sub = (item.subtitle && String(item.subtitle).trim())
      ? '<div class="fp-loc">' + esc(item.subtitle) + '</div>' : '';
    var desc = item.description ? '<p class="fp-desc">' + esc(item.description) + '</p>' : '';
    var qty = o.qtyHtml || '';

    return '<div class="fp-shot">' + shot + badge + '</div>' +
      '<div class="fp-body">' + title + sub + desc + qty + '</div>';
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
    var choiceBlock = choices
      ? (choices.indexOf('lp-oq-choices') >= 0 ? choices : '<div class="lp-oq-choices">' + choices + '</div>')
      : '';

    if (layout === 'split' && choices) {
      return '<div class="lp-oq-split">' +
        '<div class="lp-oq-aside">' + intro + fields + extra + '</div>' +
        choiceBlock + '</div>';
    }
    return '<div class="lp-oq-stack">' + intro + fields + choiceBlock + extra + '</div>';
  }

  function layoutCss(brandVar) {
    var b = brandVar || 'var(--pipe, var(--accent, #1f7a63))';
    return [
      '.lp-oq-card,.lp-oq-body,.lp-oq-carts{width:100%;max-width:100%;box-sizing:border-box}',
      '.lp-oq-stack>.lp-oq-intro{margin:0 0 12px}',
      '.lp-oq-fp-grid.fp-grid,.lp-oq-layout-grid .lp-oq-fp-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px;width:100%;margin-top:16px}',
      '@media(max-width:1100px){.lp-oq-fp-grid.fp-grid,.lp-oq-layout-grid .lp-oq-fp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media(max-width:640px){.lp-oq-fp-grid.fp-grid,.lp-oq-layout-grid .lp-oq-fp-grid{grid-template-columns:1fr}}',
      '.lp-oq-eq-card.fp-card{cursor:pointer;text-align:left;border:none;font:inherit;color:inherit;width:100%;display:flex;flex-direction:column;height:100%;padding:0;background:var(--fp-card-bg,var(--panel,#fff))}',
      '.lp-oq-eq-card.fp-card:hover{transform:translateY(-3px);box-shadow:0 22px 54px rgba(20,30,45,.14)}',
      '.lp-oq-eq-card.fp-card.is-selected{outline:3px solid color-mix(in srgb,' + b + ' 55%,transparent);outline-offset:2px}',
      '.lp-oq-eq-card .fp-shot{position:relative;aspect-ratio:3/2;overflow:hidden;background:var(--steel-900,#1a2230)}',
      '.lp-oq-eq-card .fp-img{width:100%;height:100%;object-fit:cover;display:block}',
      '.lp-oq-eq-card .fp-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,color-mix(in srgb,' + b + ' 12%,#f1f3f6),color-mix(in srgb,' + b + ' 6%,#e3e7ee));color:color-mix(in srgb,' + b + ' 70%,#7c8694);font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:13px;padding:12px;text-align:center}',
      '.lp-oq-eq-ph-icon .lp-oq-ic{display:flex;align-items:center;justify-content:center}',
      '.lp-oq-eq-ph-icon .lp-oq-ic svg{width:52px;height:52px;color:' + b + '}',
      '.lp-oq-eq-card .fp-tag{position:absolute;top:12px;left:12px;background:' + b + ';color:var(--accent-text,var(--on-pipe,#fff));font-weight:700;font-size:10px;letter-spacing:.09em;text-transform:uppercase;padding:5px 10px;border-radius:999px;line-height:1}',
      '.lp-oq-eq-card .fp-body{padding:16px 18px 18px;flex:1;display:flex;flex-direction:column}',
      '.lp-oq-eq-card .fp-title{margin:0;font-size:20px;line-height:1.1;font-weight:800;text-transform:uppercase;color:var(--fp-text,var(--ink,inherit))}',
      '.lp-oq-eq-card .fp-loc{font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + b + ';margin-top:6px}',
      '.lp-oq-eq-card .fp-desc{font-size:14px;line-height:1.45;margin:10px 0 0;color:color-mix(in srgb,var(--fp-text,var(--ink-soft,var(--text-soft,inherit))) 88%,transparent)}',
      '.lp-oq-eq-qty{margin-top:12px;padding-top:12px;border-top:1px solid color-mix(in srgb,' + b + ' 14%,var(--line,var(--border,currentColor)))}',
      '.lp-oq-eq-qty span{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;color:var(--ink-soft,var(--text-soft,inherit))}',
      '.lp-oq-eq-qty input{width:100%;padding:8px 10px;border:1px solid var(--line-strong,var(--border-strong,currentColor));border-radius:8px;font:inherit;background:var(--input-bg,var(--panel,transparent));color:var(--ink,var(--text,inherit));box-sizing:border-box}',
      '.lp-oq-layout-cards .lp-oq-fp-grid{display:flex;flex-direction:column;gap:16px}',
      '.lp-oq-layout-list .lp-oq-fp-grid{display:flex;flex-direction:column;gap:12px}',
      '.lp-oq-layout-list .lp-oq-eq-card.fp-card{flex-direction:row}',
      '.lp-oq-layout-list .lp-oq-eq-card .fp-shot{flex:0 0 140px;aspect-ratio:auto;min-height:100px}',
      '.lp-oq-layout-list .lp-oq-eq-card .fp-body{justify-content:center}',
      '.lp-oq-layout-cards .lp-oq-choices .lp-oq-choice{padding:18px 20px;margin-bottom:12px;border-radius:16px;min-height:72px}',
      '.lp-oq-layout-split .lp-oq-split{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:28px;align-items:start}',
      '.lp-oq-layout-split .lp-oq-aside{padding:14px 16px;border-radius:12px;border:1px solid color-mix(in srgb,' + b + ' 18%,var(--line,var(--border,currentColor)));background:color-mix(in srgb,' + b + ' 6%,transparent)}',
      '.lp-oq-layout-split .lp-oq-choices{display:flex;flex-direction:column;gap:10px}',
      '@media(max-width:720px){.lp-oq-layout-split .lp-oq-split{grid-template-columns:1fr}}'
    ].join('');
  }

  global.LPQuoteDisplay = {
    IMAGE_SIZES: IMAGE_SIZES,
    IMAGE_SIZE_OPTIONS: IMAGE_SIZE_OPTIONS,
    inferDisplayMode: inferDisplayMode,
    normalizeImageScale: normalizeImageScale,
    normalizeImageSize: normalizeImageSize,
    displayPx: displayPx,
    choiceVisualHtml: choiceVisualHtml,
    equipmentCardHtml: equipmentCardHtml,
    wizardLayout: wizardLayout,
    layoutClass: layoutClass,
    wrapStepBody: wrapStepBody,
    layoutCss: layoutCss
  };
})(typeof window !== 'undefined' ? window : global);
