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

  function equipmentCardVars(shell) {
    var ec = (shell && shell.wizard && shell.wizard.equipmentCards) || {};
    var parts = [];
    if (ec.cardBg) parts.push('--lp-oq-card-bg:' + ec.cardBg);
    if (ec.cardText) parts.push('--lp-oq-card-text:' + ec.cardText);
    if (ec.titleColor || ec.cardText) parts.push('--lp-oq-title:' + (ec.titleColor || ec.cardText));
    if (ec.descColor || ec.cardText) parts.push('--lp-oq-desc:' + (ec.descColor || ec.cardText));
    if (ec.featureColor) parts.push('--lp-oq-feature:' + ec.featureColor);
    if (ec.strokeColor) parts.push('--lp-oq-stroke:' + ec.strokeColor);
    if (ec.strokeWidth != null && ec.strokeWidth !== '') {
      parts.push('--lp-oq-stroke-w:' + Math.max(0, parseInt(ec.strokeWidth, 10) || 0) + 'px');
    }
    if (ec.qtyColor) parts.push('--lp-oq-qty-color:' + ec.qtyColor);
    if (ec.qtyStroke) parts.push('--lp-oq-qty-stroke:' + ec.qtyStroke);
    if (ec.qtyBg) parts.push('--lp-oq-qty-bg:' + ec.qtyBg);
    return parts.length ? parts.join(';') : '';
  }

  /** Wizard chrome colours — panel, progress chips, Continue/Back buttons. */
  function wizardUiVars(shell) {
    var ui = (shell && shell.wizard && shell.wizard.ui) || {};
    var map = [
      ['panelBg', '--lp-oq-panel-bg'],
      ['panelBorder', '--lp-oq-panel-border'],
      ['titleColor', '--lp-oq-panel-title'],
      ['introColor', '--lp-oq-intro'],
      ['mutedColor', '--lp-oq-muted'],
      ['progressBg', '--lp-oq-step-bg'],
      ['progressText', '--lp-oq-step-text'],
      ['progressBorder', '--lp-oq-step-border'],
      ['progressActiveBg', '--lp-oq-step-active-bg'],
      ['progressActiveText', '--lp-oq-step-active-text'],
      ['progressActiveBorder', '--lp-oq-step-active-border'],
      ['progressDoneText', '--lp-oq-step-done-text'],
      ['progressDoneBorder', '--lp-oq-step-done-border'],
      ['btnBg', '--lp-oq-btn-bg'],
      ['btnText', '--lp-oq-btn-text'],
      ['btnGhostBg', '--lp-oq-btn-ghost-bg'],
      ['btnGhostText', '--lp-oq-btn-ghost-text'],
      ['btnGhostBorder', '--lp-oq-btn-ghost-border']
    ];
    var parts = [];
    map.forEach(function(pair) {
      var v = ui[pair[0]];
      if (v && /^#[0-9a-fA-F]{3,8}$/.test(String(v))) parts.push(pair[1] + ':' + v);
    });
    return parts.length ? parts.join(';') : '';
  }

  function equipmentCardHtml(item, helpers, opts) {
    var h = helpers || {};
    var o = opts || {};
    var esc = h.esc || function(s) { return String(s == null ? '' : s); };
    var mode = inferDisplayMode(item);
    var ofit = (item.imageFit && ['cover', 'contain', 'fill'].indexOf(item.imageFit) >= 0) ? item.imageFit : 'cover';
    var axis = (item.imageAxis === 'height' || item.imageAxis === 'width') ? item.imageAxis : '';
    var oposMap = { left: 'left center', right: 'right center', top: 'center top', bottom: 'center bottom', center: 'center' };
    var opos = oposMap[item.imagePos] || 'center';
    var scale = normalizeImageScale(item.imageScale);
    var shot = '';

    if (mode === 'image' && item.imageUrl) {
      var imgStyle = 'object-position:' + opos + ';transform:scale(' + (scale / 100) + ');transform-origin:' + opos + ';';
      if (axis === 'height') {
        imgStyle += 'object-fit:contain;width:auto;height:100%;max-width:none;';
      } else if (axis === 'width') {
        imgStyle += 'object-fit:contain;width:100%;height:auto;max-height:none;';
      } else {
        imgStyle += 'object-fit:' + ofit + ';width:100%;height:100%;';
      }
      shot = '<img class="fp-img' + (axis ? ' fp-img-axis-' + axis : '') + '" src="' + esc(item.imageUrl) + '" alt="' + esc(item.label || '') + '" loading="lazy" style="' + imgStyle + '">';
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
    var titleRow = '<div class="fp-title-row">' + title + qty + '</div>';

    return '<div class="fp-shot">' + shot + badge + '</div>' +
      '<div class="fp-body">' + titleRow + sub + desc + '</div>';
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
      '.lp-oq-eq-card.fp-card{cursor:pointer;text-align:left;width:100%;display:flex;flex-direction:column;height:100%;padding:0;background:var(--lp-oq-card-bg,var(--fp-card-bg,var(--panel,#fff)));color:var(--lp-oq-card-text,var(--fp-text,var(--ink,inherit)));border:var(--lp-oq-stroke-w,1px) solid var(--lp-oq-stroke,color-mix(in srgb,' + b + ' 14%,var(--line,var(--border,currentColor))));border-radius:18px;overflow:hidden;box-shadow:0 10px 32px rgba(20,30,45,.08);transition:box-shadow .18s,border-color .18s;box-sizing:border-box;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}',
      '.lp-oq-eq-card.fp-card:hover{box-shadow:0 22px 54px rgba(20,30,45,.14)}',
      '.lp-oq-eq-card.fp-card.is-selected{border-color:var(--lp-oq-feature,' + b + ');box-shadow:0 0 0 3px color-mix(in srgb,var(--lp-oq-feature,' + b + ') 32%,transparent),0 16px 42px rgba(20,30,45,.12)}',
      '.lp-oq-eq-card .fp-shot{position:relative;aspect-ratio:3/2;overflow:hidden;background:var(--steel-900,#1a2230);display:flex;align-items:center;justify-content:center}',
      '.lp-oq-eq-card .fp-img{width:100%;height:100%;display:block}',
      '.lp-oq-eq-card .fp-img.fp-img-axis-height{margin:0 auto}',
      '.lp-oq-eq-card .fp-img.fp-img-axis-width{margin:auto 0}',
      '.lp-oq-eq-card .fp-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,color-mix(in srgb,' + b + ' 12%,#f1f3f6),color-mix(in srgb,' + b + ' 6%,#e3e7ee));color:color-mix(in srgb,' + b + ' 70%,#7c8694);font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:13px;padding:12px;text-align:center}',
      '.lp-oq-eq-ph-icon .lp-oq-ic{display:flex;align-items:center;justify-content:center}',
      '.lp-oq-eq-ph-icon .lp-oq-ic svg{width:52px;height:52px;color:' + b + '}',
      '.lp-oq-eq-card .fp-tag{position:absolute;top:12px;left:12px;background:var(--lp-oq-feature,' + b + ');color:var(--accent-text,var(--on-pipe,#fff));font-weight:700;font-size:10px;letter-spacing:.09em;text-transform:uppercase;padding:5px 10px;border-radius:999px;line-height:1}',
      '.lp-oq-eq-card .fp-body{padding:16px 18px 18px;flex:1;display:flex;flex-direction:column;background:var(--lp-oq-card-bg,var(--fp-card-bg,transparent))}',
      '.lp-oq-eq-card .fp-title-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0}',
      '.lp-oq-eq-card .fp-title{margin:0;flex:1;min-width:0;font-size:20px;line-height:1.15;font-weight:800;text-transform:uppercase;color:var(--lp-oq-title,var(--lp-oq-card-text,var(--fp-text,var(--ink,inherit))));text-rendering:optimizeLegibility}',
      '.lp-oq-eq-card .fp-loc{font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--lp-oq-feature,' + b + ');margin-top:6px}',
      '.lp-oq-eq-card .fp-desc{font-size:14px;line-height:1.5;margin:10px 0 0;color:var(--lp-oq-desc,var(--lp-oq-card-text,var(--fp-text,var(--ink-soft,var(--text-soft,inherit)))));opacity:.92;text-rendering:optimizeLegibility}',
      '.lp-oq-eq-qty{flex:0 0 auto;display:inline-flex;align-items:stretch;gap:0;border:2px solid var(--lp-oq-qty-stroke,var(--lp-oq-feature,' + b + '));border-radius:10px;background:var(--lp-oq-qty-bg,transparent);color:var(--lp-oq-qty-color,var(--lp-oq-feature,' + b + '));overflow:hidden;line-height:1;user-select:none}',
      '.lp-oq-eq-qty[aria-disabled="true"]{opacity:.45;pointer-events:none}',
      '.lp-oq-eq-qty-num{min-width:1.35em;padding:6px 8px;font-size:22px;font-weight:800;text-align:center;display:flex;align-items:center;justify-content:center;color:inherit}',
      '.lp-oq-eq-qty-btns{display:flex;flex-direction:column;border-left:2px solid var(--lp-oq-qty-stroke,var(--lp-oq-feature,' + b + '))}',
      '.lp-oq-eq-qty-btn{appearance:none;border:0;background:transparent;color:inherit;cursor:pointer;padding:2px 7px;line-height:1;font-size:11px;font-weight:800}',
      '.lp-oq-eq-qty-btn:hover{background:color-mix(in srgb,var(--lp-oq-qty-color,var(--lp-oq-feature,' + b + ')) 12%,transparent)}',
      '.lp-oq-eq-qty-btn + .lp-oq-eq-qty-btn{border-top:1px solid color-mix(in srgb,var(--lp-oq-qty-stroke,var(--lp-oq-feature,' + b + ')) 55%,transparent)}',
      '.lp-oq-eq-qty input[type=hidden]{display:none}',
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
    equipmentCardVars: equipmentCardVars,
    wizardUiVars: wizardUiVars,
    wizardLayout: wizardLayout,
    layoutClass: layoutClass,
    wrapStepBody: wrapStepBody,
    layoutCss: layoutCss
  };
})(typeof window !== 'undefined' ? window : global);
