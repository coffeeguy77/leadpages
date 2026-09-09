'use strict';

/**
 * Layout-aware content fill — fills fields inside a confirmed blueprint only.
 * Never adds/removes/reorders pages or sections.
 */

const { assertStructureUnchanged } = require('./compile');
const { labelForSection } = require('./section-catalogue');

function deepClone(v) {
  return JSON.parse(JSON.stringify(v == null ? {} : v));
}

function placeholderCopy(sectionKey, brief) {
  const biz = (brief && brief.businessName) || 'Your business';
  const loc = (brief && brief.location) || 'your area';
  const trade = (brief && brief.trade) || 'local experts';
  const label = labelForSection(sectionKey);
  switch (sectionKey) {
    case 'hero':
      return {
        eyebrow: trade + ' · ' + loc,
        title: biz,
        titleHl: 'done properly',
        sub: 'Reliable ' + trade.toLowerCase() + ' for homes and businesses across ' + loc + '.',
      };
    case 'services':
      return {
        eyebrow: 'What we do',
        heading: 'Services across ' + loc,
        intro: biz + ' delivers practical ' + trade.toLowerCase() + ' work with clear communication.',
      };
    case 'why':
      return {
        eyebrow: 'Why ' + biz,
        heading: 'Local, accountable, tidy',
        items: [
          { title: 'Clear quotes', body: 'Know the plan before work starts.' },
          { title: 'Show up as booked', body: 'Respect for your time and property.' },
          { title: 'Workmanship care', body: 'We finish clean and explain what we did.' },
        ],
      };
    case 'reviews':
      return {
        eyebrow: 'From nearby customers',
        heading: 'Trusted around ' + loc,
        items: [
          { who: 'Sam T. — ' + loc, text: '"' + biz + ' were prompt and professional."' },
        ],
      };
    case 'faq':
      return {
        heading: 'Quick answers',
        items: [
          { q: 'Do you cover ' + loc + '?', a: 'Yes — ' + biz + ' regularly works across ' + loc + ' and nearby suburbs.' },
          { q: 'How fast can you quote?', a: 'Most standard jobs get a same-day call-back with a clear scope.' },
        ],
      };
    case 'quote':
      return {
        heading: 'Request a callback',
        sub: 'Tell us what you need in ' + loc + ' — we will get back quickly.',
        button: 'Send request',
      };
    case 'area':
      return {
        heading: 'Across ' + loc,
        intro: biz + ' helps customers throughout ' + loc + '.',
      };
    case 'footer':
      return {
        blurb: biz + ' — ' + trade + ' servicing ' + loc + '.',
      };
    default:
      return {
        heading: label,
        intro: 'Content for ' + label.toLowerCase() + ' — review and edit in the site editor.',
      };
  }
}

/**
 * Fill config.sections[*] copy fields from brief without changing order/toggles.
 * @returns {{ config: object, filledKeys: string[], skippedKeys: string[] }}
 */
function fillConfigFromBrief(config, blueprint, brief, opts) {
  opts = opts || {};
  if (opts.proposedBlueprint) {
    assertStructureUnchanged(blueprint, opts.proposedBlueprint);
  }
  const cfg = deepClone(config || {});
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
    const copy = placeholderCopy(s.key, brief);
    Object.keys(copy).forEach(function (k) {
      if (opts.fillEmptyOnly && sec[k]) return;
      sec[k] = copy[k];
    });
    sec.on = true;
    filledKeys.push(s.key);
  });

  if (brief && brief.businessName) {
    cfg.name = brief.businessName;
    cfg.businessName = brief.businessName;
  }
  if (brief && brief.trade) cfg.trade = brief.trade;
  if (brief && brief.location) {
    cfg.region = brief.location;
    cfg.sections.seoTokens = Object.assign({}, cfg.sections.seoTokens || {}, {
      location: brief.location,
      city: brief.location,
      suburb: brief.location,
      region: brief.location,
      trade: brief.trade || cfg.trade || '',
    });
  }

  return { config: cfg, filledKeys: filledKeys, skippedKeys: skippedKeys };
}

/**
 * Recommend landing pages from brief (checkbox list for Phase 5).
 */
function recommendLandingPages(brief) {
  const trade = (brief && brief.trade) || 'service';
  const loc = (brief && brief.location) || 'local';
  const slugTrade = String(trade).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'service';
  const slugLoc = String(loc).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'local';
  return [
    {
      id: 'svc-core',
      title: trade + ' in ' + loc,
      path: '/' + slugTrade + '-' + slugLoc,
      reason: 'Primary service + location landing for local SEO.',
      confidence: 0.86,
      selectedDefault: true,
    },
    {
      id: 'svc-emergency',
      title: 'Emergency ' + trade + ' ' + loc,
      path: '/emergency-' + slugTrade,
      reason: 'Capture urgent-intent searches without changing the homepage layout.',
      confidence: 0.72,
      selectedDefault: false,
    },
    {
      id: 'svc-suburb',
      title: trade + ' near you',
      path: '/areas/' + slugLoc,
      reason: 'Area hub that can later fan out to suburb pages.',
      confidence: 0.68,
      selectedDefault: true,
    },
  ];
}

/**
 * Lightweight “research” summary with source confidence (Phase 5).
 * Deterministic placeholder until Brain research is wired.
 */
function buildResearchBrief(brief) {
  const trade = (brief && brief.trade) || 'local trade';
  const loc = (brief && brief.location) || 'your area';
  return {
    ok: true,
    mode: 'deterministic_stub',
    summary:
      'Customers searching for ' + trade + ' in ' + loc +
      ' typically want fast response, clear pricing cues, proof of local work, and an easy way to request a callback.',
    angles: [
      { label: 'Speed to quote', confidence: 0.8 },
      { label: 'Local proof', confidence: 0.76 },
      { label: 'Emergency availability', confidence: 0.64 },
    ],
    sources: [
      {
        title: 'Internal trade pack patterns',
        confidence: 0.7,
        note: 'Derived from LeadPages community pack structure — not live web crawl.',
      },
      {
        title: 'Brief inputs',
        confidence: 0.9,
        note: 'Business name, trade, and location supplied by the user.',
      },
    ],
    disclaimer: 'Research is advisory. Confirm facts before publishing claims.',
  };
}

module.exports = {
  placeholderCopy,
  fillConfigFromBrief,
  recommendLandingPages,
  buildResearchBrief,
};
