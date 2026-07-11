/**
 * Partner landing template dispatcher.
 */
const { normalizeTemplateKey } = require('./registry');
const { buildContext } = require('./shared');
const { buildPartnerLandingHtml: buildConverge } = require('../partner-landing');
const causehouse = require('./causehouse');
const signal = require('./signal');
const atlas = require('./atlas');
const horizon = require('./horizon');
const pulse = require('./pulse');
const vault = require('./vault');

const BUILDERS = {
  converge: buildConverge,
  causehouse: causehouse.build,
  signal: signal.build,
  atlas: atlas.build,
  horizon: horizon.build,
  pulse: pulse.build,
  vault: vault.build
};

function resolveTemplateKey(prof, opts) {
  if (opts && opts.templateOverride) {
    return normalizeTemplateKey(opts.templateOverride);
  }
  const cfg = (prof && prof.showcase_config) || {};
  return normalizeTemplateKey(cfg.templateKey);
}

function buildPartnerLandingHtml(prof, partner, demos, base, opts) {
  opts = opts || {};
  const key = resolveTemplateKey(prof, opts);
  const builder = BUILDERS[key] || BUILDERS.converge;
  const profCopy = prof ? JSON.parse(JSON.stringify(prof)) : {};
  if (!profCopy.showcase_config) profCopy.showcase_config = {};
  profCopy.showcase_config.templateKey = key;
  let html = builder(profCopy, partner, demos, base, opts);
  if (opts.showTemplateSwitcher !== false && html.indexOf('pt-tpl-bar') < 0) {
    const { templateSwitcherBar, buildContext } = require('./shared');
    const ctx = buildContext(profCopy, partner, demos, base, opts);
    ctx.templateKey = key;
    const bar = templateSwitcherBar(ctx);
    html = html.replace(/<body([^>]*)>/, '<body$1>' + bar);
  }
  return html;
}

const { resolveLandingTheme } = require('./shared');

module.exports = {
  buildPartnerLandingHtml,
  resolveTemplateKey,
  resolveLandingTheme,
  BUILDERS,
  normalizeTemplateKey,
  PARTNER_TEMPLATES: require('./registry').PARTNER_TEMPLATES
};
