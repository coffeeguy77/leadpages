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

  function equipmentCardHtml(item, helpers) {
    var h = helpers || {};
    var esc = h.esc || function(s) { return String(s == null ? '' : s); };
    var mode = inferDisplayMode(item);
    var ofit = (item.imageFit && ['cover', 'contain', 'fill'].indexOf(item.imageFit) >= 0) ? item.imageFit : 'cover';
    var oposMap = { left: 'left center', right: 'right center', top: 'center top', bottom: 'center bottom', center: 'center' };
    var opos = oposMap[item.imagePos] || 'center';
    var shot = '';

    if (mode === 'image' && item.imageUrl) {
      shot = '<img class="lp-oq-eq-img" src="' + esc(item.imageUrl) + '" alt="' + esc(item.label || '') + '" loading="lazy" style="object-fit:' + ofit + ';object-position:' + opos + '">';
    } else if (mode === 'icon' && item.icon && h.iconHtml) {
      shot = '<div class="lp-oq-eq-ph lp-oq-eq-ph-icon">' + h.iconHtml(item.icon) + '</div>';
    } else {
      shot = '<div class="lp-oq-eq-ph">' + esc(item.label || 'Equipment') + '</div>';
    }

    var badge = (item.badge && String(item.badge).trim())
      ? '<span class="lp-oq-eq-badge">' + esc(item.badge) + '</span>' : '';
    var title = item.label ? '<h3 class="lp-oq-eq-title">' + esc(item.label) + '</h3>' : '';
    var sub = (item.subtitle && String(item.subtitle).trim())
      ? '<div class="lp-oq-eq-sub">' + esc(item.subtitle) + '</div>' : '';
    var desc = item.description ? '<p class="lp-oq-eq-desc">' + esc(item.description) + '</p>' : '';

    return '<div class="lp-oq-eq-shot">' + shot + badge + '</div>' +
      '<div class="lp-oq-eq-body">' + title + sub + desc + '</div>';
  }

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
      '.lp-oq-card,.lp-oq-body,.lp-oq-carts{width:100%}',
      '.lp-oq-stack>.lp-oq-intro{margin:0 0 12px}',
      '.lp-oq-layout-cards .lp-oq-choices .lp-oq-choice{padding:18px 20px;margin-bottom:12px;border-radius:16px;min-height:72px}',
      '.lp-oq-layout-cards .lp-oq-choices .lp-oq-choice .lp-oq-ic svg{width:22px;height:22px}',
      '.lp-oq-layout-grid .lp-oq-stack{display:block;width:100%}',
      '.lp-oq-layout-grid .lp-oq-carts .lp-oq-choices,.lp-oq-layout-grid .lp-oq-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:22px;width:100%;margin-top:16px}',
      '@media(min-width:900px){.lp-oq-layout-grid .lp-oq-carts .lp-oq-choices,.lp-oq-layout-grid .lp-oq-choices{grid-template-columns:repeat(4,minmax(0,1fr))}}',
      '@media(max-width:899px) and (min-width:541px){.lp-oq-layout-grid .lp-oq-carts .lp-oq-choices,.lp-oq-layout-grid .lp-oq-choices{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media(max-width:540px){.lp-oq-layout-grid .lp-oq-carts .lp-oq-choices,.lp-oq-layout-grid .lp-oq-choices{grid-template-columns:1fr}}',
      '.lp-oq-product.lp-oq-eq-card{display:flex;flex-direction:column;height:100%;background:var(--lp-oq-card-bg,var(--panel,transparent));border:1px solid color-mix(in srgb,' + b + ' 14%,var(--line,var(--border,currentColor)));border-radius:18px;overflow:hidden;box-shadow:0 10px 32px rgba(20,30,45,.08);transition:transform .18s,box-shadow .18s,border-color .18s}',
      '.lp-oq-product.lp-oq-eq-card:hover{transform:translateY(-2px);box-shadow:0 16px 42px rgba(20,30,45,.12)}',
      '.lp-oq-product.lp-oq-eq-card.is-selected{border-color:' + b + ';box-shadow:0 0 0 3px color-mix(in srgb,' + b + ' 32%,transparent),0 16px 42px rgba(20,30,45,.12)}',
      '.lp-oq-product.lp-oq-eq-card .lp-oq-choice{display:block;width:100%;padding:0;margin:0;border:none;box-shadow:none;background:transparent;text-align:left;cursor:pointer;color:inherit;font:inherit}',
      '.lp-oq-product.lp-oq-eq-card .lp-oq-choice.is-selected{border:none;box-shadow:none}',
      '.lp-oq-eq-shot{position:relative;aspect-ratio:3/2;overflow:hidden;background:var(--steel-900,#1a2230)}',
      '.lp-oq-eq-img{width:100%;height:100%;object-fit:cover;display:block}',
      '.lp-oq-eq-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,color-mix(in srgb,' + b + ' 12%,#f1f3f6),color-mix(in srgb,' + b + ' 6%,#e3e7ee));color:color-mix(in srgb,' + b + ' 70%,#7c8694);font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:13px;padding:12px;text-align:center}',
      '.lp-oq-eq-ph-icon .lp-oq-ic{display:flex;align-items:center;justify-content:center}',
      '.lp-oq-eq-ph-icon .lp-oq-ic svg{width:52px;height:52px;color:' + b + '}',
      '.lp-oq-eq-badge{position:absolute;top:12px;left:12px;background:' + b + ';color:var(--accent-text,var(--on-pipe,#fff));font-weight:700;font-size:10px;letter-spacing:.09em;text-transform:uppercase;padding:5px 10px;border-radius:999px;line-height:1}',
      '.lp-oq-eq-body{padding:16px 18px 18px;flex:1;display:flex;flex-direction:column}',
      '.lp-oq-eq-title{margin:0;font-size:20px;line-height:1.1;font-weight:800;text-transform:uppercase;color:var(--ink,var(--text,inherit))}',
      '.lp-oq-eq-sub{font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:' + b + ';margin-top:6px}',
      '.lp-oq-eq-desc{font-size:14px;line-height:1.45;margin:10px 0 0;color:var(--ink-soft,var(--text-soft,inherit))}',
      '.lp-oq-eq-card .lp-oq-product-qty{margin:0;padding:0 16px 14px}',
      '.lp-oq-eq-card .lp-oq-product-qty input{font-size:14px}',
      '.lp-oq-layout-cards .lp-oq-carts .lp-oq-choices,.lp-oq-layout-cards .lp-oq-choices{display:flex;flex-direction:column;gap:16px;width:100%}',
      '.lp-oq-layout-list .lp-oq-stack{display:block;width:100%}',
      '.lp-oq-layout-list .lp-oq-carts .lp-oq-choices,.lp-oq-layout-list .lp-oq-choices{display:flex;flex-direction:column;gap:12px;width:100%;margin-top:12px}',
      '.lp-oq-layout-list .lp-oq-product.lp-oq-eq-card{flex-direction:row;align-items:stretch}',
      '.lp-oq-layout-list .lp-oq-product.lp-oq-eq-card .lp-oq-choice{display:flex;flex:1;flex-direction:row;align-items:stretch}',
      '.lp-oq-layout-list .lp-oq-eq-shot{flex:0 0 140px;aspect-ratio:auto;min-height:100px}',
      '.lp-oq-layout-list .lp-oq-eq-body{padding:14px 16px;justify-content:center}',
      '.lp-oq-layout-list .lp-oq-eq-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.lp-oq-layout-list .lp-oq-eq-card .lp-oq-product-qty{align-self:center;padding:0 14px 0 0}',
      '.lp-oq-layout-split .lp-oq-split{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:28px;align-items:start}',
      '.lp-oq-layout-split .lp-oq-aside{padding:14px 16px;border-radius:12px;border:1px solid color-mix(in srgb,' + b + ' 18%,var(--line,var(--border,currentColor)));background:color-mix(in srgb,' + b + ' 6%,transparent)}',
      '.lp-oq-layout-split .lp-oq-aside .lp-oq-intro{font-size:16px;font-weight:700;color:var(--ink,var(--text,inherit));margin:0 0 14px}',
      '.lp-oq-layout-split .lp-oq-choices{display:flex;flex-direction:column;gap:10px}',
      '.lp-oq-layout-split .lp-oq-choices .lp-oq-choice{margin-bottom:0}',
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
})(window);
