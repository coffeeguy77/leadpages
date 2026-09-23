'use strict';

/**
 * LeadPages responsive breakpoints (phones / tablets / desktop).
 *
 * Platform defaults live here. Sites without a custom override always
 * follow the latest platform version at render time. Customised sites
 * keep their values until the owner clicks Update or Restore.
 *
 * sites.config.breakpoints:
 *   {
 *     source: 'platform' | 'custom',
 *     version: number,                 // platform version last applied
 *     mobilePortraitMax: number,       // px, inclusive
 *     mobileLandscapeMax: number,
 *     tabletPortraitMax: number,
 *     tabletLandscapeMax: number,
 *     previous: null | { ...values }   // undo snapshot after Update
 *   }
 */

var LP_BREAKPOINT_DEFAULTS = {
  version: 1,
  mobilePortraitMax: 430,
  mobileLandscapeMax: 560,
  tabletPortraitMax: 768,
  tabletLandscapeMax: 900
};

function _num(v, fallback) {
  var n = parseInt(v, 10);
  if (!isFinite(n) || n < 320) return fallback;
  if (n > 4096) return 4096;
  return n;
}

function platformBreakpointDefaults() {
  return {
    version: LP_BREAKPOINT_DEFAULTS.version,
    mobilePortraitMax: LP_BREAKPOINT_DEFAULTS.mobilePortraitMax,
    mobileLandscapeMax: LP_BREAKPOINT_DEFAULTS.mobileLandscapeMax,
    tabletPortraitMax: LP_BREAKPOINT_DEFAULTS.tabletPortraitMax,
    tabletLandscapeMax: LP_BREAKPOINT_DEFAULTS.tabletLandscapeMax
  };
}

function normalizeBreakpointValues(raw, base) {
  base = base || platformBreakpointDefaults();
  var src = raw && typeof raw === 'object' ? raw : {};
  var mobileP = _num(src.mobilePortraitMax, base.mobilePortraitMax);
  var mobileL = _num(src.mobileLandscapeMax, base.mobileLandscapeMax);
  var tabletP = _num(src.tabletPortraitMax, base.tabletPortraitMax);
  var tabletL = _num(src.tabletLandscapeMax, base.tabletLandscapeMax);
  // Keep bands ordered: mobile portrait ≤ mobile landscape ≤ tablet portrait ≤ tablet landscape
  if (mobileL < mobileP) mobileL = mobileP;
  if (tabletP < mobileL) tabletP = mobileL;
  if (tabletL < tabletP) tabletL = tabletP;
  return {
    version: base.version,
    mobilePortraitMax: mobileP,
    mobileLandscapeMax: mobileL,
    tabletPortraitMax: tabletP,
    tabletLandscapeMax: tabletL,
    desktopMin: tabletL + 1
  };
}

/**
 * Resolve effective breakpoints for a site.
 * Custom sites keep their numbers; everyone else follows platform defaults.
 */
function resolveBreakpoints(cfg) {
  var platform = platformBreakpointDefaults();
  var bp = (cfg && cfg.breakpoints && typeof cfg.breakpoints === 'object') ? cfg.breakpoints : null;
  if (!bp || bp.source !== 'custom') {
    return Object.assign({ source: 'platform', previous: null }, normalizeBreakpointValues(null, platform));
  }
  var vals = normalizeBreakpointValues(bp, platform);
  return Object.assign({
    source: 'custom',
    previous: bp.previous && typeof bp.previous === 'object' ? bp.previous : null,
    storedVersion: bp.version != null ? bp.version : null
  }, vals);
}

function breakpointsOutdated(cfg) {
  var bp = cfg && cfg.breakpoints;
  if (!bp || bp.source !== 'custom') return false;
  var v = parseInt(bp.version, 10);
  return !isFinite(v) || v < LP_BREAKPOINT_DEFAULTS.version;
}

function breakpointsRootCss(bp) {
  bp = bp || resolveBreakpoints(null);
  return ':root{'
    + '--lp-bp-mobile-p:' + bp.mobilePortraitMax + 'px;'
    + '--lp-bp-mobile-l:' + bp.mobileLandscapeMax + 'px;'
    + '--lp-bp-tablet-p:' + bp.tabletPortraitMax + 'px;'
    + '--lp-bp-tablet-l:' + bp.tabletLandscapeMax + 'px;'
    + '--lp-bp-desktop-min:' + bp.desktopMin + 'px'
    + '}';
}

/** Concrete media queries — custom props are not reliable inside @media. */
function breakpointsHideCss(bp) {
  bp = bp || resolveBreakpoints(null);
  var m = bp.mobileLandscapeMax;
  var t = bp.tabletLandscapeMax;
  return '@media(max-width:' + m + 'px){.lp-hide-mobile{display:none!important}}'
    + '@media(min-width:' + (m + 1) + 'px) and (max-width:' + t + 'px){.lp-hide-tablet{display:none!important}}';
}

function breakpointsStyleTag(cfg) {
  var bp = resolveBreakpoints(cfg);
  return breakpointsRootCss(bp) + breakpointsHideCss(bp);
}

function snapshotBreakpointValues(bp) {
  bp = bp || platformBreakpointDefaults();
  return {
    mobilePortraitMax: bp.mobilePortraitMax,
    mobileLandscapeMax: bp.mobileLandscapeMax,
    tabletPortraitMax: bp.tabletPortraitMax,
    tabletLandscapeMax: bp.tabletLandscapeMax,
    version: bp.version != null ? bp.version : LP_BREAKPOINT_DEFAULTS.version
  };
}

module.exports = {
  LP_BREAKPOINT_DEFAULTS: LP_BREAKPOINT_DEFAULTS,
  platformBreakpointDefaults: platformBreakpointDefaults,
  normalizeBreakpointValues: normalizeBreakpointValues,
  resolveBreakpoints: resolveBreakpoints,
  breakpointsOutdated: breakpointsOutdated,
  breakpointsRootCss: breakpointsRootCss,
  breakpointsHideCss: breakpointsHideCss,
  breakpointsStyleTag: breakpointsStyleTag,
  snapshotBreakpointValues: snapshotBreakpointValues
};
