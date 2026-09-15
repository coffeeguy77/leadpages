'use strict';

/**
 * Rich SEO fill for Layout Composer — uses interview `understanding`
 * to populate every enabled section. Structure stays locked.
 */

const { labelForSection } = require('./section-catalogue');

function clean(s, n) {
  return String(s == null ? '' : s).trim().slice(0, n || 400);
}

function mergeBrief(brief, understanding) {
  const b = Object.assign({}, brief || {});
  const u = understanding || {};
  if (u.businessName) b.businessName = u.businessName;
  if (u.trade) b.trade = u.trade;
  if (u.location) b.location = u.location;
  b.services = (u.services && u.services.length ? u.services : b.services) || [];
  b.customers = (u.customers && u.customers.length ? u.customers : b.customers) || [];
  b.serviceAreas = (u.serviceAreas && u.serviceAreas.length ? u.serviceAreas : b.serviceAreas) || [];
  b.differentiator = u.differentiator || b.differentiator || '';
  b.preferredCta = u.preferredCta || b.preferredCta || 'Get a free quote';
  b.tone = u.tone || b.tone || 'plain';
  return b;
}

function listPhrase(items, fallback) {
  const arr = (items || []).map(function (x) { return clean(x, 80); }).filter(Boolean);
  if (!arr.length) return fallback;
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return arr[0] + ' and ' + arr[1];
  return arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1];
}

function toneLead(tone, biz) {
  if (tone === 'premium') return biz + ' delivers polished, dependable work.';
  if (tone === 'friendly') return 'Neighbours trust ' + biz + ' to show up and do the job properly.';
  if (tone === 'urgent') return 'Need help fast? ' + biz + ' responds quickly.';
  return biz + ' focuses on clear quotes and tidy workmanship.';
}

/**
 * Rich copy for one section key.
 */
