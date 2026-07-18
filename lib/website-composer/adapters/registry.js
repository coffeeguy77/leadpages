'use strict';

/**
 * Deterministic Website Composer app adapters.
 * Brain never writes arbitrary app config — adapters own the mapping.
 */

const { assertSupportedApp, getCatalogueApp } = require('../marketplace/catalogue');
const { getAppMetadata } = require('../marketplace/app-metadata');
const { PROVENANCE } = require('../constants');

function baseOut(sectionKey, fields, provenance) {
  return {
    on: true,
    provenance: provenance || PROVENANCE.AI_GENERATED,
    ...fields
  };
}

function requireString(obj, key, errors, path) {
  if (!String(obj && obj[key] != null ? obj[key] : '').trim()) {
    errors.push({ code: 'required_field_missing', message: 'Missing ' + key, path });
  }
}

function requireArray(obj, key, min, errors, path) {
  if (!Array.isArray(obj && obj[key]) || obj[key].length < min) {
    errors.push({
      code: 'item_count_invalid',
      message: key + ' requires at least ' + min + ' items',
      path
    });
  }
}

/** @type {Record<string, function>} */
const ADAPTERS = {
  hero(input) {
    const errors = [];
    const i = input || {};
    requireString(i, 'title', errors, 'sections.hero.title');
    requireString(i, 'sub', errors, 'sections.hero.sub');
    const title = String(i.title || i.heading || '');
    const sub = String(i.sub || i.subheading || '');
    const cta = String(i.cta || 'Get in touch');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'hero',
      config: baseOut('hero', {
        variant: 'hero',
        eyebrow: i.eyebrow || '',
        title,
        titleHl: i.titleHl || '',
        sub,
        heading: title,
        subheading: sub,
        cta,
        image: i.image || null,
        imageUrl: i.imageUrl || i.image || null,
        imageBrief: i.imageBrief || null,
        alt: i.alt || title
      }, i.provenance),
      writtenPaths: ['sections.hero'],
      install: { sectionKey: 'hero', position_slot: 'hero' }
    };
  },

  heroSlider(input) {
    const errors = [];
    const slides = (input && input.slides) || [];
    if (slides.length < 2) {
      errors.push({ code: 'item_count_invalid', message: 'heroSlider needs ≥2 slides', path: 'sections.heroSlider.slides' });
    }
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'heroSlider',
      config: baseOut('heroSlider', {
        slides: slides.map((s, idx) => ({
          heading: s.heading || s.title || 'Slide ' + (idx + 1),
          subText: s.subText || s.sub || '',
          imageUrl: s.imageUrl || s.image || null,
          cta: s.cta || input.cta || 'Learn more'
        }))
      }, input.provenance),
      writtenPaths: ['sections.heroSlider'],
      install: { sectionKey: 'heroSlider', position_slot: 'hero' }
    };
  },

  splitHero(input) {
    const errors = [];
    const i = input || {};
    requireString(i, 'title', errors, 'sections.splitHero.title');
    if (errors.length) return { ok: false, errors };
    const feed = Array.isArray(i.feed) ? i.feed : Array.isArray(i.items) ? i.items : [];
    return {
      ok: true,
      sectionKey: 'splitHero',
      config: baseOut('splitHero', {
        title: i.title,
        heading: i.heading || i.title,
        sub: i.sub || '',
        eyebrow: i.eyebrow || '',
        cta: i.cta || 'Get in touch',
        image: i.image || null,
        imageUrl: i.imageUrl || i.image || null,
        feed: feed.map((f) => ({
          text: f.text || f.title || '',
          time: f.time || '',
          on: f.on !== false
        })),
        items: feed.map((f) => ({
          text: f.text || f.title || '',
          time: f.time || '',
          on: f.on !== false
        }))
      }, i.provenance),
      writtenPaths: ['sections.splitHero'],
      install: { sectionKey: 'splitHero', position_slot: 'hero' }
    };
  },

  services(input) {
    const errors = [];
    const items = (input && (input.items || input.services)) || [];
    requireArray({ items }, 'items', 3, errors, 'sections.services.items');
    if (errors.length) return { ok: false, errors };
    const mapped = items.slice(0, 8).map((it) => ({
      title: it.title || 'Service',
      text: it.text || it.body || it.description || '',
      body: it.body || it.text || '',
      image: it.image || null,
      icon: it.icon || null
    }));
    return {
      ok: true,
      sectionKey: 'services',
      config: baseOut('services', {
        heading: (input && input.heading) || 'Services',
        intro: (input && input.intro) || '',
        items: mapped
      }, input && input.provenance),
      services: mapped,
      writtenPaths: ['sections.services', 'services'],
      install: { sectionKey: 'services', position_slot: 'main' }
    };
  },

  featuredProjects(input) {
    const errors = [];
    const projects = (input && (input.projects || input.items)) || [];
    requireArray({ projects }, 'projects', 2, errors, 'sections.featuredProjects.projects');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'featuredProjects',
      config: baseOut('featuredProjects', {
        heading: input.heading || 'Featured work',
        eyebrow: input.eyebrow || '',
        intro: input.intro || '',
        projects: projects.slice(0, 9).map((p) => ({
          title: p.title || 'Project',
          tag: p.tag || '',
          location: p.location || '',
          text: p.text || p.description || '',
          image: p.image || null,
          imageBrief: p.imageBrief || null
        }))
      }, input.provenance),
      writtenPaths: ['sections.featuredProjects'],
      install: { sectionKey: 'featuredProjects', position_slot: 'main' }
    };
  },

  why(input) {
    const errors = [];
    const i = input || {};
    requireString(i, 'heading', errors, 'sections.why.heading');
    const items = Array.isArray(i.items) ? i.items : [];
    requireArray({ items }, 'items', 3, errors, 'sections.why.items');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'why',
      config: baseOut('why', {
        heading: i.heading,
        intro: i.intro || i.text || '',
        items: items.slice(0, 6).map((w, idx) => ({
          n: w.n || String(idx + 1).padStart(2, '0'),
          title: w.title || w.heading || 'Reason',
          text: w.text || w.body || '',
          body: w.body || w.text || '',
          icon: w.icon || null,
          on: w.on !== false
        })),
        image: i.image || null
      }, i.provenance),
      writtenPaths: ['sections.why'],
      install: { sectionKey: 'why', position_slot: 'main' }
    };
  },

  trustBar(input) {
    const badges =
      (input && input.badges) ||
      (input && input.items) ||
      [{ label: 'Trusted locally' }, { label: 'Clear communication' }, { label: 'Quality finish' }];
    const mode = input && input.mode === 'images' ? 'images' : 'badges';
    return {
      ok: true,
      sectionKey: 'trustBar',
      config: baseOut('trustBar', {
        heading: (input && input.heading) || (mode === 'images' ? '' : 'Trusted locally'),
        mode,
        imageHeight: (input && input.imageHeight) || 280,
        badges: badges.slice(0, 6).map((b) => ({
          label: b.label || b.title || String(b),
          image: b.image || b.imageUrl || null,
          imageUrl: b.imageUrl || b.image || null,
          imageBrief: b.imageBrief || null,
          on: b.on !== false
        }))
      }, input && input.provenance),
      writtenPaths: ['sections.trustBar'],
      install: { sectionKey: 'trustBar', position_slot: 'upper' }
    };
  },

  reviews(input) {
    const errors = [];
    const items = (input && input.items) || [];
    requireArray({ items }, 'items', 2, errors, 'sections.reviews.items');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'reviews',
      config: baseOut('reviews', {
        heading: input.heading || 'What clients say',
        items: items.slice(0, 8).map((r) => ({
          who: r.who || r.name || 'Client',
          name: r.name || r.who || 'Client',
          text: r.text || '',
          stars: r.stars || 5
        }))
      }, input.provenance),
      writtenPaths: ['sections.reviews'],
      install: { sectionKey: 'reviews', position_slot: 'main' }
    };
  },

  reviewHighlights(input) {
    const errors = [];
    const i = input || {};
    const items = i.items || [];
    requireArray({ items }, 'items', 2, errors, 'sections.reviewHighlights.items');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'reviewHighlights',
      config: baseOut('reviewHighlights', {
        heading: i.heading || 'Client highlights',
        eyebrow: i.eyebrow || '',
        intro: i.intro || '',
        items: items.slice(0, 4).map((r) => ({
          stars: r.stars || '★★★★★',
          text: r.text || r.message || '',
          who: r.who || r.name || 'Client',
          name: r.name || r.who || 'Client',
          on: r.on !== false
        }))
      }, i.provenance),
      writtenPaths: ['sections.reviewHighlights'],
      install: { sectionKey: 'reviewHighlights', position_slot: 'upper' }
    };
  },

  faq(input) {
    const errors = [];
    const items = (input && input.items) || [];
    requireArray({ items }, 'items', 2, errors, 'sections.faq.items');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'faq',
      config: baseOut('faq', {
        heading: input.heading || 'FAQs',
        items: items.slice(0, 8).map((f) => ({
          q: f.q || f.question || 'Question',
          a: f.a || f.answer || ''
        }))
      }, input.provenance),
      writtenPaths: ['sections.faq'],
      install: { sectionKey: 'faq', position_slot: 'main' }
    };
  },

  quote(input) {
    const errors = [];
    const i = input || {};
    const heading = i.heading || i.title || i.cta || '';
    if (!String(heading).trim()) {
      errors.push({ code: 'required_field_missing', message: 'quote heading required', path: 'sections.quote.heading' });
    }
    if (errors.length) return { ok: false, errors };
    const points = Array.isArray(i.points) ? i.points : [];
    const jobOptions = Array.isArray(i.jobOptions) ? i.jobOptions : [];
    return {
      ok: true,
      sectionKey: 'quote',
      config: baseOut('quote', {
        eyebrow: i.eyebrow || '',
        heading,
        title: heading,
        sub: i.sub != null ? i.sub : i.intro || '',
        intro: i.intro != null ? i.intro : i.sub || '',
        buttonText: i.buttonText || i.cta || heading,
        lblName: i.lblName || 'Name',
        lblPhone: i.lblPhone || 'Phone',
        lblJob: i.lblJob || 'How can we help?',
        lblSuburb: i.lblSuburb || 'Suburb / area',
        lblDetail: i.lblDetail || 'Details',
        suburbPh: i.suburbPh || '',
        detailPh: i.detailPh || '',
        namePh: i.namePh || '',
        phonePh: i.phonePh || '',
        points: points.map((p) => ({
          text: p.text || String(p),
          icon: p.icon || null,
          on: p.on !== false
        })),
        jobOptions: jobOptions.map((o) => ({
          text: o.text || String(o),
          on: o.on !== false
        })),
        successMessage: i.successMessage || 'Thanks — we will be in touch shortly.',
        successTitle: i.successTitle || 'Enquiry received',
        successSub: i.successSub || 'We will follow up soon.',
        formTitle: i.formTitle || heading
      }, i.provenance),
      writtenPaths: ['sections.quote'],
      install: { sectionKey: 'quote', position_slot: 'conversion' }
    };
  },

  onlineQuote(input) {
    return ADAPTERS.quote({ ...(input || {}), provenance: input && input.provenance }).ok
      ? {
          ...ADAPTERS.quote(input),
          sectionKey: 'onlineQuote',
          config: {
            ...ADAPTERS.quote(input).config,
            on: true
          },
          writtenPaths: ['sections.onlineQuote'],
          install: { sectionKey: 'onlineQuote', position_slot: 'conversion' }
        }
      : ADAPTERS.quote(input);
  },

  specialOffer(input) {
    const errors = [];
    requireString(input || {}, 'heading', errors, 'sections.specialOffer.heading');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'specialOffer',
      config: baseOut('specialOffer', {
        heading: input.heading,
        text: input.text || input.intro || '',
        cta: input.cta || 'Enquire now'
      }, input.provenance),
      writtenPaths: ['sections.specialOffer'],
      install: { sectionKey: 'specialOffer', position_slot: 'main' }
    };
  },

  crew(input) {
    return {
      ok: true,
      sectionKey: 'crew',
      config: baseOut('crew', {
        heading: (input && input.heading) || 'Meet the team',
        intro: (input && input.intro) || '',
        members: Array.isArray(input && input.members)
          ? input.members.map((m) => ({
              name: m.name || 'Team member',
              role: m.role || '',
              photo: m.photo || m.image || null
            }))
          : [],
        imageBrief: input && input.imageBrief
      }, input && input.provenance),
      writtenPaths: ['sections.crew'],
      install: { sectionKey: 'crew', position_slot: 'main' }
    };
  },

  serviceProcess(input) {
    const steps =
      (input && (input.steps || input.items)) ||
      [
        { title: 'Tell us what you need', text: 'Share a short brief.' },
        { title: 'Get a clear plan', text: 'We outline scope and timing.' },
        { title: 'Deliver with care', text: 'We follow through cleanly.' }
      ];
    return {
      ok: true,
      sectionKey: 'serviceProcess',
      config: baseOut('serviceProcess', {
        heading: (input && input.heading) || 'How we work',
        intro: (input && input.intro) || '',
        steps: steps.slice(0, 6),
        items: steps.slice(0, 6)
      }, input && input.provenance),
      writtenPaths: ['sections.serviceProcess'],
      install: { sectionKey: 'serviceProcess', position_slot: 'main' }
    };
  },

  area(input) {
    return {
      ok: true,
      sectionKey: 'area',
      config: baseOut('area', {
        heading: (input && input.heading) || 'Areas we serve',
        intro: (input && input.intro) || '',
        items: (input && input.items) || []
      }, input && input.provenance),
      writtenPaths: ['sections.area'],
      install: { sectionKey: 'area', position_slot: 'main' }
    };
  },

  emerg(input) {
    return {
      ok: true,
      sectionKey: 'emerg',
      config: baseOut('emerg', {
        text: (input && (input.text || input.heading)) || 'Call now for prompt service'
      }, input && input.provenance),
      writtenPaths: ['sections.emerg'],
      install: { sectionKey: 'emerg', position_slot: 'top' }
    };
  },

  certifications(input) {
    return {
      ok: true,
      sectionKey: 'certifications',
      config: baseOut('certifications', {
        heading: (input && input.heading) || 'Credentials',
        intro: (input && input.intro) || '',
        items: (input && input.items) || []
      }, input && input.provenance),
      writtenPaths: ['sections.certifications'],
      install: { sectionKey: 'certifications', position_slot: 'main' }
    };
  },

  beforeAfter(input) {
    return {
      ok: true,
      sectionKey: 'beforeAfter',
      config: baseOut('beforeAfter', {
        heading: (input && input.heading) || 'Before & after',
        intro: (input && input.intro) || '',
        items: ((input && input.items) || []).map((it) => ({
          title: it.title || '',
          beforeImage: it.beforeImage || null,
          afterImage: it.afterImage || null
        }))
      }, input && input.provenance),
      writtenPaths: ['sections.beforeAfter'],
      install: { sectionKey: 'beforeAfter', position_slot: 'main' }
    };
  },

  instaGallery(input) {
    return {
      ok: true,
      sectionKey: 'instaGallery',
      config: baseOut('instaGallery', {
        heading: (input && input.heading) || 'On Instagram',
        images: (input && (input.images || input.items)) || []
      }, input && input.provenance),
      writtenPaths: ['sections.instaGallery'],
      install: { sectionKey: 'instaGallery', position_slot: 'main' }
    };
  },

  footer(input) {
    const i = input || {};
    const links = Array.isArray(i.serviceLinks)
      ? i.serviceLinks
      : Array.isArray(i.links)
        ? i.links
        : [];
    return {
      ok: true,
      sectionKey: 'footer',
      config: baseOut(
        'footer',
        {
          blurb: i.blurb || '',
          legal: i.legal != null ? i.legal : '',
          callLabel: i.callLabel || 'Call us',
          servicesHeading: i.servicesHeading || 'Services',
          emergencyLabel: i.emergencyLabel != null ? i.emergencyLabel : '',
          serviceLinks: links.map((l) => ({
            label: l.label || l.title || 'Link',
            href: l.href || '#quote'
          })),
          on: true
        },
        i.provenance || PROVENANCE.BUSINESS_PROFILE
      ),
      writtenPaths: ['sections.footer'],
      install: { sectionKey: 'footer', position_slot: 'footer' }
    };
  },

  productCollection(input) {
    const errors = [];
    const i = input || {};
    requireString(i, 'heading', errors, 'sections.productCollection.heading');
    const items = i.items || [];
    requireArray({ items }, 'items', 2, errors, 'sections.productCollection.items');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'productCollection',
      config: baseOut('productCollection', {
        heading: i.heading,
        intro: i.intro || '',
        eyebrow: i.eyebrow || '',
        cta: i.cta || '',
        items: items.slice(0, 12).map((it) => ({
          title: it.title || 'Product',
          text: it.text || it.body || it.description || '',
          image: it.image || it.imageUrl || null,
          imageUrl: it.imageUrl || it.image || null
        }))
      }, i.provenance),
      writtenPaths: ['sections.productCollection'],
      install: { sectionKey: 'productCollection', position_slot: 'main' }
    };
  },

  clientLogos(input) {
    const errors = [];
    const i = input || {};
    requireString(i, 'heading', errors, 'sections.clientLogos.heading');
    const logos = i.logos || i.items || [];
    requireArray({ logos }, 'logos', 3, errors, 'sections.clientLogos.logos');
    if (errors.length) return { ok: false, errors };
    const mapped = logos.slice(0, 12).map((l) => ({
      label: l.label || l.title || l.name || 'Client',
      image: l.image || l.imageUrl || null,
      imageUrl: l.imageUrl || l.image || null
    }));
    return {
      ok: true,
      sectionKey: 'clientLogos',
      config: baseOut('clientLogos', {
        heading: i.heading,
        intro: i.intro || '',
        eyebrow: i.eyebrow || '',
        logos: mapped,
        items: mapped
      }, i.provenance),
      writtenPaths: ['sections.clientLogos'],
      install: { sectionKey: 'clientLogos', position_slot: 'upper' }
    };
  },

  bookingCta(input) {
    const errors = [];
    const i = input || {};
    requireString(i, 'heading', errors, 'sections.bookingCta.heading');
    requireString(i, 'cta', errors, 'sections.bookingCta.cta');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'bookingCta',
      config: baseOut('bookingCta', {
        heading: i.heading,
        cta: i.cta,
        intro: i.intro || '',
        finePrint: i.finePrint || '',
        eyebrow: i.eyebrow || ''
      }, i.provenance),
      writtenPaths: ['sections.bookingCta'],
      install: { sectionKey: 'bookingCta', position_slot: 'conversion' }
    };
  },

  brandStory(input) {
    const errors = [];
    const i = input || {};
    requireString(i, 'heading', errors, 'sections.brandStory.heading');
    const body = String(i.body || i.text || '').trim();
    if (!body) {
      errors.push({
        code: 'required_field_missing',
        message: 'Missing body',
        path: 'sections.brandStory.body'
      });
    }
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'brandStory',
      config: baseOut('brandStory', {
        heading: i.heading,
        body,
        text: body,
        eyebrow: i.eyebrow || '',
        intro: i.intro || '',
        cta: i.cta || '',
        image: i.image || null,
        imageUrl: i.imageUrl || i.image || null
      }, i.provenance),
      writtenPaths: ['sections.brandStory'],
      install: { sectionKey: 'brandStory', position_slot: 'main' }
    };
  },

  packageCompare(input) {
    const errors = [];
    const i = input || {};
    requireString(i, 'heading', errors, 'sections.packageCompare.heading');
    const packages = i.packages || i.items || [];
    requireArray({ packages }, 'packages', 2, errors, 'sections.packageCompare.packages');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'packageCompare',
      config: baseOut('packageCompare', {
        heading: i.heading,
        intro: i.intro || '',
        eyebrow: i.eyebrow || '',
        cta: i.cta || '',
        packages: packages.slice(0, 4).map((p) => ({
          title: p.title || 'Package',
          text: p.text || p.body || p.description || '',
          inclusions: Array.isArray(p.inclusions) ? p.inclusions.map(String) : [],
          priceLabel: p.priceLabel || p.price || ''
        }))
      }, i.provenance),
      writtenPaths: ['sections.packageCompare'],
      install: { sectionKey: 'packageCompare', position_slot: 'main' }
    };
  },

  textBox(input) {
    const errors = [];
    const i = input || {};
    requireString(i, 'heading', errors, 'sections.textBox.heading');
    const body = String(i.body || i.text || i.content || '').trim();
    if (!body) {
      errors.push({
        code: 'required_field_missing',
        message: 'Missing body/text',
        path: 'sections.textBox.body'
      });
    }
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'textBox',
      config: baseOut('textBox', {
        heading: i.heading,
        body,
        text: body,
        content: body,
        intro: i.intro || '',
        eyebrow: i.eyebrow || '',
        image: i.image || null
      }, i.provenance),
      writtenPaths: ['sections.textBox'],
      install: { sectionKey: 'textBox', position_slot: 'main' }
    };
  },

  featureStrip(input) {
    const errors = [];
    const i = input || {};
    requireString(i, 'heading', errors, 'sections.featureStrip.heading');
    const items = i.items || [];
    requireArray({ items }, 'items', 3, errors, 'sections.featureStrip.items');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'featureStrip',
      config: baseOut('featureStrip', {
        heading: i.heading,
        intro: i.intro || '',
        eyebrow: i.eyebrow || '',
        items: items.slice(0, 6).map((it) => ({
          title: it.title || 'Feature',
          text: it.text || it.body || '',
          icon: it.icon || null
        }))
      }, i.provenance),
      writtenPaths: ['sections.featureStrip'],
      install: { sectionKey: 'featureStrip', position_slot: 'upper' }
    };
  },

  customerReactions(input) {
    const errors = [];
    const i = input || {};
    const items = i.items || [];
    requireArray({ items }, 'items', 2, errors, 'sections.customerReactions.items');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'customerReactions',
      config: baseOut('customerReactions', {
        heading: i.heading || 'What customers are saying',
        eyebrow: i.eyebrow || '',
        intro: i.intro || '',
        items: items.slice(0, 8).map((r) => ({
          name: r.name || r.who || 'Customer',
          who: r.who || r.name || 'Customer',
          message: r.message || r.text || r.quote || '',
          text: r.text || r.message || r.quote || '',
          style: r.style || 'google',
          time: r.time || '',
          rating: r.rating || r.stars || '',
          image: r.image || null
        }))
      }, i.provenance),
      writtenPaths: ['sections.customerReactions'],
      install: { sectionKey: 'customerReactions', position_slot: 'main' }
    };
  },

  jobsFeed(input) {
    const errors = [];
    const i = input || {};
    const items = i.items || [];
    requireArray({ items }, 'items', 2, errors, 'sections.jobsFeed.items');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'jobsFeed',
      config: baseOut('jobsFeed', {
        heading: i.heading || 'Recent jobs',
        eyebrow: i.eyebrow || '',
        intro: i.intro || '',
        items: items.slice(0, 12).map((it) => ({
          title: it.title || 'Job',
          location: it.location || '',
          time: it.time || '',
          result: it.result || it.text || it.body || '',
          text: it.text || it.result || '',
          image: it.image || null
        }))
      }, i.provenance),
      writtenPaths: ['sections.jobsFeed'],
      install: { sectionKey: 'jobsFeed', position_slot: 'main' }
    };
  },

  projectFeed(input) {
    const errors = [];
    const i = input || {};
    const items = i.items || i.projects || [];
    requireArray({ items }, 'items', 2, errors, 'sections.projectFeed.items');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'projectFeed',
      config: baseOut('projectFeed', {
        heading: i.heading || 'Latest work',
        eyebrow: i.eyebrow || '',
        intro: i.intro || '',
        items: items.slice(0, 12).map((it) => ({
          title: it.title || 'Project',
          location: it.location || '',
          service: it.service || it.tag || '',
          date: it.date || it.time || '',
          caption: it.caption || it.text || it.description || '',
          text: it.text || it.caption || '',
          image: it.image || null,
          permalink: it.permalink || null
        }))
      }, i.provenance),
      writtenPaths: ['sections.projectFeed'],
      install: { sectionKey: 'projectFeed', position_slot: 'main' }
    };
  },

  projectStats(input) {
    const errors = [];
    const i = input || {};
    const stats = i.stats || i.items || [];
    requireArray({ stats }, 'stats', 3, errors, 'sections.projectStats.stats');
    if (errors.length) return { ok: false, errors };
    const mapped = stats.slice(0, 8).map((s) => ({
      value: s.value != null ? String(s.value) : s.label || '',
      label: s.label || s.title || '',
      title: s.title || s.label || ''
    }));
    return {
      ok: true,
      sectionKey: 'projectStats',
      config: baseOut('projectStats', {
        heading: i.heading || 'By the numbers',
        eyebrow: i.eyebrow || '',
        intro: i.intro || '',
        stats: mapped,
        items: mapped
      }, i.provenance),
      writtenPaths: ['sections.projectStats'],
      install: { sectionKey: 'projectStats', position_slot: 'upper' }
    };
  },

  serviceAreas(input) {
    const errors = [];
    const i = input || {};
    const areas = i.areas || i.items || [];
    requireArray({ areas }, 'areas', 3, errors, 'sections.serviceAreas.areas');
    if (errors.length) return { ok: false, errors };
    const mapped = areas.slice(0, 24).map((a) => {
      if (typeof a === 'string') return { name: a, title: a };
      return {
        name: a.name || a.title || a.label || 'Area',
        title: a.title || a.name || a.label || 'Area'
      };
    });
    return {
      ok: true,
      sectionKey: 'serviceAreas',
      config: baseOut('serviceAreas', {
        heading: i.heading || 'Areas we serve',
        eyebrow: i.eyebrow || '',
        intro: i.intro || '',
        areas: mapped,
        items: mapped
      }, i.provenance),
      writtenPaths: ['sections.serviceAreas'],
      install: { sectionKey: 'serviceAreas', position_slot: 'main' }
    };
  },

  beforeAfterFeed(input) {
    const errors = [];
    const i = input || {};
    const items = i.items || [];
    requireArray({ items }, 'items', 2, errors, 'sections.beforeAfterFeed.items');
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      sectionKey: 'beforeAfterFeed',
      config: baseOut('beforeAfterFeed', {
        heading: i.heading || 'Before & after',
        eyebrow: i.eyebrow || '',
        intro: i.intro || '',
        items: items.slice(0, 8).map((it) => ({
          title: it.title || '',
          location: it.location || '',
          time: it.time || '',
          caption: it.caption || it.text || '',
          beforeImage: it.beforeImage || it.before || null,
          afterImage: it.afterImage || it.after || null,
          image: it.image || it.afterImage || it.after || null,
          before: it.before || it.beforeImage || null,
          after: it.after || it.afterImage || null
        }))
      }, i.provenance),
      writtenPaths: ['sections.beforeAfterFeed'],
      install: { sectionKey: 'beforeAfterFeed', position_slot: 'main' }
    };
  }
};

