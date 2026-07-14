/**
 * Web Culture — premium product-demo partner landing theme.
 */
const { buildContext, pageShell } = require('./shared');
const tokens = require('../partner-website/webculture-design-tokens');
const { resolveCulturePalette } = require('../partner-website/webculture-color-presets');
const wc = require('./webculture-sections');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  const c = ctx.content;
  if (!c) throw new Error('themeContent required');

  const cfg = (prof && prof.showcase_config) || {};
  const palette = resolveCulturePalette(cfg);

  const body = ''
    + wc.navBlock(c, ctx)
    + wc.heroSection(c, ctx)
    + wc.allSections(c, ctx)
    + wc.footerBlock(ctx, c)
    + wc.stickyCtaBlock(c)
    + wc.colourLabBlock(palette);

  return pageShell(ctx, body, {
    templateId: 'webculture',
    css: '/assets/partner-templates/webculture.css',
    bodyClass: 'wc-body',
    themeContent: c,
    fonts: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap',
    templateSwitcher: false,
    extraVars: {
      'pt-accent': palette.primary,
      'pt-brand': palette.primary,
      'pt-ink': palette.ink,
      'pt-bg': palette.bg,
      'pt-glow': palette.glow,
      'wc-set-primary': palette.primary,
      'wc-set-ink': palette.ink,
      'wc-set-bg': palette.bg,
      'wc-set-beige': palette.surface,
      'wc-set-muted': palette.muted || tokens.muted,
      'wc-set-glow': palette.glow
    }
  });
}

module.exports = { build };