function richSectionCopy(sectionKey, brief) {
  const biz = clean(brief && brief.businessName, 120) || 'Your business';
  const loc = clean(brief && brief.location, 80) || 'your area';
  const trade = clean(brief && brief.trade, 80) || 'local experts';
  const tradeLc = trade.toLowerCase();
  const cta = clean(brief && brief.preferredCta, 60) || 'Get a free quote';
  const edge = clean(brief && brief.differentiator, 160) ||
    ('Reliable ' + tradeLc + ' with clear communication across ' + loc);
  const services = brief.services || [];
  const customers = brief.customers || [];
  const areas = brief.serviceAreas || [];
  const servicesPhrase = listPhrase(services, tradeLc + ' services');
  const customersPhrase = listPhrase(customers, 'homeowners and local businesses');
  const areasPhrase = listPhrase(areas, loc);
  const tone = brief.tone || 'plain';
  const label = labelForSection(sectionKey);

  switch (sectionKey) {
    case 'hero':
    case 'splitHero':
    case 'heroSlider':
    case 'heroBeforeAfter':
      return {
        eyebrow: trade + ' · ' + loc,
        title: biz,
        titleHl: edge.split(/[.!]/)[0].slice(0, 48) || 'done properly',
        sub: toneLead(tone, biz) + ' Specialising in ' + servicesPhrase + ' for ' + customersPhrase + '.',
        cta: cta,
        ctaLabel: cta,
        button: cta
      };
    case 'services':
      return {
        eyebrow: 'What we do',
        heading: trade + ' services in ' + loc,
        intro: biz + ' helps ' + customersPhrase + ' with ' + servicesPhrase + '.',
        items: (services.length ? services : [trade + ' call-outs', 'Maintenance', 'Repairs']).slice(0, 6).map(function (name) {
          return {
            title: name,
            body: 'Professional ' + String(name).toLowerCase() + ' across ' + areasPhrase + '.'
          };
        })
      };
    case 'why':
      return {
        eyebrow: 'Why ' + biz,
        heading: edge.split(/[.!]/)[0] || ('Why choose ' + biz),
        intro: toneLead(tone, biz),
        items: [
          { title: 'Local to ' + loc, body: 'We regularly work across ' + areasPhrase + '.' },
          { title: 'Clear scope', body: 'Know what is included before work starts.' },
          { title: 'Respect on site', body: 'Protect floors, clean up, and explain what we did.' }
        ]
      };
    case 'reviews':
    case 'reviewHighlights':
      return {
        eyebrow: 'From nearby customers',
        heading: 'Trusted ' + tradeLc + ' around ' + loc,
        intro: 'Feedback from ' + customersPhrase + ' we support across ' + areasPhrase + '.',
        items: [
          {
            who: 'Local customer — ' + loc,
            text: '"' + biz + ' were clear on price and finished neatly."'
          },
          {
            who: 'Property manager — ' + loc,
            text: '"Reliable ' + tradeLc + ' — easy to book and good communication."'
          }
        ]
      };
    case 'faq':
      return {
        heading: 'Common questions about ' + tradeLc + ' in ' + loc,
        items: [
          {
            q: 'Do you cover ' + loc + '?',
            a: 'Yes — ' + biz + ' regularly works across ' + areasPhrase + '.'
          },
          {
            q: 'What ' + tradeLc + ' work do you handle?',
            a: 'We focus on ' + servicesPhrase + ' for ' + customersPhrase + '.'
          },
          {
            q: 'How do I get a quote?',
            a: 'Use “' + cta + '” on this page — tell us the suburb and what you need.'
          },
          {
            q: 'What makes you different?',
            a: edge
          }
        ]
      };
    case 'quote':
    case 'onlineQuote':
      return {
        heading: cta,
        sub: 'Tell ' + biz + ' what you need in ' + loc + ' — we will respond with a clear next step.',
        button: cta,
        cta: cta,
        intro: 'Serving ' + areasPhrase + '.'
      };
    case 'area':
    case 'serviceAreas':
    case 'serviceAreaMap':
      return {
        heading: trade + ' across ' + loc,
        intro: biz + ' supports customers throughout ' + areasPhrase + '.',
        items: (areas.length ? areas : [loc]).slice(0, 8).map(function (a) {
          return { title: a, body: trade + ' for homes and businesses in ' + a + '.' };
        })
      };
    case 'footer':
      return {
        blurb: biz + ' — ' + trade + ' servicing ' + areasPhrase + '. ' + edge
      };
    case 'trustBar':
      return {
        items: [
          { label: 'Licensed & insured' },
          { label: loc + ' locals' },
          { label: clean(cta, 28) }
        ]
      };
    case 'serviceProcess':
      return {
        heading: 'How ' + biz + ' works',
        intro: 'A simple path from enquiry to finished job.',
        items: [
          { title: 'Tell us the job', body: 'Suburb, timing, and what you need.' },
          { title: 'Clear plan', body: 'Scope and pricing cues before work starts.' },
          { title: 'Done properly', body: 'Tidy finish and plain-language handover.' }
        ]
      };
    case 'crew':
      return {
        heading: 'The ' + biz + ' team',
        intro: 'Local ' + tradeLc + ' people who look after ' + customersPhrase + ' across ' + loc + '.'
      };
    case 'seoText':
    case 'textBox':
      return {
        heading: trade + ' in ' + loc,
        intro: biz + ' provides ' + servicesPhrase + ' for ' + customersPhrase +
          '. ' + edge + ' Get started with “' + cta + '”.'
      };
    case 'searchCanvas': {
      const tabServices = (services.length ? services : [trade + ' install', trade + ' repair', 'Maintenance']).slice(0, 4);
      return {
        heading: 'Solutions designed around ' + biz,
        intro: 'Explore ' + servicesPhrase + ' for ' + customersPhrase + ' across ' + areasPhrase + '.',
        header: {
          eyebrow: trade + ' · ' + loc,
          heading: 'Solutions designed around your business',
          intro: edge + ' Browse the services below, then ' + cta.toLowerCase() + '.'
        },
        tabs: tabServices.map(function (name, i) {
          return {
            id: 'tab-lc-' + (i + 1),
            label: String(name).slice(0, 40),
            heading: String(name),
            intro: biz + ' delivers ' + String(name).toLowerCase() + ' across ' + areasPhrase + '.',
            bullets: [edge, 'Coverage: ' + areasPhrase, cta],
            on: true
          };
        })
      };
    }
    case 'specialOffer':
    case 'promotions':
      return {
        heading: 'Ready for help in ' + loc + '?',
        intro: 'Ask ' + biz + ' about ' + servicesPhrase + '.',
        cta: cta,
        button: cta
      };
    case 'emerg':
    case 'emergencyAvailability':
      return {
        heading: 'Need ' + tradeLc + ' help in ' + loc + '?',
        intro: 'Contact ' + biz + ' for urgent and planned work across ' + areasPhrase + '.',
        cta: cta,
        button: cta
      };
    case 'certifications':
      return {
        heading: 'Credentials',
        intro: biz + ' keeps licences and insurance current for work across ' + loc + '.'
      };
    case 'featureStrip':
    case 'responseCards':
    case 'projectStats':
      return {
        heading: 'Why locals choose ' + biz,
        intro: edge,
        items: [
          { title: 'Local coverage', body: areasPhrase },
          { title: 'Core work', body: servicesPhrase },
          { title: 'Next step', body: cta }
        ]
      };
    case 'beforeAfter':
    case 'beforeAfterFeed':
    case 'featuredProjects':
    case 'premiumGallery':
    case 'projectFeed':
      return {
        heading: 'Recent ' + tradeLc + ' work',
        intro: 'Examples of the ' + servicesPhrase + ' ' + biz + ' delivers around ' + loc + '.'
      };
    default:
      return {
        heading: label + ' — ' + biz,
        intro: toneLead(tone, biz) + ' ' + trade + ' across ' + areasPhrase +
          '. Focus: ' + servicesPhrase + '. ' + edge,
        cta: cta,
        button: cta
      };
  }
}

