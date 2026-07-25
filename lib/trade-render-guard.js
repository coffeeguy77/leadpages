'use strict';

/**
 * Live trade shell guards — stop plumbing placeholder FOUC / residual copy
 * from painting unless that content is actually present in sites.config.
 *
 * Website Studio uses landing-shell-neutral + its own scrub; this module is
 * for api/render.js → trade.template.json (public + manage preview).
 */

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
  const s = cfg && cfg.sections && cfg.sections[key];
  if (!s) return false;
  return s.on === true || (s.on == null && key === 'emerg');
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
  if (!H || (H.on === false)) return html;
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
    // No configured emerg copy, or stale plumbing leftover → hide.
    return hideSec(html, 'emerg');
  }
  return String(html || '').replace(
    /(<div\b[^>]*\bdata-sec="emerg"[^>]*>)([\s\S]*?)(<a\b[^>]*id="emergCall"[^>]*>)/i,
    function (_m, a, _mid, link) {
      return a + esc(text) + ' ' + link;
    }
  );
}

function injectFoucGuard(html) {
  const css =
    '<style id="lp-fouc-guard">' +
    'html:not(.lp-cfg-ready) .emerg[data-sec="emerg"],' +
    'html:not(.lp-cfg-ready) section.hero[data-sec="hero"]{' +
    'visibility:hidden!important}' +
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
  if (html.includes('lp-cfg-ready')) return html;
  return html.replace(
    needle,
    "try{document.documentElement.classList.add('lp-cfg-ready');}catch(_r){}" + needle
  );
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
  out = injectCfgReadyHook(out);

  // Alternate hero is the active mount — never paint classic plumber hero first.
  if (altHeroOn(c)) {
    out = hideSec(out, 'hero');
  }

  // Emerg: paint from config, or hide when empty / stale plumbing leftover.
  out = paintEmergFromConfig(out, c);

  if (!altHeroOn(c) && sectionOn(c, 'hero') !== false) {
    out = paintHeroFromConfig(out, c);
  }

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
  paintHeroFromConfig,
  paintEmergFromConfig
};
