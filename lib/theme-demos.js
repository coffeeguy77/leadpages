'use strict';

const {
  IDENTITY_TOP_KEYS,
  IDENTITY_SECTION_KEYS,
  applyPositioningLayout
} = require('./positioning-layouts');

function deepClone(o) {
  return JSON.parse(JSON.stringify(o == null ? {} : o));
}

const APP_LABELS = {
  hero: 'Hero',
  trust: 'Trust Bar',
  services: 'Services',
  why: 'Why us',
  process: 'Process',
  serviceProcess: 'Service process',
  reviews: 'Reviews',
  featuredProjects: 'Featured projects',
  premiumGallery: 'Premium Gallery',
  gallery: 'Gallery',
  team: 'Team',
  faq: 'FAQ',
  quote: 'Quote',
  onlineQuote: 'Online Quote',
  contact: 'Contact',
  area: 'Areas',
  emerg: 'Emergency strip',
  cta: 'CTA',
  footer: 'Footer',
  certifications: 'Certifications',
  beforeAfter: 'Before & after'
};

function appLabel(key) {
  return APP_LABELS[key] || String(key || '').replace(/([A-Z])/g, ' $1').replace(/^./, function (c) {
    return c.toUpperCase();
  });
}

function demoBrandFor(layout) {
  const tags = Array.isArray(layout && layout.industry_tags) ? layout.industry_tags : [];
  const tag = String(tags[0] || '').toLowerCase();
  if (layout && layout.demo_brand_name) return String(layout.demo_brand_name).trim();
  if (/plumb/.test(tag)) return 'Harbour Plumbing Co';
  if (/electric|spark/.test(tag)) return 'Brightline Electrical';
  if (/roof/.test(tag)) return 'Summit Roofing';
  if (/build|carpentry|renovat/.test(tag)) return 'Northside Builders';
  if (/landscap|garden/.test(tag)) return 'Greenline Landscapes';
  if (/salon|beauty|hair/.test(tag)) return 'Studio Lane Beauty';
  if (/cafe|coffee|hospital/.test(tag)) return 'Bean & Branch Cafe';
  if (/clean/.test(tag)) return 'Clearview Cleaning';
  if (/hvac|air|heat/.test(tag)) return 'Climate Craft HVAC';
  return (layout && layout.name ? layout.name.replace(/\s+theme$/i, '').trim() : '') || 'Demo Trade Co';
}

function demoIdentity(layout) {
  const brand = demoBrandFor(layout);
  const slugBit = String((layout && layout.slug) || 'demo')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return {
    businessName: brand,
    phone: '1300 000 000',
    email: 'hello@' + (slugBit || 'demo') + '.example',
    region: 'Australia',
    suburb: 'Demo Suburb',
    address: '',
    abn: '',
    licence: '',
    ownerName: '',
    ownerEmail: '',
    logo: '',
    logoUrl: '',
    social: {}
  };
}

/** Strip client identity / PII from a config or demo pack tree. */
function scrubClientIp(cfg, layout) {
  const out = deepClone(cfg || {});
  const id = demoIdentity(layout || {});
  IDENTITY_TOP_KEYS.forEach(function (k) {
    if (Object.prototype.hasOwnProperty.call(id, k)) out[k] = id[k];
    else if (k === 'businessName' || k === 'business') out[k] = id.businessName;
    else if (k === 'phone' || k === 'mobile') out[k] = id.phone;
    else if (k === 'email') out[k] = id.email;
    else delete out[k];
  });
  out.businessName = id.businessName;
  out.phone = id.phone;
  out.email = id.email;
  out.region = id.region;
  if (out.sections && typeof out.sections === 'object') {
    Object.keys(out.sections).forEach(function (sk) {
      const sec = out.sections[sk];
      if (!sec || typeof sec !== 'object') return;
      (IDENTITY_SECTION_KEYS[sk] || []).forEach(function (k) {
        delete sec[k];
      });
      ['phone', 'email', 'address', 'abn', 'licence', 'license', 'businessName', 'ownerName'].forEach(function (k) {
        if (sec[k] != null) delete sec[k];
      });
    });
  }
  return out;
}