/**
 * Apply rich copy onto config for every enabled blueprint section.
 */
function fillConfigFromUnderstanding(config, blueprint, brief, understanding, opts) {
  opts = opts || {};
  const merged = mergeBrief(brief, understanding);
  const cfg = JSON.parse(JSON.stringify(config || {}));
  cfg.sections = cfg.sections || {};
  const home = (blueprint && blueprint.pages && blueprint.pages[0]) || { sections: [] };
  const filledKeys = [];
  const skippedKeys = [];

  (home.sections || []).forEach(function (s) {
    if (!s || !s.key) return;
    if (s.enabled === false) {
      skippedKeys.push(s.key);
      return;
    }
    if (!cfg.sections[s.key] || typeof cfg.sections[s.key] !== 'object') {
      cfg.sections[s.key] = { on: true };
    }
    const sec = cfg.sections[s.key];
    if (opts.fillEmptyOnly) {
      const hasCopy = !!(sec.title || sec.heading || sec.sub || sec.intro || sec.blurb);
      if (hasCopy) {
        skippedKeys.push(s.key);
        return;
      }
    }
    const copy = richSectionCopy(s.key, merged);
    Object.keys(copy).forEach(function (k) {
      if (opts.fillEmptyOnly && sec[k]) return;
      sec[k] = copy[k];
    });
    sec.on = true;
    filledKeys.push(s.key);
  });

  cfg.name = merged.businessName || cfg.name;
  cfg.businessName = merged.businessName || cfg.businessName;
  cfg.trade = merged.trade || cfg.trade;
  if (merged.location) {
    cfg.region = merged.location;
    cfg.sections.seoTokens = Object.assign({}, cfg.sections.seoTokens || {}, {
      location: merged.location,
      city: merged.location,
      suburb: merged.location,
      region: merged.location,
      trade: merged.trade || '',
      business: merged.businessName || ''
    });
  }

  // Site-level services list for catalogue / SEO pages
  if (merged.services && merged.services.length) {
    cfg.services = merged.services.map(function (name, i) {
      return {
        id: 'svc-' + (i + 1),
        name: name,
        description: name + ' from ' + (merged.businessName || 'us') + ' across ' +
          (merged.location || 'your area') + '.'
      };
    });
  }

  cfg.layoutComposer = Object.assign({}, cfg.layoutComposer || {}, {
    understanding: {
      services: merged.services || [],
      customers: merged.customers || [],
      serviceAreas: merged.serviceAreas || [],
      differentiator: merged.differentiator || '',
      preferredCta: merged.preferredCta || '',
      tone: merged.tone || 'plain'
    },
    filledAt: new Date().toISOString()
  });

  return { config: cfg, filledKeys: filledKeys, skippedKeys: skippedKeys, brief: merged };
}

module.exports = {
  mergeBrief,
  richSectionCopy,
  fillConfigFromUnderstanding
};
