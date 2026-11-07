/**
 * Partner landing template registry.
 */

const PARTNER_TEMPLATES = [
  {
    id: 'webculture',
    thumb: '/assets/partner-templates/studio/thumb-culture.webp',
    short: 'Culture',
    label: 'Culture',
    tagline: 'Premium product-demo partner sites',
    description: 'Large browser mockups, interactive demo gallery, lead-flow diagrams and minimal copy — built to show, not tell.',
    mood: 'Premium & visual',
    fonts: 'Playfair Display + Inter',
    preview: 'linear-gradient(160deg,#f4ebdd 0%,#bfea4b 45%,#183525 100%)'
  },
  {
    id: 'localwebsiteco',
    short: 'Studio',
    label: 'Studio (orange, portfolio)',
    tagline: 'Bold orange, portfolio-led',
    description: 'Big confident headline, example designs front and centre, a dark big-ideas band and a personal partner section. Best for showing work.',
    mood: 'Bold & visual',
    fonts: 'Plus Jakarta Sans',
    preview: 'linear-gradient(160deg,#f6f1ea 0%,#f2610c 55%,#141414 100%)',
    thumb: '/assets/partner-templates/studio/thumb-studio.webp'
  },
  {
    id: 'studioplus',
    short: 'Studio Plus',
    label: 'Studio Plus (orange, more content)',
    tagline: 'Orange, content-rich',
    description: 'Services with ticks, how it works, packages, FAQs and an enquiry form. Best for explaining the offer.',
    mood: 'Bold & informative',
    fonts: 'Plus Jakarta Sans',
    preview: 'linear-gradient(160deg,#fbf7f1 0%,#f2610c 50%,#161616 100%)',
    thumb: '/assets/partner-templates/studio/thumb-studioplus.webp'
  },
  {
    id: 'presence',
    short: 'Presence',
    label: 'Presence (navy & lime)',
    tagline: 'Navy and lime, modern',
    description: 'Deep navy hero with a lime accent, staggered example designs, numbered services and a lime call to action.',
    mood: 'Modern & confident',
    fonts: 'Plus Jakarta Sans',
    preview: 'linear-gradient(160deg,#0e1a3a 0%,#1d2e5c 50%,#d7f56b 100%)',
    thumb: '/assets/partner-templates/studio/thumb-presence.webp'
  },
  {
    id: 'plum',
    short: 'Plum',
    label: 'Plum (plum & blush, live demos)',
    tagline: 'Plum and blush, elegant',
    description: 'Elegant serif headlines on blush pink, a device mock-up hero, live demos by industry, a plum connected-business band, steps, FAQs and an enquiry form.',
    mood: 'Elegant & warm',
    fonts: 'Fraunces + Manrope',
    preview: 'linear-gradient(160deg,#fbeff1 0%,#d97a8c 55%,#4a1d33 100%)',
    thumb: '/assets/partner-templates/studio/thumb-plum.webp'
  },
  {
    id: 'forest',
    short: 'Forest',
    label: 'Forest (green & coral, image-led)',
    tagline: 'Forest green, image-led',
    description: 'Full-width photo hero, real LeadPages sites, a green brilliant-underneath band, a live-editing showcase, your local partner and an enquiry form.',
    mood: 'Calm & premium',
    fonts: 'Fraunces + Manrope',
    preview: 'linear-gradient(160deg,#f4f1ea 0%,#e9876b 45%,#1f3a2e 100%)',
    thumb: '/assets/partner-templates/studio/thumb-forest.webp'
  }
].concat(require('./niche-family').NICHES.map(function(n) {
  // Industry pages (Nov 2026): also usable as a partner's main design.
  return {
    id: n.id,
    short: n.short,
    label: n.short + ' (industry)',
    tagline: n.tagline,
    description: 'Built for ' + n.industry.toLowerCase() + ' prospects, with a live example experience to demo in a sales conversation.',
    mood: n.tagline,
    fonts: n.theme.font,
    preview: n.preview,
    thumb: '/assets/partner-templates/niche/thumb-' + n.img + '.webp',
    industry: true,
    industryName: n.industry
  };
}));

const TEMPLATE_IDS = PARTNER_TEMPLATES.map(function(t) { return t.id; });

function normalizeTemplateKey(key) {
  const k = String(key || 'webculture').trim().toLowerCase();
  // Legacy keys (converge, causehouse, signal, …) all map to Culture.
  return TEMPLATE_IDS.indexOf(k) >= 0 ? k : 'webculture';
}

function getTemplateMeta(id) {
  return PARTNER_TEMPLATES.find(function(t) { return t.id === id; }) || PARTNER_TEMPLATES[0];
}

module.exports = {
  PARTNER_TEMPLATES,
  TEMPLATE_IDS,
  normalizeTemplateKey,
  getTemplateMeta
};
