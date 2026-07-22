'use strict';

/**
 * Build a sharp Cloudinary delivery URL for logos shown at small CSS sizes.
 * Browsers look soft when shrinking a 2000px original to ~44px; Cloudinary
 * should resize first (with q_auto:best).
 */

function logoDisplayUrl(url, cssHeightPx, opts) {
  opts = opts || {};
  var raw = String(url || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\/res\.cloudinary\.com\//i.test(raw)) return raw;
  // Already transformed — leave alone
  if (/\/image\/upload\/[^/]*\b(?:h_|w_)\d+/i.test(raw)) return raw;

  var cssH = Number(cssHeightPx);
  if (!isFinite(cssH) || cssH <= 0) cssH = 44;
  var dpr = Number(opts.dpr);
  if (!isFinite(dpr) || dpr < 1) dpr = 2;
  // Extra headroom (~1.5) so mild CSS shrink stays crisp on retina
  var px = Math.round(cssH * dpr * 1.5);
  px = Math.min(640, Math.max(64, px));

  var transform = 'h_' + px + ',q_auto:best,f_auto,c_limit';
  return raw.replace('/image/upload/', '/image/upload/' + transform + '/');
}

module.exports = { logoDisplayUrl };