function scrubDemoPacks(packs, layout) {
  const out = deepClone(packs && typeof packs === 'object' ? packs : {});
  Object.keys(out).forEach(function (sk) {
    if (sk === '_theme' || sk === '_site') return;
    const sec = out[sk];
    if (!sec || typeof sec !== 'object') return;
    (IDENTITY_SECTION_KEYS[sk] || []).forEach(function (k) {
      delete sec[k];
    });
    ['phone', 'email', 'address', 'abn', 'licence', 'license', 'businessName', 'ownerName', 'ownerEmail'].forEach(function (k) {
      delete sec[k];
    });
  });
  delete out._site;
  return out;
}

function defaultFeatures(layout) {
  const apps = Array.isArray(layout && layout.apps) ? layout.apps : [];
  const on = apps.filter(function (a) {
    return a && a.enabled !== false;
  });
  const feats = [
    'Ready-to-apply homepage layout for partners',
    'Trust Bar pinned under the hero for conversion',
    on.length + ' marketplace apps in the stack'
  ];
  if ((layout && layout.demo_packs && Object.keys(layout.demo_packs).length) || false) {
    feats.push('Includes demo content packs for a one-click install');
  }
  return feats;
}

function defaultBenefits(layout) {
  return [
    'Launch a polished demo in minutes — no blank-page design work',
    'Keep client identity protected when you install on a real job',
    'Show prospects a live example before you build their site',
    'Reuse the same theme across multiple industries with a quick Update'
  ];
}

function rewriteString(s, brand, industry) {
  if (typeof s !== 'string' || !s.trim()) return s;
  var t = s;
  // Soften overly specific client names / suburbs often left in packs
  t = t.replace(/\b(Pty Ltd|Pty\. Ltd\.|A\.B\.N\.|ABN\s*\d[\d\s]+)/gi, '');
  t = t.replace(/\b0[2-8]\s?\d{4}\s?\d{4}\b/g, '1300 000 000');
  t = t.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, 'hello@demo.example');
  if (/^(get a quote|call now|contact us)$/i.test(t.trim())) return t;
  if (t.length < 8) return t;
  // Light industry flavouring for short headlines
  if (t.length < 80 && /\b(we|our|your)\b/i.test(t) && brand) {
    if (!t.toLowerCase().includes(brand.toLowerCase().split(' ')[0])) {
      /* keep */
    }
  }
  void industry;
  return t.trim();
}

