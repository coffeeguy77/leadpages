/**
 * Resolve partner agency logo URLs from showcase config, home site, or profile.
 */

function extractLogoValue(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '[object Object]') return null;
    return trimmed;
  }
  if (typeof value === 'object') {
    if (value.imageUrl) {
      const trimmed = String(value.imageUrl).trim();
      return trimmed || null;
    }
    if (value.url) {
      const trimmed = String(value.url).trim();
      return trimmed || null;
    }
  }
  return null;
}

function isUsableLogoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const t = url.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^\/\//.test(t)) return true;
  if (t.charAt(0) === '/') return true;
  if (/^data:image\//i.test(t)) return true;
  return false;
}

function resolvePartnerLogo(input) {
  input = input || {};
  const cfg = input.showcaseConfig || input.cfg || {};
  const home = input.home || null;
  const identity = input.identity || null;

  const candidates = [
    extractLogoValue(cfg.logo),
    extractLogoValue((cfg.websiteProfile && cfg.websiteProfile.identity) && cfg.websiteProfile.identity.logoUrl),
    extractLogoValue(identity && identity.logoUrl)
  ];
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i] && isUsableLogoUrl(candidates[i])) return candidates[i];
  }
  return null;
}

function normalizeLogoForStorage(value) {
  const url = extractLogoValue(value);
  return url && isUsableLogoUrl(url) ? url : null;
}

function partnerLogoDisplayUrl(url, maxWidth) {
  const raw = extractLogoValue(url);
  if (!raw || !isUsableLogoUrl(raw)) return raw || '';
  const w = Math.min(900, Math.max(120, Math.round(Number(maxWidth) || 320)));
  if (!/^https?:\/\/res\.cloudinary\.com\//i.test(raw)) return raw;
  if (/\/image\/upload\/[^/]*\bw_\d+/i.test(raw)) return raw;
  return raw.replace('/image/upload/', '/image/upload/w_' + w + ',q_auto,f_auto,c_limit/');
}

module.exports = {
  extractLogoValue,
  isUsableLogoUrl,
  resolvePartnerLogo,
  normalizeLogoForStorage,
  partnerLogoDisplayUrl
};
