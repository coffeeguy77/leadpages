/**
 * Cause House — editorial partner landing matching causehouse.co feel.
 */
const { buildContext, pageShell } = require('./shared');
const ch = require('./causehouse-sections');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  const c = ctx.content;
  if (!c) throw new Error('themeContent required');

  const body = ''
    + ch.navBlock(c, ctx)
    + ch.heroSection(c)
    + ch.allSections(c)
    + ch.footerBlock(ctx, c);

  return pageShell(ctx, body, {
    templateId: 'causehouse',
    css: '/assets/partner-templates/causehouse.css',
    bodyClass: 'ch-body',
    themeContent: c,
    fonts: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700&display=swap',
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
