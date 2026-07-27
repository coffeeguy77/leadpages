'use strict';

/**
 * Lead notification email style presets — defaults, merge, and DB resolution.
 */

const LOGO_ANIMATED =
  'https://www.leadpages.com.au/assets/apple-touch-icon-animated.gif';
const LOGO_WORDMARK =
  'https://res.cloudinary.com/dzx6x1hou/image/upload/v1782665886/leadpages-logo-white.png';

const STYLE_KEYS = [
  'pageBackground',
  'cardBackground',
  'cardBorder',
  'headerGradientStart',
  'headerGradientMid',
  'headerGradientEnd',
  'headerText',
  'headerLabel',
  'bodyText',
  'labelColor',
  'valueColor',
  'rowBorder',
  'buttonBackground',
  'buttonText',
  'buttonOutline',
  'linkColor',
  'footerBackground',
  'footerText',
  'footerBorder',
  'logoMarkWidth',
  'logoMarkHeight',
  'logoWordmarkHeight',
  'logoAnimated',
  'logoWordmark',
  'showLogo'
  ,'showAnimatedLogo'
  ,'showWordmarkLogo'
];

const DEFAULT_STYLE = {
  pageBackground: '#eef2f0',
  cardBackground: '#ffffff',
  cardBorder: '#d9e2dd',
  headerGradientStart: '#0f1f1a',
  headerGradientMid: '#1a3a30',
  headerGradientEnd: '#1f7a63',
  headerText: '#ffffff',
  headerLabel: 'rgba(255,255,255,0.72)',
  bodyText: '#5b6762',
  labelColor: '#6b7280',
  valueColor: '#14201c',
  rowBorder: '#e8ecef',
  buttonBackground: '#1f7a63',
  buttonText: '#ffffff',
  buttonOutline: '#1f7a63',
  linkColor: '#1f7a63',
  footerBackground: '#f6f8f7',
  footerText: '#8a9590',
  footerBorder: '#e5ebe8',
  logoMarkWidth: 56,
  logoMarkHeight: 56,
  logoWordmarkHeight: 34,
  logoAnimated: LOGO_ANIMATED,
  logoWordmark: LOGO_WORDMARK,
  showLogo: true,
  showAnimatedLogo: true,
  showWordmarkLogo: true
};

function cleanStr(s, n) {
  return (s == null ? '' : String(s)).trim().slice(0, n || 500);
}

function hexOk(v) {
  v = cleanStr(v, 32);
  if (/^#?[0-9a-fA-F]{3}$/.test(v)) {
    v = v.charAt(0) === '#' ? v : '#' + v;
    return (
      '#' +
      v.charAt(1) +
      v.charAt(1) +
      v.charAt(2) +
      v.charAt(2) +
      v.charAt(3) +
      v.charAt(3)
    ).toLowerCase();
  }
  if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
    return (v.charAt(0) === '#' ? v : '#' + v).toLowerCase();
  }
  if (/^rgba?\(/i.test(v) || /^[a-z]+$/i.test(v)) return v;
  return '';
}

function normalizeStyle(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = Object.assign({}, DEFAULT_STYLE);
  STYLE_KEYS.forEach(function (k) {
    if (src[k] == null || src[k] === '') return;
    if (k === 'showLogo' || k === 'showAnimatedLogo' || k === 'showWordmarkLogo') {
      out[k] = !!src[k];
      return;
    }
    if (k === 'logoMarkWidth' || k === 'logoMarkHeight' || k === 'logoWordmarkHeight') {
      const n = Number(src[k]);
      if (Number.isFinite(n) && n >= 16 && n <= 240) out[k] = Math.round(n);
      return;
    }
    if (k === 'logoAnimated' || k === 'logoWordmark') {
      const u = cleanStr(src[k], 500);
      if (u && /^https?:\/\//i.test(u)) out[k] = u;
      return;
    }
    if (k === 'headerLabel' && String(src[k]).indexOf('rgba') === 0) {
      out[k] = cleanStr(src[k], 80);
      return;
    }
    const hex = hexOk(src[k]);
    if (hex) out[k] = hex;
    else if (typeof src[k] === 'string') out[k] = cleanStr(src[k], 80);
  });
  return out;
}

function mergeStyle(base, patch) {
  return normalizeStyle(Object.assign({}, base || DEFAULT_STYLE, patch || {}));
}

/**
 * Resolve effective style for a site: active site preset → global default → code default.
 */
async function resolveLeadNotifyStyle(supabase, siteId) {
  let siteRow = null;
  let globalRow = null;

  if (siteId) {
    try {
      const r = await supabase
        .from('lead_notify_email_styles')
        .select('id,name,style,is_active')
        .eq('site_id', siteId)
        .eq('is_active', true)
        .maybeSingle();
      if (r.data && r.data.style) siteRow = r.data;
    } catch (e) {
      /* table may not exist yet */
    }
  }

  try {
    const g = await supabase
      .from('lead_notify_email_styles')
      .select('id,name,style,is_global_default')
      .is('site_id', null)
      .eq('is_global_default', true)
      .maybeSingle();
    if (g.data && g.data.style) globalRow = g.data;
  } catch (e) {
    /* ignore */
  }

  const style = normalizeStyle(
    Object.assign(
      {},
      DEFAULT_STYLE,
      globalRow && globalRow.style ? globalRow.style : null,
      siteRow && siteRow.style ? siteRow.style : null
    )
  );

  return {
    style,
    source: siteRow ? 'site' : globalRow ? 'global' : 'builtin',
    presetId: siteRow ? siteRow.id : globalRow ? globalRow.id : null,
    presetName: siteRow ? siteRow.name : globalRow ? globalRow.name : 'Built-in default'
  };
}

module.exports = {
  STYLE_KEYS,
  DEFAULT_STYLE,
  LOGO_ANIMATED,
  LOGO_WORDMARK,
  normalizeStyle,
  mergeStyle,
  resolveLeadNotifyStyle
};
