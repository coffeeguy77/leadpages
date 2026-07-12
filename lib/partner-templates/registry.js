/**
 * Partner landing template registry.
 */

const PARTNER_TEMPLATES = [
  {
    id: 'converge',
    short: 'Converge',
    label: 'Converge Studio',
    tagline: 'Dark conversion-focused agency',
    description: 'Purple glow, urgency banners, pricing tiers — built to close leads fast.',
    mood: 'Bold & conversion',
    fonts: 'Inter',
    preview: 'linear-gradient(135deg,#1a0a2e 0%,#7b2fff 100%)'
  },
  {
    id: 'causehouse',
    short: 'House',
    label: 'Cause House',
    tagline: 'Big type, warm mission energy',
    description: 'Oversized serif headlines, clever word art, and editorial navigation — inspired by premium nonprofit agencies.',
    mood: 'Editorial & warm',
    fonts: 'Fraunces + DM Sans',
    preview: 'linear-gradient(160deg,#faf8f4 0%,#e8dfd0 100%)'
  },
  {
    id: 'webculture',
    short: 'Culture',
    label: 'Web Culture',
    tagline: 'Premium product-demo partner sites',
    description: 'Large browser mockups, interactive demo gallery, lead-flow diagrams and minimal copy — built to show, not tell.',
    mood: 'Premium & visual',
    fonts: 'Fraunces + Inter',
    preview: 'linear-gradient(160deg,#f4ebdd 0%,#bfea4b 45%,#183525 100%)'
  },
  {
    id: 'signal',
    short: 'Signal',
    label: 'Signal Brutalist',
    tagline: 'Raw, loud, impossible to ignore',
    description: 'Black and white brutalism with screaming typography and grid lines — for partners who want edge.',
    mood: 'Brutalist',
    fonts: 'Space Grotesk + IBM Plex Mono',
    preview: 'repeating-linear-gradient(90deg,#000 0,#000 50%,#fff 50%,#fff 100%)'
  },
  {
    id: 'atlas',
    short: 'Atlas',
    label: 'Atlas Editorial',
    tagline: 'Magazine layout, asymmetric drama',
    description: 'Split columns, pull quotes, and photo-forward demo cards — like a design annual.',
    mood: 'Editorial magazine',
    fonts: 'Playfair Display + Source Sans 3',
    preview: 'linear-gradient(180deg,#1c1917 0%,#44403c 50%,#fafaf9 50%)'
  },
  {
    id: 'horizon',
    short: 'Horizon',
    label: 'Horizon Glass',
    tagline: 'Airy, luminous, future-forward',
    description: 'Soft gradients, glass panels, and floating cards — calm confidence for premium local studios.',
    mood: 'Light & glass',
    fonts: 'Outfit + Sora',
    preview: 'linear-gradient(135deg,#e0f2fe 0%,#c7d2fe 50%,#ddd6fe 100%)'
  },
  {
    id: 'pulse',
    short: 'Pulse',
    label: 'Pulse Neon',
    tagline: 'Electric dark-mode agency',
    description: 'Neon accents, scan lines, and cyber glow — for partners selling cutting-edge digital.',
    mood: 'Neon cyber',
    fonts: 'Syne + JetBrains Mono',
    preview: 'linear-gradient(135deg,#0a0a0f 0%,#00f0ff 40%,#ff00aa 100%)'
  },
  {
    id: 'vault',
    short: 'Vault',
    label: 'Vault Craft',
    tagline: 'Warm craft, trusted hands',
    description: 'Terracotta tones, organic shapes, and artisan typography — local agency with soul.',
    mood: 'Warm craft',
    fonts: 'Libre Baskerville + Nunito',
    preview: 'linear-gradient(160deg,#fef3e2 0%,#d97706 100%)'
  }
];

const TEMPLATE_IDS = PARTNER_TEMPLATES.map(function(t) { return t.id; });

function normalizeTemplateKey(key) {
  const k = String(key || 'converge').trim().toLowerCase();
  return TEMPLATE_IDS.indexOf(k) >= 0 ? k : 'converge';
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
