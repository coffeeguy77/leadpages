/**
 * Local Website Co. — warm local partner microsite theme.
 */
const { buildContext, pageShell } = require('./shared');
const lwc = require('./localwebsiteco-sections');

function build(prof, partner, demos, base, opts) {
  const ctx = buildContext(prof, partner, demos, base, opts);
  const c = ctx.content;
  if (!c) throw new Error('themeContent required');

  const body = ''
    + lwc.navBlock(c, ctx)
    + lwc.poweredBar(c)
    + lwc.heroSection(c, ctx)
    + lwc.allSections(c, ctx)
    + lwc.footerBlock(ctx, c)
    + lwc.stickyCtaBlock(c);

  return pageShell(ctx, body, {
    templateId: 'localwebsiteco',
    css: '/assets/partner-templates/localwebsiteco.css',
    bodyClass: 'lwc-body',
    themeContent: c,
    fonts: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700;800&display=swap',
    templateSwitcher: opts && opts.showTemplateSwitcher === true,
    extraVars: {
      'pt-accent': '#f36a2e',
      'pt-brand': '#062543',
      'pt-ink': '#10263a',
      'pt-bg': '#fffaf3',
      'pt-glow': '#ee5b20'
    }
  });
}

module.exports = { build };
