'use strict';

/**
 * Live trade shell guards — stop plumbing placeholder FOUC / residual copy
 * from painting unless that content is actually present in sites.config.
 *
 * Website Studio uses landing-shell-neutral + its own scrub; this module is
 * for api/render.js → trade.template.json (public + manage preview).
 */

const {
  resolveSectionOrder,
  sectionIsOn,
  OFF_BY_DEFAULT,
  DEFAULT_LAYOUT_SECTIONS,
  OPTIONAL_SECTIONS
} = require('./section-order');
const { formatSeoTextHtml, clientSource } = require('./seo-text-format');
const { clientSource: colorOverrideClientSource } = require('./color-overrides');

const TRADE_RESIDUAL =
  /we'll clear it today|burst pipes?|blocked drain|licensed canberra plumber|24\/7 emergency plumber|speak to a plumber|flooded weekend|drain cleaning team|old pipework|leak detection|fully licensed act plumbers|what we fix|kitchen sink|one call sorts the lot|212 five-star|tell us the problem/i;

const PLACEHOLDER_SCRUBS = [
  [/Blocked drain\?/gi, ''],
  [/We'll clear it today\.?/gi, ''],
  [/Licensed Canberra plumber\s*·\s*Same-day/gi, ''],
  [/Licensed Canberra plumber/gi, ''],
  [/Fast, fixed-price plumbing across the ACT[\s\S]*?before we start\./gi, ''],
  [/⚠?\s*24\/7 Emergency Plumber\s*—\s*Burst pipe or flooding\?/gi, ''],
  [/24\/7 Emergency Plumber/gi, ''],
  [/Speak to a plumber/gi, 'Call us'],
  [/burst pipes?/gi, ''],
  [/blocked drains?/gi, '']
];

/** Sections whose static shell often carries plumbing demo copy. */
const RESIDUAL_SHELL_SECS = [
  'services',
  'why',
  'serviceProcess',
  'crew',
  'area',
  'reviews',
  'quote',
  'faq'
];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cfgOwnsResidual(cfg) {
  try {
    const blob = JSON.stringify((cfg && cfg.sections) || {});
    return TRADE_RESIDUAL.test(blob);
  } catch (_e) {
    return false;
  }
}

function sectionOn(cfg, key) {
  return sectionIsOn(cfg, key);
}

function altHeroOn(cfg) {
  const sec = (cfg && cfg.sections) || {};
  return ['heroSlider', 'heroBeforeAfter', 'splitHero'].some(function (k) {
    return sec[k] && sec[k].on === true;
  });
}

function hideSec(html, key) {
  return String(html || '').replace(
    new RegExp(
      '<(section|div|header|footer|aside)\\b([^>]*\\bdata-sec="' + key + '"[^>]*)>',
      'gi'
    ),
    function (full, tag, attrs) {
      if (/\bhidden\b/i.test(attrs) || /display\s*:\s*none/i.test(attrs)) return full;
      return '<' + tag + attrs + ' hidden style="display:none!important">';
    }
  );
}

function scrubPlaceholders(html) {
  let out = String(html || '');
  PLACEHOLDER_SCRUBS.forEach(function (pair) {
    out = out.replace(pair[0], pair[1]);
  });
  return out;
}

/**
 * Paint classic hero mounts from config when present (first paint = real copy).
 */
function paintHeroFromConfig(html, cfg) {
  const H = (cfg && cfg.sections && cfg.sections.hero) || {};
  if (!H || H.on === false) return html;
  const title = String(H.title || '').trim();
  const titleHl = String(H.titleHl || '').trim();
  const eyebrow = String(H.eyebrow || '').trim();
  const sub = String(H.sub || '').trim();
  if (!title && !eyebrow && !sub) return html;

  let out = html;
  out = out.replace(
    /(<section\b[^>]*\bdata-sec="hero"[^>]*>[\s\S]*?<span class="eyebrow">)([\s\S]*?)(<\/span>)/i,
    function (_m, a, _old, c) {
      return a + esc(eyebrow) + c;
    }
  );
  out = out.replace(
    /(<section\b[^>]*\bdata-sec="hero"[^>]*>[\s\S]*?<h1>)([\s\S]*?)(<\/h1>)/i,
    function (_m, a, _old, c) {
      let inner = esc(title);
      if (titleHl) {
        const hl = esc(titleHl);
        if (inner.indexOf(hl) >= 0) inner = inner.replace(hl, '<span class="hl">' + hl + '</span>');
        else inner = inner + (inner ? ' ' : '') + '<span class="hl">' + hl + '</span>';
      }
      return a + inner + c;
    }
  );
  out = out.replace(
    /(<section\b[^>]*\bdata-sec="hero"[^>]*>[\s\S]*?<p class="hero-sub">)([\s\S]*?)(<\/p>)/i,
    function (_m, a, _old, c) {
      return a + esc(sub) + c;
    }
  );
  return out;
}

function activeMarketingBlob(cfg) {
  const sec = (cfg && cfg.sections) || {};
  const parts = [];
  const push = function (v) {
    if (v != null && String(v).trim()) parts.push(String(v));
  };
  push(cfg && cfg.trade);
  push(cfg && (cfg.business || cfg.businessName));
  if (sec.heroSlider && sec.heroSlider.on === true) {
    (Array.isArray(sec.heroSlider.slides) ? sec.heroSlider.slides : []).forEach(function (s) {
      if (!s) return;
      push(s.eyebrow);
      push(s.heading || s.title);
      push(s.subText || s.sub);
    });
  }
  if (sec.hero && sec.hero.on !== false) {
    push(sec.hero.eyebrow);
    push(sec.hero.title);
    push(sec.hero.titleHl);
    push(sec.hero.sub);
  }
  return parts.join(' ');
}

/** Plumbing emerg left over from template defaults on a non-plumbing site. */
function stalePlumbingEmerg(cfg) {
  const E = (cfg && cfg.sections && cfg.sections.emerg) || {};
  const text = String(E.text || '').trim();
  if (!text || !TRADE_RESIDUAL.test(text)) return false;
  const active = activeMarketingBlob(cfg);
  if (!active.trim()) return true;
  return !TRADE_RESIDUAL.test(active);
}

function paintEmergFromConfig(html, cfg) {
  const E = (cfg && cfg.sections && cfg.sections.emerg) || {};
  if (E.on === false) return hideSec(html, 'emerg');
  const text = E.text != null ? String(E.text).trim() : '';
  if (!text || stalePlumbingEmerg(cfg)) {
    return hideSec(html, 'emerg');
  }
  return String(html || '').replace(
    /(<div\b[^>]*\bdata-sec="emerg"[^>]*>)([\s\S]*?)(<a\b[^>]*id="emergCall"[^>]*>)/i,
    function (_m, a, _mid, link) {
      return a + esc(text) + ' ' + link;
    }
  );
}

function knownSectionIds() {
  const ids = {};
  DEFAULT_LAYOUT_SECTIONS.forEach(function (id) {
    ids[id] = 1;
  });
  OPTIONAL_SECTIONS.forEach(function (id) {
    ids[id] = 1;
  });
  OFF_BY_DEFAULT.forEach(function (id) {
    ids[id] = 1;
  });
  RESIDUAL_SHELL_SECS.forEach(function (id) {
    ids[id] = 1;
  });
  return Object.keys(ids);
}

/** Hide any section the config says is off — before first paint. */
function hideInactiveSections(html, cfg) {
  let out = String(html || '');
  knownSectionIds().forEach(function (id) {
    if (id === 'footer' || id === 'lpFooter') return;
    if (!sectionIsOn(cfg, id)) out = hideSec(out, id);
  });
  return out;
}

/**
 * Apply Position as CSS flex order so SEO Text (etc.) stay where saved
 * even before applyCfg runs.
 */
function injectSectionOrderCss(html, cfg) {
  const order = resolveSectionOrder(cfg || {});
  if (!order.length) return html;
  let rules =
    'main#top{display:flex!important;flex-direction:column!important}';
  order.forEach(function (id, i) {
    const n = i + 1;
    if (id === 'promotions') {
      rules +=
        '[data-sec="promotions-hero"]{order:' +
        n +
        '!important}' +
        '[data-sec="promotions-inline"]{order:' +
        n +
        '!important}';
      return;
    }
    rules += '[data-sec="' + id + '"]{order:' + n + '!important}';
  });
  const css = '<style id="lp-section-order">' + rules + '</style>\n';
  if (String(html || '').includes('id="lp-section-order"')) return html;
  if (html.includes('</head>')) return html.replace('</head>', css + '</head>');
  return css + html;
}

function injectFoucGuard(html) {
  const opt = OFF_BY_DEFAULT.map(function (id) {
    return 'html:not(.lp-cfg-ready) [data-sec="' + id + '"]';
  }).join(',');
  const residual = RESIDUAL_SHELL_SECS.map(function (id) {
    return 'html:not(.lp-cfg-ready) [data-sec="' + id + '"]';
  }).join(',');
  const css =
    '<style id="lp-fouc-guard">' +
    'html:not(.lp-cfg-ready) .emerg[data-sec="emerg"],' +
    'html:not(.lp-cfg-ready) section.hero[data-sec="hero"],' +
    residual +
    (residual && opt ? ',' : '') +
    opt +
    '{visibility:hidden!important}' +
    '</style>\n';
  if (String(html || '').includes('id="lp-fouc-guard"')) return html;
  if (html.includes('</head>')) return html.replace('</head>', css + '</head>');
  return css + html;
}

/**
 * Ensure applyCfg marks the document ready so FOUC CSS lifts.
 */
function injectCfgReadyHook(html) {
  const needle = 'applyCfg(SITE_CONFIG)';
  if (!String(html || '').includes(needle)) return html;
  if (html.includes("classList.add('lp-cfg-ready')") || html.includes('lp-cfg-ready')) {
    // Still ensure the add() call exists next to applyCfg
    if (html.includes("document.documentElement.classList.add('lp-cfg-ready')")) return html;
  }
  return html.replace(
    needle,
    "try{document.documentElement.classList.add('lp-cfg-ready');}catch(_r){}" + needle
  );
}

function injectSeoFormatHelper(html) {
  let out = String(html || '');
  if (out.includes('function __lpFormatSeoText')) return out;
  const src = clientSource();
  if (out.includes('function applyCfg(')) {
    return out.replace('function applyCfg(', src + '\nfunction applyCfg(');
  }
  if (out.includes('</head>')) {
    return out.replace('</head>', '<script>' + src + '</script>\n</head>');
  }
  return '<script>' + src + '</script>\n' + out;
}

function injectColorOverrideHelper(html) {
  let out = String(html || '');
  if (out.includes('function __lpApplyColorOverrides')) return out;
  const src = colorOverrideClientSource();
  if (out.includes('function applyCfg(')) {
    out = out.replace('function applyCfg(', src + '\nfunction applyCfg(');
  } else if (out.includes('</head>')) {
    out = out.replace('</head>', '<script>' + src + '</script>\n</head>');
  } else {
    out = '<script>' + src + '</script>\n' + out;
  }
  // Remap SITE_CONFIG before applyCfg so theme/section hex follow Branding overrides.
  if (out.includes('applyCfg(SITE_CONFIG)') && !out.includes('__lpApplyColorOverrides(SITE_CONFIG)')) {
    out = out.replace(
      'applyCfg(SITE_CONFIG)',
      "applyCfg((typeof __lpApplyColorOverrides==='function'?__lpApplyColorOverrides(SITE_CONFIG):SITE_CONFIG))"
    );
  }
  return out;
}

function paintSeoTextFromConfig(html, cfg) {
  const ST = (cfg && cfg.sections && cfg.sections.seoText) || {};
  if (!sectionIsOn(cfg, 'seoText')) return html;
  let out = String(html || '');
  const eyebrow = String(ST.eyebrow || '').trim();
  const h1 = String(ST.h1 || '').trim();
  const intro = String(ST.intro || '').trim();
  const h2 = String(ST.h2 || '').trim();
  const body = formatSeoTextHtml(ST.content || '');

  if (eyebrow) {
    out = out.replace(
      /(<[^>]*class="[^"]*seotxt-eyebrow[^"]*"[^>]*>)([\s\S]*?)(<\/[^>]+>)/i,
      function (_m, a, _old, c) {
        return a + esc(eyebrow) + c;
      }
    );
  }
  if (h1) {
    out = out.replace(
      /(<[^>]*class="[^"]*seotxt-h1[^"]*"[^>]*>)([\s\S]*?)(<\/[^>]+>)/i,
      function (_m, a, _old, c) {
        return a + esc(h1) + c;
      }
    );
  }
  if (intro) {
    out = out.replace(
      /(<[^>]*class="[^"]*seotxt-intro[^"]*"[^>]*>)([\s\S]*?)(<\/[^>]+>)/i,
      function (_m, a, _old, c) {
        return a + esc(intro) + c;
      }
    );
  }
  if (h2) {
    out = out.replace(
      /(<[^>]*class="[^"]*seotxt-h2[^"]*"[^>]*>)([\s\S]*?)(<\/[^>]+>)/i,
      function (_m, a, _old, c) {
        return a + esc(h2) + c;
      }
    );
  }
  if (body) {
    out = out.replace(
      /(<[^>]*class="[^"]*seotxt-content[^"]*"[^>]*>)([\s\S]*?)(<\/div>)/i,
      function (_m, a, _old, c) {
        return a + body + c;
      }
    );
  }
  return out;
}

/**
 * @param {string} html
 * @param {object} cfg — site.config (+ business/slug ok)
 * @returns {string}
 */
function prepareTradeLiveHtml(html, cfg) {
  let out = String(html || '');
  const c = cfg || {};

  out = injectFoucGuard(out);
  out = injectSectionOrderCss(out, c);
  out = injectCfgReadyHook(out);
  out = injectSeoFormatHelper(out);
  out = injectColorOverrideHelper(out);

  // Inactive / off-by-default apps must not paint (Services flash etc).
  out = hideInactiveSections(out, c);

  // Alternate hero is the active mount — never paint classic plumber hero first.
  if (altHeroOn(c)) {
    out = hideSec(out, 'hero');
  }

  // Emerg: paint from config, or hide when empty / stale plumbing leftover.
  out = paintEmergFromConfig(out, c);

  if (!altHeroOn(c) && sectionOn(c, 'hero') !== false) {
    out = paintHeroFromConfig(out, c);
  }

  out = paintSeoTextFromConfig(out, c);

  // If site config does not own plumbing residual phrases, scrub shell leftovers.
  if (!cfgOwnsResidual(c)) {
    out = scrubPlaceholders(out);
  }

  return out;
}

module.exports = {
  TRADE_RESIDUAL,
  cfgOwnsResidual,
  altHeroOn,
  stalePlumbingEmerg,
  prepareTradeLiveHtml,
  scrubPlaceholders,
  hideSec,
  hideInactiveSections,
  paintHeroFromConfig,
  paintEmergFromConfig,
  injectSectionOrderCss,
  paintSeoTextFromConfig
};