function regenPackCopy(packs, layout) {
  const brand = demoBrandFor(layout);
  const industry = (Array.isArray(layout && layout.industry_tags) && layout.industry_tags[0]) || 'trade';
  const out = scrubDemoPacks(packs, layout);
  const templates = {
    hero: {
      heading: brand + ' — quality work, done right',
      subheading: 'Trusted ' + industry + ' specialists serving homes and businesses across Australia.',
      ctaText: 'Get a free quote'
    },
    why: {
      heading: 'Why homeowners choose ' + brand,
      intro: 'Clear communication, tidy workmanship, and a finish you can be proud of.'
    },
    services: {
      heading: 'Services',
      intro: 'Practical solutions tailored to your property — from urgent call-outs to planned upgrades.'
    },
    process: {
      heading: 'How we work',
      intro: 'A simple path from first call to finished job.'
    },
    reviews: {
      heading: 'What customers say',
      intro: 'Real feedback from people who hired a LeadPages demo team like this.'
    },
    faq: {
      heading: 'Frequently asked questions',
      intro: 'Straight answers before you book.'
    },
    quote: {
      heading: 'Request a quote',
      intro: 'Tell us about the job and we will get back to you promptly.'
    },
    contact: {
      heading: 'Contact us',
      intro: 'Reach the ' + brand + ' demo team — replace these details when you install for a client.'
    }
  };

  Object.keys(out).forEach(function (sk) {
    if (sk === '_theme') return;
    const sec = out[sk];
    if (!sec || typeof sec !== 'object') return;
    const tpl = templates[sk];
    if (tpl) {
      Object.keys(tpl).forEach(function (k) {
        if (sec[k] == null || typeof sec[k] === 'string') sec[k] = tpl[k];
      });
    }
    ['heading', 'title', 'eyebrow', 'intro', 'supporting', 'subheading', 'text', 'ctaText', 'badge'].forEach(function (k) {
      if (typeof sec[k] === 'string') sec[k] = rewriteString(sec[k], brand, industry);
    });
    if (Array.isArray(sec.items)) {
      sec.items = sec.items.map(function (it, i) {
        if (!it || typeof it !== 'object') return it;
        const copy = deepClone(it);
        ['title', 'name', 'heading', 'text', 'body', 'caption', 'label'].forEach(function (k) {
          if (typeof copy[k] === 'string') copy[k] = rewriteString(copy[k], brand, industry);
        });
        if (!copy.title && !copy.name && tpl) copy.title = 'Demo highlight ' + (i + 1);
        return copy;
      });
    }
    if (Array.isArray(sec.slides)) {
      sec.slides = sec.slides.map(function (sl, i) {
        if (!sl || typeof sl !== 'object') return sl;
        const copy = deepClone(sl);
        ['heading', 'title', 'text', 'subheading', 'ctaText'].forEach(function (k) {
          if (typeof copy[k] === 'string') copy[k] = rewriteString(copy[k], brand, industry);
        });
        if (!copy.heading) copy.heading = brand + ' slide ' + (i + 1);
        return copy;
      });
    }
  });
  return out;
}

/**
 * Optional AI rewrite of pack copy. Falls back to template regen when no key / failure.
 */
async function aiRegenDemoPacks(packs, layout) {
  const base = regenPackCopy(packs, layout);
  const key = process.env.ANTHROPIC_API_KEY || process.env.ASSIST_ANTHROPIC_KEY;
  if (!key) return { packs: base, via: 'template' };

  try {
    const brand = demoBrandFor(layout);
    const industry = (Array.isArray(layout.industry_tags) && layout.industry_tags.join(', ')) || 'trade services';
    const sample = {};
    Object.keys(base).slice(0, 8).forEach(function (k) {
      if (k === '_theme') return;
      const sec = base[k];
      if (!sec || typeof sec !== 'object') return;
      sample[k] = {
        heading: sec.heading || sec.title || null,
        intro: sec.intro || sec.subheading || null
      };
    });
    const prompt =
      'You rewrite demo website section copy for a LeadPages theme library. ' +
      'Brand: "' +
      brand +
      '". Industry: ' +
      industry +
      '. Return ONLY valid JSON mapping section keys to {heading, intro} with generic Australian trade demo copy — no real client names, phones, emails, or suburbs. Input: ' +
      JSON.stringify(sample);

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ASSIST_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!r.ok) return { packs: base, via: 'template' };
    const j = await r.json().catch(function () {
      return {};
    });
    const text = (((j.content || [])[0] || {}).text || '').trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { packs: base, via: 'template' };
    const parsed = JSON.parse(m[0]);
    Object.keys(parsed).forEach(function (sk) {
      if (!base[sk] || typeof base[sk] !== 'object') return;
      const patch = parsed[sk] || {};
      if (patch.heading) base[sk].heading = String(patch.heading);
      if (patch.intro) base[sk].intro = String(patch.intro);
      if (patch.subheading) base[sk].subheading = String(patch.subheading);
    });
    return { packs: base, via: 'ai' };
  } catch (_e) {
    return { packs: base, via: 'template' };
  }
}

function buildDemoSiteConfig(layout) {
  const identity = demoIdentity(layout);
  const seed = {
    businessName: identity.businessName,
    phone: identity.phone,
    email: identity.email,
    region: identity.region,
    sections: {},
    sectionOrder: Array.isArray(layout.section_order) ? layout.section_order.slice() : []
  };
  const applied = applyPositioningLayout(seed, layout, { mode: 'demo_replace' });
  return scrubClientIp(applied.config, layout);
}

