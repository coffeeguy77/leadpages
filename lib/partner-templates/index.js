/**
 * Partner landing template dispatcher.
 */
const { normalizeTemplateKey, PARTNER_TEMPLATES } = require('./registry');
const { resolveLandingTheme } = require('./shared');
const { resolvePartnerThemeContent } = require('../partner-website/resolver');
const { extractLogoValue } = require('../partner-website/logo');
const webculture = require('./webculture');
const studio = require('./studio-family');
const editMode = require('./edit-mode');
// Public anon key (the same one every LeadPages page uses); access is enforced by RLS and the APIs.
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnemt1d2h1bGduZXdjYXppcnZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMDU5MDMsImV4cCI6MjEwNzc4MTkwM30._4cATBGiAbB9L4RMUBsvaXgaep74fmN8HKAWgWv0Cpg';
const { pickLibrary, ownCards, cleanLibraryConfig, MAX: LIBRARY_MAX } = require('../partner-website/showcase-library');

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

/**
 * "Built on LeadPages" gallery for this page (Nov 2026). opts.library = every library card
 * (newest first, fetched by the renderer). Studio designs show the partner's own sites first
 * and fill up to 9 with library sites; Culture keeps its own demo tabs and shows library sites
 * only. Returns { cards, title, sub, withOwn }.
 */
function resolveLibrary(prof, c, key, opts) {
  const wp = (prof.showcase_config && prof.showcase_config.websiteProfile) || {};
  const cfg = cleanLibraryConfig(wp.showcaseLibrary);
  const ownVisible = !(c.visibility && c.visibility.demos === false);
  const own = ownVisible ? ownCards(c.demos) : [];
  const withOwn = key !== 'webculture';
  const exclude = own.map(function(d) { return d.id; }).filter(Boolean);
  // Mix (Studio designs): theirs-first | ours-first | theirs | ours. Culture keeps its own demo
  // tabs, so there only "theirs" (no LeadPages sites) changes anything.
  const useOurs = cfg.mix !== 'theirs';
  const useTheirs = withOwn && cfg.mix !== 'ours';
  const theirs = useTheirs ? own.slice(0, LIBRARY_MAX) : [];
  const ours = useOurs ? pickLibrary(cfg, opts.library || [], {
    excludeIds: exclude,
    limit: LIBRARY_MAX - theirs.length,
    random: opts.libraryRandom
  }) : [];
  let cards = cfg.mix === 'ours-first' ? ours.concat(theirs) : theirs.concat(ours);
  cards = cards.slice(0, LIBRARY_MAX).map(function(d) {
    const scroll = cfg.scroll === 'all' ? true : (cfg.scroll === 'off' ? false : !!d.autoScroll);
    return Object.assign({}, d, { autoScroll: scroll });
  });
  return { cards: cards, title: cfg.title, sub: cfg.sub, withOwn: useTheirs, studio: withOwn, mode: cfg.mode };
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

  opts.themeContent.library = resolveLibrary(profCopy, opts.themeContent, key, opts);

  // The design switcher bar only shows on preview links (?tpl=…), never to normal visitors.
  // Culture keeps its own layout without the bar.
  const previewing = !!opts.templateOverride && opts.showTemplateSwitcher !== false && !opts.editMode;
  opts.templateSwitcher = previewing && key !== 'webculture';
  opts.showTemplateSwitcher = opts.templateSwitcher;
  opts.themeContent.editMode = !!opts.editMode;

  let html = builder(profCopy, partner, demos, base, opts);
  // Every section gets a stable key so partners can hide it (eye icon in the page editor).
  html = editMode.tagSections(html);
  const wp = (profCopy.showcase_config && profCopy.showcase_config.websiteProfile) || {};
  const hidden = (wp.designHidden && wp.designHidden[key]) || [];
  if (opts.editMode) {
    html = editMode.applyEditMarkers(html);
    html = html.replace(/<head([^>]*)>/i, '<head$1><meta name="robots" content="noindex,nofollow">');
    html = html.replace(/<\/body>/i, editorAssets(profCopy, partner, key, hidden) + '</body>');
  } else {
    html = editMode.stripMarkers(html);
    if (hidden.length) html = html.replace(/<\/head>/i, editMode.hiddenSectionsCss(hidden) + '</head>');
  }
  return html;
}

/** The click-and-edit toolbar and script, only on ?edit=1 (the editor checks sign-in itself). */
function editorAssets(prof, partner, key, hidden) {
  const boot = {
    partnerId: (partner && partner.id) || prof.partner_id || '',
    template: key,
    slug: prof.showcase_slug || '',
    hidden: hidden,
    designs: PARTNER_TEMPLATES.map(function(t) { return { id: t.id, label: t.short || t.label || t.id }; }),
    textEditing: key !== 'webculture'
  };
  const json = JSON.stringify(boot).replace(/</g, '\\u003c');
  return '<link rel="stylesheet" href="/assets/lp-page-editor.css?v=1">'
    + '<script>window.__LP=window.__LP||{url:"https://fgzkuwhulgnewcazirvy.supabase.co",anon:"' + ANON + '"};window.__LPE=' + json + ';</script>'
    + '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>'
    + '<script src="/assets/lp-page-editor.js?v=1" defer></script>';
}

module.exports = {
  buildPartnerLandingHtml,
  resolveLibrary,
  resolveTemplateKey,
  resolveLandingTheme,
  BUILDERS,
  normalizeTemplateKey,
  PARTNER_TEMPLATES
};