// onlineQuote fix - avoid double call bug
ADAPTERS.onlineQuote = function onlineQuoteAdapter(input) {
  const quoteResult = ADAPTERS.quote(input);
  if (!quoteResult.ok) return quoteResult;
  return {
    ok: true,
    sectionKey: 'onlineQuote',
    config: { ...quoteResult.config },
    writtenPaths: ['sections.onlineQuote'],
    install: { sectionKey: 'onlineQuote', position_slot: 'conversion' }
  };
};

function listAdapterIds() {
  return Object.keys(ADAPTERS);
}

function hasAdapter(appId) {
  return typeof ADAPTERS[appId] === 'function';
}

/**
 * Adapt structured Composer content into repository-supported section config.
 */
function adaptApp(appId, structuredInput, opts) {
  const options = opts || {};
  if (appId === 'footer') {
    return ADAPTERS.footer(structuredInput);
  }
  const gate = assertSupportedApp(appId);
  if (!gate.ok && appId !== 'footer') {
    // Allow supported-with-limitations only when explicitly forced
    const cat = getCatalogueApp(appId);
    if (!cat || (cat.websiteStudioSupport !== 'supported' && !options.allowLimited)) {
      return { ok: false, errors: [gate.error || { code: 'app_unsupported', message: String(appId) }] };
    }
  }
  const fn = ADAPTERS[appId];
  if (!fn) {
    return {
      ok: false,
      errors: [{ code: 'adapter_missing', message: 'No deterministic adapter for ' + appId }]
    };
  }
  const meta = getAppMetadata(appId);
  const result = fn(structuredInput || {});
  if (!result.ok) return result;

  // Variant validation
  if (options.variant && meta && Array.isArray(meta.supportedVariants) && meta.supportedVariants.length) {
    if (!meta.supportedVariants.includes(options.variant) && options.variant !== 'default') {
      return {
        ok: false,
        errors: [{ code: 'variant_unknown', message: 'Unsupported variant ' + options.variant, path: appId }]
      };
    }
  }

  return {
    ...result,
    diagnostics: {
      appId,
      adapter: 'websiteComposerAppAdapters.' + appId,
      catalogueStatus: (getCatalogueApp(appId) || {}).websiteStudioSupport || 'n/a',
      metadata: meta ? { qualityScore: meta.qualityScore, imageDependency: meta.imageDependency } : null
    }
  };
}

module.exports = {
  ADAPTERS,
  listAdapterIds,
  hasAdapter,
  adaptApp
};