function publicDemoCard(layout, opts) {
  opts = opts || {};
  const apps = (Array.isArray(layout.apps) ? layout.apps : [])
    .filter(function (a) {
      return a && a.enabled !== false;
    })
    .map(function (a) {
      const key = a.section_key || a.key;
      return { key: key, label: a.label || appLabel(key) };
    });
  const liveSlug =
    (opts.demoSite && opts.demoSite.slug) ||
    layout.live_demo_slug ||
    (layout.slug ? 'demo-' + layout.slug : null);
  const liveUrl = liveSlug
    ? 'https://www.leadpages.com.au/' + String(liveSlug).replace(/^\/+/, '')
    : null;
  return {
    id: layout.id,
    slug: layout.slug,
    name: layout.name,
    description: layout.description || '',
    theme_image_url: layout.theme_image_url || null,
    layout_image_url: layout.layout_image_url || null,
    industry_tags: layout.industry_tags || [],
    apps: apps,
    features: Array.isArray(layout.features) && layout.features.length ? layout.features : defaultFeatures(layout),
    benefits: Array.isArray(layout.benefits) && layout.benefits.length ? layout.benefits : defaultBenefits(layout),
    promo_headline: layout.promo_headline || layout.name,
    promo_body: layout.promo_body || layout.description || '',
    demo_brand_name: demoBrandFor(layout),
    live_demo_slug: liveSlug,
    live_demo_url: liveUrl,
    demo_site_id: layout.demo_site_id || (opts.demoSite && opts.demoSite.id) || null,
    updated_at: layout.updated_at || null
  };
}

async function syncLiveDemoSite(admin, layout, opts) {
  opts = opts || {};
  if (!admin || !layout) return { ok: false, error: 'missing' };
  const brand = demoBrandFor(layout);
  const slug =
    (opts.slug && String(opts.slug).trim()) ||
    ('demo-' + String(layout.slug || layout.id || 'theme').replace(/^demo-/, '')).slice(0, 60);
  const config = buildDemoSiteConfig(layout);
  const row = {
    slug: slug,
    business_name: brand,
    template: 'trade',
    vertical: 'trade',
    status: opts.status || 'live',
    is_demo: true,
    is_mockup: false,
    config: config,
    updated_at: new Date().toISOString()
  };

  let site = null;
  if (layout.demo_site_id) {
    const { data, error } = await admin
      .from('sites')
      .update(row)
      .eq('id', layout.demo_site_id)
      .select('id,slug,business_name,status,is_demo')
      .maybeSingle();
    if (!error && data) site = data;
  }
  if (!site) {
    const existing = await admin.from('sites').select('id,slug').eq('slug', slug).maybeSingle();
    if (existing.data && existing.data.id) {
      const { data, error } = await admin
        .from('sites')
        .update(row)
        .eq('id', existing.data.id)
        .select('id,slug,business_name,status,is_demo')
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      site = data;
    } else {
      const { data, error } = await admin
        .from('sites')
        .insert(row)
        .select('id,slug,business_name,status,is_demo')
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      site = data;
    }
  }

  if (site && site.id && layout.id) {
    await admin
      .from('positioning_layouts')
      .update({ demo_site_id: site.id, demo_brand_name: brand, updated_at: new Date().toISOString() })
      .eq('id', layout.id);
  }
  return { ok: true, site: site, brand: brand };
}

module.exports = {
  APP_LABELS: APP_LABELS,
  appLabel: appLabel,
  demoBrandFor: demoBrandFor,
  demoIdentity: demoIdentity,
  scrubClientIp: scrubClientIp,
  scrubDemoPacks: scrubDemoPacks,
  regenPackCopy: regenPackCopy,
  aiRegenDemoPacks: aiRegenDemoPacks,
  buildDemoSiteConfig: buildDemoSiteConfig,
  publicDemoCard: publicDemoCard,
  syncLiveDemoSite: syncLiveDemoSite,
  defaultFeatures: defaultFeatures,
  defaultBenefits: defaultBenefits
};
