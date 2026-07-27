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
  // ~3× the original enquiry-email mark (44px) / wordmark (28px)
  logoMarkWidth: 132,
  logoMarkHeight: 132,
  logoWordmarkHeight: 84,
  logoAnimated: LOGO_ANIMATED,
  logoWordmark: LOGO_WORDMARK,
  showLogo: true,
  // GIF often freezes in mail clients and cannot be recoloured — off by default
  showAnimatedLogo: false,
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

function configStyleRow(siteConfig) {
  const cfg = siteConfig && typeof siteConfig === 'object' ? siteConfig : {};
  const ln = cfg.leadNotifyEmail;
  if (!ln || typeof ln !== 'object' || !ln.style || typeof ln.style !== 'object') return null;
  return {
    id: ln.activePresetId || null,
    name: ln.activePresetName || 'Site config',
    style: ln.style
  };
}

async function fetchActiveSitePreset(supabase, siteId) {
  const r = await supabase
    .from('lead_notify_email_styles')
    .select('id,name,style,is_active')
    .eq('site_id', siteId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (r.error) throw r.error;
  const row = r.data && r.data[0];
  return row && row.style ? row : null;
}

async function fetchGlobalDefaultPreset(supabase) {
  const g = await supabase
    .from('lead_notify_email_styles')
    .select('id,name,style,is_global_default')
    .is('site_id', null)
    .eq('is_global_default', true)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (g.error) throw g.error;
  const row = g.data && g.data[0];
  return row && row.style ? row : null;
}

/**
 * Resolve effective style for a site: active site preset → site config mirror → global default → code default.
 */
async function resolveLeadNotifyStyle(supabase, siteId, siteConfig) {
  let siteRow = null;
  let globalRow = null;
  let usedConfig = false;
  const configRow = configStyleRow(siteConfig);

  if (siteId) {
    try {
      siteRow = await fetchActiveSitePreset(supabase, siteId);
    } catch (e) {
      /* table may not exist yet */
    }
  }

  if (!siteRow && configRow) {
    siteRow = configRow;
    usedConfig = true;
  }

  try {
    globalRow = await fetchGlobalDefaultPreset(supabase);
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

  const source = siteRow
    ? usedConfig
      ? 'site_config'
      : 'site'
    : globalRow
      ? 'global'
      : 'builtin';

  return {
    style,
    source,
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
  configStyleRow,
  resolveLeadNotifyStyle
};
