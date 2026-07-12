/**
 * Partner landing template dispatcher.
 */
const { normalizeTemplateKey } = require('./registry');
const { buildContext, resolveLandingTheme } = require('./shared');
const { resolvePartnerThemeContent } = require('../partner-website/resolver');
const { extractLogoValue } = require('../partner-website/logo');
const { buildPartnerLandingHtml: buildConverge } = require('../partner-landing');
const causehouse = require('./causehouse');
const webculture = require('./webculture');
const signal = require('./signal');
const atlas = require('./atlas');
const horizon = require('./horizon');
const pulse = require('./pulse');
const vault = require('./vault');

const BUILDERS = {
  converge: buildConverge,
  causehouse: causehouse.build,
  webculture: webculture.build,
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

  const normalizedLogo = extractLogoValue(profCopy.showcase_config.logo);
  if (normalizedLogo) {
    profCopy.showcase_config.logo = normalizedLogo;
  } else if (profCopy.showcase_config.logo) {
    delete profCopy.showcase_config.logo;
  }

  if (!opts.themeContent) {
    opts.themeContent = resolvePartnerThemeContent({
      prof: profCopy,
      partner: partner,
      directory: opts.directory || null,
      demos: demos,
      base: base,
      home: opts.home || null
    });
  }
  const pal = resolveLandingTheme(profCopy.showcase_config || {});
  opts.themeContent.pal = pal;

  let html = builder(profCopy, partner, demos, base, opts);
  if (opts.showTemplateSwitcher !== false && html.indexOf('pt-tpl-bar') < 0) {
    const { templateSwitcherBar } = require('./shared');
    const ctx = buildContext(profCopy, partner, demos, base, Object.assign({}, opts, { themeContent: opts.themeContent }));
    ctx.templateKey = key;
    const bar = templateSwitcherBar(ctx);
    html = html.replace(/<body([^>]*)>/, '<body$1>' + bar);
  }
  return html;
}

module.exports = {
  buildPartnerLandingHtml,
  resolveTemplateKey,
  resolveLandingTheme,
  BUILDERS,
  normalizeTemplateKey,
  PARTNER_TEMPLATES: require('./registry').PARTNER_TEMPLATES
};
