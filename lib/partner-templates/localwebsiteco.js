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
    fonts: 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&family=Young+Serif&display=swap',
    templateSwitcher: opts && opts.showTemplateSwitcher === true,
    extraVars: {
      'pt-accent': '#F06428',
      'pt-brand': '#1D2B4D',
      'pt-ink': '#001529',
      'pt-bg': '#f9f7f2',
      'pt-glow': '#e36b21'
    }
  });
}

module.exports = { build };
