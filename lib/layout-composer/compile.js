'use strict';

/**
 * Compile a Layout Composer blueprint into a sites.config skeleton.
 * Does not invent marketing copy — only structure, toggles, and order.
 * Always runs section-order law (Trust Bar pin).
 */

const {
  normalizeSectionOrder,
  pinTrustBarUnderHero,
  resolveSectionOrder,
} = require('../section-order');

function deepClone(v) {
  return JSON.parse(JSON.stringify(v == null ? {} : v));
}

/**
 * @param {object} blueprint Layout Composer blueprint DTO
 * @param {object} [opts]
 * @param {object} [opts.baseConfig] existing site config to merge into
 * @param {object} [opts.identity] { name, phone, email, location, trade }
 * @returns {{ config: object, sectionOrder: string[], enabledKeys: string[], warnings: string[] }}
 */
function compileBlueprintToConfig(blueprint, opts) {
  opts = opts || {};
  const warnings = [];
  const cfg = deepClone(opts.baseConfig || {});
  cfg.sections = cfg.sections && typeof cfg.sections === 'object' ? cfg.sections : {};

  const home =
    (blueprint &&
      Array.isArray(blueprint.pages) &&
      blueprint.pages.find(function (p) { return p.id === 'home' || p.path === '/'; })) ||
    (blueprint && blueprint.pages && blueprint.pages[0]) ||
    null;

  const sections = (home && Array.isArray(home.sections) ? home.sections : []).slice();
  if (!sections.length) warnings.push('Blueprint has no homepage sections.');

  let order = sections.map(function (s) { return s && s.key; }).filter(Boolean);
  order = normalizeSectionOrder(order);
  order = pinTrustBarUnderHero(order);

  const enabled = {};
  sections.forEach(function (s) {
    if (!s || !s.key) return;
    enabled[s.key] = s.enabled !== false;
  });
  // Trust bar stays available after pin
  if (enabled.trustBar == null) enabled.trustBar = true;

  order.forEach(function (key) {
    if (!cfg.sections[key] || typeof cfg.sections[key] !== 'object') {
      cfg.sections[key] = {};
    }
    cfg.sections[key].on = enabled[key] !== false;
  });

  // Turn off known sections not in blueprint order when compiling fresh
  Object.keys(cfg.sections).forEach(function (key) {
    if (order.indexOf(key) < 0 && cfg.sections[key] && typeof cfg.sections[key] === 'object') {
      if (opts.disableMissing !== false && !opts.baseConfig) {
        cfg.sections[key].on = false;
      }
    }
  });

  cfg.sectionOrder = order.slice();
  const resolved = resolveSectionOrder(cfg, order);
  cfg.sectionOrder = resolved;

  const identity = opts.identity || {};
  if (identity.name) {
    cfg.name = identity.name;
    cfg.businessName = identity.name;
  }
  if (identity.phone) cfg.phone = identity.phone;
  if (identity.email) cfg.email = identity.email;
  if (identity.trade) cfg.trade = identity.trade;
  if (identity.location) {
    cfg.region = cfg.region || identity.location;
    cfg.sections.seoTokens = Object.assign({}, cfg.sections.seoTokens || {}, {
      location: identity.location,
      city: identity.location,
      suburb: identity.location,
      region: identity.location,
      trade: identity.trade || cfg.trade || '',
    });
  }

  if (blueprint && blueprint.slug) {
    cfg._layoutComposer = {
      blueprintSlug: blueprint.slug,
      blueprintName: blueprint.name || '',
      kind: blueprint.kind || 'user_design',
      source: blueprint.source || null,
      confirmedAt: opts.confirmedAt || null,
    };
  }

  return {
    config: cfg,
    sectionOrder: cfg.sectionOrder.slice(),
    enabledKeys: order.filter(function (k) { return enabled[k] !== false; }),
    warnings: warnings,
  };
}

/**
 * Validate that a generation payload did not add/remove/reorder sections.
 */
function assertStructureUnchanged(confirmedBlueprint, proposedBlueprint) {
  const a = ((confirmedBlueprint.pages || [])[0] || {}).sections || [];
  const b = ((proposedBlueprint.pages || [])[0] || {}).sections || [];
  const ak = a.map(function (s) { return s.key + ':' + (s.enabled !== false ? 1 : 0); }).join('|');
  const bk = b.map(function (s) { return s.key + ':' + (s.enabled !== false ? 1 : 0); }).join('|');
  if (ak !== bk) {
    const err = new Error('AI must not change confirmed layout structure.');
    err.code = 'STRUCTURE_CHANGED';
    throw err;
  }
  return true;
}

module.exports = {
  compileBlueprintToConfig,
  assertStructureUnchanged,
};
