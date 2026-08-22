'use strict';

/** Resolve sites.config.maxSiteWidth → capped px or full bleed. */

var DEFAULT_MAX_SITE_WIDTH = 1920;

function normalizeMaxSiteWidth(raw) {
  var v = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!v) return String(DEFAULT_MAX_SITE_WIDTH);
  if (v === 'full' || v === 'none' || v === '100%') return 'full';
  var n = parseInt(v, 10);
  if (!isFinite(n) || n < 1) return String(DEFAULT_MAX_SITE_WIDTH);
  return String(n);
}

function resolveMaxSiteWidth(cfg) {
  var mode = normalizeMaxSiteWidth(cfg && cfg.maxSiteWidth);
  if (mode === 'full') {
    return { mode: 'full', px: null, cssClass: 'site-width-full' };
  }
  var px = parseInt(mode, 10);
  return {
    mode: 'capped',
    px: px,
    cssClass: 'site-width-capped' + (px <= 1440 ? ' site-max-1440' : '')
  };
}

function siteMaxWidthRootCss(cfg) {
  var r = resolveMaxSiteWidth(cfg);
  if (r.mode === 'full') return '';
  return ':root{--site-maxw:' + r.px + 'px;--maxw:' + r.px + 'px}';
}

module.exports = {
  DEFAULT_MAX_SITE_WIDTH,
  normalizeMaxSiteWidth,
  resolveMaxSiteWidth,
  siteMaxWidthRootCss
};
