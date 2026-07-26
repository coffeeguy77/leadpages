/**
 * Resolve public marketplace feature pages from DB + static sell-templates.
 * Marketing hub slugs (home.html / SEO) often lack playground blocks in Supabase —
 * this fills them from sell-templates so demos always mount.
 */
const md = require('./marketplace-data');

function kebab(sectionKey) {
  return String(sectionKey || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function camelFromSlug(slug) {
  return String(slug || '')
    .split('-')
    .map(function (part, i) {
      if (!i) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

/** Public marketing URLs → real section / sell-template keys */
const MARKETING_ALIASES = {
  'quote-lead-capture': {
    premiumShowcase: true,
    name: 'Quote & Lead Capture',
    tagline: 'Enquiries that never get lost',
    summary: 'A guided, verified quote flow — like the Bean Culture example below. Premium setup with the LeadPages team; not a self-serve playground.',
    badge: 'Premium',
    hero_image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1400&h=560&fit=crop&q=80',
    showcaseDemoUrl: '/marketplace/demos/demo-beanCultureQuote.html',
    explainer: [
      { title: 'What you see', text: 'A finished Bean Culture coffee-cart quote — the end result customers walk through. Browse the steps; nothing here submits, verifies, texts or bills.' },
      { title: 'Premium setup', text: 'Quote & Lead Capture is configured with the LeadPages team for your products, travel zones, verification and branding. Partners do not self-edit this on the marketplace.' },
      { title: 'Lead inbox', text: 'Verified enquiries land where your client will see them — quote totals unlock only after email (and SMS when configured).' },
      { title: 'Safety', text: 'This marketplace page is a showcase only. No OTP, SMS, PDF or spendable quote session is created from here.' }
    ],
    cta: {
      heading: 'Set up with LeadPages',
      text: 'We’ll configure products, pricing rules, verification and branding for your site — then hand you a live quote flow.',
      button_label: 'Talk to LeadPages',
      button_url: '/partners'
    }
  },
  'reviews-trust': { sectionKey: 'reviews', name: 'Reviews & Trust', tagline: 'Look established from day one', summary: 'Testimonials, badges and certifications laid out to make small businesses look credible and safe to hire.' },
  promotions: { sectionKey: 'promotions', name: 'Promotions & Offers', tagline: 'Seasonal offers, front and centre', summary: 'Urgency offers with types, placements and styles — weekly windows, deadlines, limited spots, finance, suburb specials and more.' },
  /* DB / marketing slug — demo file is demo-promotions.html (section config under sections.promotions) */
  'promotions-hero': {
    sectionKey: 'promotions',
    name: 'Promotions Hero',
    tagline: 'Full-width promotional hero band',
    summary: 'Put urgency offers under the hero — weekly windows, deadlines, limited spots and more. Same Promotions Engine as the App Command Centre.',
    hero_image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1400&h=560&fit=crop&q=80'
  },
  /* Top emergency bar — section key emerg; demo-emerg.html */
  'emergency-cta': {
    sectionKey: 'emerg',
    name: 'Emergency CTA',
    tagline: '24/7 urgent call-to-action bar',
    summary: 'A sticky top bar that puts your emergency phone line front and centre — message, colours and call link match the App Command Centre Top bar.',
    hero_image_url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1400&h=560&fit=crop&q=80'
  },
  'email-campaigns': {
    sectionKey: null,
    platform: true,
    name: 'Email Campaigns',
    tagline: 'Stay in touch, win repeat work',
    summary: 'Send offers and updates to captured leads from the same dashboard — no third-party email tools.',
    hero_image_url: 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=1400&h=560&fit=crop&q=80',
    showcaseDemoUrl: '/marketplace/demos/demo-emailCampaigns.html',
    demoHeight: 920,
    cta: {
      heading: 'Open it in your dashboard',
      text: 'Email campaigns live under Email clients for each site — same compose flow as the demo, with your real leads.',
      button_label: 'Become a partner',
      button_url: '/partners'
    }
  }
};

function sellFor(sectionKey) {
  return (md.sellTemplates && md.sellTemplates[sectionKey]) || null;
}

function contentFor(sectionKey) {
  return (md.appContent && md.appContent[sectionKey]) || null;
}

function hasPlayground(blocks) {
  return (blocks || []).some(function (b) { return b && b.block_type === 'playground'; });
}

function ensurePlayground(blocks, sectionKey) {
  const list = Array.isArray(blocks) ? blocks.slice() : [];
  if (!sectionKey) return list;
  const PROMO_PRESETS = ['weekly', 'deadline', 'spots', 'seasonal', 'suburb', 'finance', 'firstTime', 'priority', 'socialProof', 'mystery'];
  if (hasPlayground(list)) {
    return list.map(function (b) {
      if (b.block_type !== 'playground') return b;
      const payload = Object.assign({}, b.payload || {});
      payload.section_key = sectionKey;
      const cur = Array.isArray(payload.presets) ? payload.presets : [];
      const thin = !cur.length || (cur.length === 1 && cur[0] === 'default');
      if (sectionKey === 'promotions' && thin) payload.presets = PROMO_PRESETS.slice();
      else if (!cur.length) payload.presets = ['default'];
      return Object.assign({}, b, { payload: payload });
    });
  }
  list.push({
    block_type: 'playground',
    sort_order: 900,
    payload: { section_key: sectionKey, presets: ['default'] }
  });
  return list;
}

function blocksFromSell(sectionKey) {
  const sell = sellFor(sectionKey);
  if (!sell || !Array.isArray(sell.blocks)) return [];
  return sell.blocks.map(function (b, i) {
    return {
      id: 'static-' + sectionKey + '-' + i,
      sort_order: (i + 1) * 10,
      block_type: b.block_type,
      payload: Object.assign({}, b.payload || {})
    };
  });
}

function featureFromSell(sectionKey, slug, alias) {
  const sell = sellFor(sectionKey) || {};
  const content = contentFor(sectionKey) || {};
  return {
    id: 'static-' + (slug || kebab(sectionKey)),
    slug: slug || kebab(sectionKey),
    name: (alias && alias.name) || sell.name || content.name || sectionKey,
    tagline: (alias && alias.tagline) || sell.tagline || content.tagline || '',
    summary: (alias && alias.summary) || sell.summary || content.summary || '',
    hero_image_url: sell.hero_image_url || null,
    demo_url: null,
    badge: (alias && alias.badge) || sell.badge || null,
    category_id: null,
    status: 'live',
    section_key: sectionKey,
    _source: 'sell-templates'
  };
}

function platformFeature(slug, alias) {
  const cta = alias.cta || {};
  /* Demo + CTA only — no How it works / benefits cards above the iframe. */
  const blocks = [];
  if (alias.showcaseDemoUrl) {
    blocks.push({
      id: 'plat-' + slug + '-demo',
      sort_order: 10,
      block_type: 'demo_embed',
      payload: {
        url: alias.showcaseDemoUrl,
        height: alias.demoHeight || 900,
        caption: 'Interactive demo — nothing is sent'
      }
    });
  }
  blocks.push({
    id: 'plat-' + slug + '-cta',
    sort_order: 20,
    block_type: 'cta',
    payload: {
      heading: cta.heading || 'Open it in your dashboard',
      text: cta.text || 'Email campaigns live under Email clients for each site — not as a page section demo.',
      button_label: cta.button_label || 'Go to partners',
      button_url: cta.button_url || '/partners'
    }
  });
  return {
    feature: {
      id: 'static-' + slug,
      slug: slug,
      name: alias.name,
      tagline: alias.tagline || '',
      summary: alias.summary || '',
      hero_image_url: alias.hero_image_url || null,
      demo_url: alias.showcaseDemoUrl || null,
      badge: alias.badge || null,
      category_id: null,
      status: 'live',
      section_key: null,
      _source: 'platform-explainer'
    },
    blocks: blocks
  };
}

/** Premium apps: still hero image + finished example embed — no playground editor. */
function premiumShowcaseFeature(slug, alias) {
  const points = alias.explainer || [];
  const flatItems = points.map(function (p) { return { title: p.title, text: p.text }; });
  const cta = alias.cta || {};
  const blocks = [{
    id: 'prem-' + slug + '-benefits',
    sort_order: 10,
    block_type: 'benefits',
    payload: { heading: 'Premium quote flow', items: flatItems }
  }];
  if (alias.showcaseDemoUrl) {
    blocks.push({
      id: 'prem-' + slug + '-demo',
      sort_order: 20,
      block_type: 'demo_embed',
      payload: {
        url: alias.showcaseDemoUrl,
        height: 820,
        caption: 'Bean Culture example — showcase only'
      }
    });
  }
  blocks.push({
    id: 'prem-' + slug + '-cta',
    sort_order: 30,
    block_type: 'cta',
    payload: {
      heading: cta.heading || 'Set up with LeadPages',
      text: cta.text || 'This premium app is configured with the LeadPages team.',
      button_label: cta.button_label || 'Talk to LeadPages',
      button_url: cta.button_url || '/partners'
    }
  });
  return {
    feature: {
      id: 'static-' + slug,
      slug: slug,
      name: alias.name,
      tagline: alias.tagline || '',
      summary: alias.summary || '',
      hero_image_url: alias.hero_image_url || null,
      demo_url: null,
      badge: alias.badge || 'Premium',
      category_id: null,
      status: 'live',
      section_key: null,
      access_type: 'premium_subscription',
      _source: 'premium-showcase'
    },
    blocks: blocks
  };
}

/**
 * Enrich a DB feature+blocks payload so a playground always exists when possible.
 */
function enrichCatalogPayload(feature, blocks, slug) {
  const alias = MARKETING_ALIASES[slug] || null;
  if (alias && alias.platform) {
    return platformFeature(slug, alias);
  }
  if (alias && alias.premiumShowcase) {
    return premiumShowcaseFeature(slug, alias);
  }

  /* Marketing aliases win over stale DB section_key (e.g. promotions → specialOffer) */
  let sectionKey = (alias && alias.sectionKey) || (feature && feature.section_key) || null;
  if (!sectionKey && slug) {
    const camel = camelFromSlug(slug);
    if (sellFor(camel)) sectionKey = camel;
  }

  let feat = feature ? Object.assign({}, feature) : null;
  let blks = Array.isArray(blocks) ? blocks.slice() : [];

  if (!feat && sectionKey) {
    feat = featureFromSell(sectionKey, slug, alias);
    blks = blocksFromSell(sectionKey);
  } else if (feat) {
    if (sectionKey) feat.section_key = sectionKey;
    if (alias) {
      if (alias.name) feat.name = alias.name;
      if (alias.tagline) feat.tagline = alias.tagline;
      if (alias.summary) feat.summary = alias.summary;
      if (alias.badge) feat.badge = alias.badge;
      if (alias.hero_image_url && !feat.hero_image_url) feat.hero_image_url = alias.hero_image_url;
    }
    if (!feat.hero_image_url && sectionKey) {
      const sell = sellFor(sectionKey);
      if (sell && sell.hero_image_url) feat.hero_image_url = sell.hero_image_url;
    }
    if (!blks.length && sectionKey) blks = blocksFromSell(sectionKey);
    else if (sectionKey && !hasPlayground(blks)) {
      // Merge sell playground onto thin DB blocks
      const sellBlocks = blocksFromSell(sectionKey);
      const play = sellBlocks.filter(function (b) { return b.block_type === 'playground'; });
      blks = blks.concat(play);
    }
  }

  if (feat && feat.section_key) {
    blks = ensurePlayground(blks, feat.section_key);
  }

  return { feature: feat, blocks: blks };
}

function resolveFromStatic(slug) {
  const alias = MARKETING_ALIASES[slug];
  if (alias && alias.platform) return platformFeature(slug, alias);
  if (alias && alias.premiumShowcase) return premiumShowcaseFeature(slug, alias);
  const sectionKey = (alias && alias.sectionKey) || (sellFor(camelFromSlug(slug)) ? camelFromSlug(slug) : null);
  if (!sectionKey) return null;
  const feature = featureFromSell(sectionKey, slug, alias || undefined);
  let blocks = blocksFromSell(sectionKey);
  blocks = ensurePlayground(blocks, sectionKey);
  return { feature: feature, blocks: blocks };
}

module.exports = {
  MARKETING_ALIASES,
  kebab,
  camelFromSlug,
  enrichCatalogPayload,
  resolveFromStatic,
  ensurePlayground,
  hasPlayground,
  premiumShowcaseFeature
};
