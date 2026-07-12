/**
 * Resolve partner agency logo URLs from showcase config, home site, or profile.
 */

function extractLogoValue(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
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

  const fromShowcase = extractLogoValue(cfg.logo);
  if (fromShowcase) return fromShowcase;

  const wp = cfg.websiteProfile || {};
  const fromProfile = extractLogoValue(wp.identity && wp.identity.logoUrl);
  if (fromProfile) return fromProfile;

  const fromIdentity = extractLogoValue(identity && identity.logoUrl);
  if (fromIdentity) return fromIdentity;

  if (home && home.config) {
    const hc = home.config;
    const fromHome = extractLogoValue(hc.logo);
    if (fromHome) return fromHome;
  }

  return null;
}

module.exports = {
  extractLogoValue,
  isUsableLogoUrl,
  resolvePartnerLogo
};
