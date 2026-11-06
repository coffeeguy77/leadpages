/**
 * Partner landing template dispatcher.
 */
const { normalizeTemplateKey, PARTNER_TEMPLATES } = require('./registry');
const { resolveLandingTheme } = require('./shared');
const { resolvePartnerThemeContent } = require('../partner-website/resolver');
const { extractLogoValue } = require('../partner-website/logo');
const webculture = require('./webculture');
const studio = require('./studio-family');

// 'localwebsiteco' keeps its id (partners already saved it) but now draws the orange
// Studio design. The previous Local Website Co. look stays in ./localwebsiteco.js.
const BUILDERS = {
  webculture: webculture.build,
  localwebsiteco: studio.builders.localwebsiteco,
  studioplus: studio.builders.studioplus,
  presence: studio.builders.presence
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
  const builder = BUILDERS[key] || BUILDERS.webculture;
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
  opts.themeContent.meta = opts.themeContent.meta || {};
  opts.themeContent.meta.templateKey = key;

  // The design switcher bar only shows on preview links (?tpl=…), never to normal visitors.
  // Culture keeps its own layout without the bar.
  const previewing = !!opts.templateOverride && opts.showTemplateSwitcher !== false;
  opts.templateSwitcher = previewing && key !== 'webculture';
  opts.showTemplateSwitcher = opts.templateSwitcher;
  return builder(profCopy, partner, demos, base, opts);
}

module.exports = {
  buildPartnerLandingHtml,
  resolveTemplateKey,
  resolveLandingTheme,
  BUILDERS,
  normalizeTemplateKey,
  PARTNER_TEMPLATES
};
