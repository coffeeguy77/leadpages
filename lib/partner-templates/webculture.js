/**
 * Web Culture — premium product-demo partner landing theme.
 */
const { buildContext, pageShell } = require('./shared');
const wc = require('./webculture-sections');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  const c = ctx.content;
  if (!c) throw new Error('themeContent required');

  const body = ''
    + wc.navBlock(c, ctx)
    + wc.heroSection(c, ctx)
    + wc.allSections(c, ctx)
    + wc.footerBlock(ctx, c);

  return pageShell(ctx, body, {
    templateId: 'webculture',
    css: '/assets/partner-templates/webculture.css',
    bodyClass: 'wc-body',
    themeContent: c,
    fonts: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    extraVars: {
      'pt-accent': '#bfea4b',
      'pt-brand': '#bfea4b',
      'pt-ink': '#183525',
      'pt-bg': '#f4ebdd',
      'pt-glow': '#b9d9c4'
    }
  });
}

module.exports = { build };
