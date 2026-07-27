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
  'logoTint',
  'logoTint2',
  'logoUseBrandLockup',
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
  // Tint1 / accent: circles + "more leads". Empty = white on brand lockup.
  logoTint: '#ffffff',
  // Tint2 / ink: "leadpages" + "smart sites". Empty falls back to logoTint / white.
  logoTint2: '#ffffff',
  // Dual-tint brand SVG lockup (recommended). Off = custom URL uploads only.
  logoUseBrandLockup: true,
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
    if (k === 'logoTint' || k === 'logoTint2') {
      if (!Object.prototype.hasOwnProperty.call(src, k)) return;
      if (src[k] == null || src[k] === '') {
        out[k] = '';
        return;
      }
      const tint = hexOk(src[k]);
      out[k] = tint && tint.charAt(0) === '#' ? tint : '';
      return;
    }
    if (src[k] == null || src[k] === '') return;
    if (
      k === 'showLogo' ||
      k === 'showAnimatedLogo' ||
      k === 'showWordmarkLogo' ||
      k === 'logoUseBrandLockup'
    ) {
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

function isCloudinaryImageUrl(url) {
  return /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(String(url || ''));
}

/**
 * Strip prior tint transforms so re-tinting does not stack e_colorize segments.
 */
function stripCloudinaryTint(url) {
  const raw = cleanStr(url, 800);
  const m = raw.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i);
  if (!m) return raw;
  const parts = m[2].split('/').filter(Boolean);
  const kept = parts.filter(function (p) {
    if (/^e_colorize/i.test(p)) return false;
    if (/^co_rgb:/i.test(p)) return false;
    if (/^e_replace_color/i.test(p)) return false;
    // Combined transform segment e.g. e_colorize:100,co_rgb:f472b6
    if (/,/.test(p) && /e_colorize|co_rgb:/i.test(p)) return false;
    return true;
  });
  return m[1] + kept.join('/');
}

/**
 * Apply a solid tint to a Cloudinary image URL (best on white/mono PNGs).
 * Non-Cloudinary URLs (and GIFs hosted elsewhere) are returned unchanged.
 */
function applyCloudinaryTint(url, tintHex) {
  const raw = cleanStr(url, 800);
  if (!raw || !isCloudinaryImageUrl(raw)) return raw;
  const tint = hexOk(tintHex);
  if (!tint || tint.charAt(0) !== '#') return stripCloudinaryTint(raw);
  const base = stripCloudinaryTint(raw);
  const m = base.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i);
  if (!m) return raw;
  return m[1] + 'e_colorize:100,co_rgb:' + tint.slice(1) + '/' + m[2];
}

/**
 * Return style with logo URLs rewritten for email/preview rendering.
 * Stored style keeps the untinted source URL + logoTint separately.
 */
function withTintedLogos(style) {
  const st = normalizeStyle(style || {});
  const out = Object.assign({}, st);
  if (st.logoTint) {
    out.logoWordmark = applyCloudinaryTint(st.logoWordmark, st.logoTint);
    out.logoAnimated = applyCloudinaryTint(st.logoAnimated, st.logoTint);
  } else {
    out.logoWordmark = stripCloudinaryTint(st.logoWordmark);
    // animated default is not Cloudinary — strip is a no-op
    out.logoAnimated = isCloudinaryImageUrl(st.logoAnimated)
      ? stripCloudinaryTint(st.logoAnimated)
      : st.logoAnimated;
  }
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
  isCloudinaryImageUrl,
  stripCloudinaryTint,
  applyCloudinaryTint,
  withTintedLogos,
  resolveLeadNotifyStyle
};
