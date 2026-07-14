/**
 * Partner landing template registry — Culture only.
 */

const PARTNER_TEMPLATES = [
  {
    id: 'webculture',
    short: 'Culture',
    label: 'Culture',
    tagline: 'Premium product-demo partner sites',
    description: 'Large browser mockups, interactive demo gallery, lead-flow diagrams and minimal copy — built to show, not tell.',
    mood: 'Premium & visual',
    fonts: 'Playfair Display + Inter',
    preview: 'linear-gradient(160deg,#f4ebdd 0%,#bfea4b 45%,#183525 100%)'
  }
];

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
