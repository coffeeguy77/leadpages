'use strict';

/**
 * Structured SearchCanvas AI draft — OpenAI/Brain primary generation path.
 * Returns JSON only (no Markdown dump).
 */

const SEARCH_CANVAS_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['eyebrow', 'heading', 'intro', 'tabs'],
  properties: {
    eyebrow: { type: 'string' },
    heading: { type: 'string' },
    intro: { type: 'string' },
    tabs: {
      type: 'array',
      minItems: 3,
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'heading', 'intro', 'bullets'],
        properties: {
          label: { type: 'string' },
          iconSuggestion: { type: 'string' },
          heading: { type: 'string' },
          intro: { type: 'string' },
          supportingParagraphs: { type: 'array', items: { type: 'string' } },
          bullets: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
          linkLabel: { type: 'string' },
          suggestedInternalLinkType: { type: 'string' },
          imageSearchQuery: { type: 'string' },
          imageAltText: { type: 'string' }
        }
      }
    },
    cta: {
      type: 'object',
      additionalProperties: false,
      properties: {
        heading: { type: 'string' },
        text: { type: 'string' },
        buttonLabel: { type: 'string' }
      }
    },
    faqQuestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' }
        }
      }
    }
  }
};

const ICON_KEYS = [
  'leaf', 'hammer', 'brick-wall', 'house', 'wrench', 'droplet', 'map-pin', 'shield', 'star',
  'briefcase', 'scan-search', 'chart-bar', 'building', 'coffee', 'scissors', 'heart', 'laptop',
  'truck', 'calendar', 'users', 'check', 'zap', 'layers', 'toolbox'
];

function pickIcon(suggestion, label) {
  const s = String(suggestion || label || '').toLowerCase();
  const aliases = {
    wall: 'brick-wall',
    tool: 'wrench',
    search: 'scan-search',
    chart: 'chart-bar',
    sun: 'star',
    tree: 'leaf'
  };
  for (let i = 0; i < ICON_KEYS.length; i++) {
    if (s.indexOf(ICON_KEYS[i]) >= 0) return ICON_KEYS[i];
  }
  for (const [k, v] of Object.entries(aliases)) {
    if (s.indexOf(k) >= 0) return v;
  }
  if (/design|plan/.test(s)) return 'calendar';
  if (/wall|build|construct/.test(s)) return 'brick-wall';
  if (/garden|plant|landscape/.test(s)) return 'leaf';
  if (/water|tank|irrigation/.test(s)) return 'droplet';
  if (/maintain|care|service/.test(s)) return 'wrench';
  if (/support|team|people/.test(s)) return 'users';
  if (/local|area|suburb/.test(s)) return 'map-pin';
  return 'check';
}

function normalizeSearchCanvasDraft(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const tabsIn = Array.isArray(o.tabs) ? o.tabs : [];
  const tabs = tabsIn
    .map(function (t) {
      const x = t && typeof t === 'object' ? t : {};
      const bullets = Array.isArray(x.bullets)
        ? x.bullets.map(function (b) { return String(b || '').trim(); }).filter(Boolean).slice(0, 5)
        : [];
      while (bullets.length < 3) bullets.push('What’s included');
      const paras = Array.isArray(x.supportingParagraphs)
        ? x.supportingParagraphs.map(function (p) { return String(p || '').trim(); }).filter(Boolean).slice(0, 2)
        : [];
      return {
        label: String(x.label || x.heading || 'Service').trim().slice(0, 48),
        iconSuggestion: pickIcon(x.iconSuggestion, x.label || x.heading),
        heading: String(x.heading || x.label || 'Service').trim().slice(0, 80),
        intro: String(x.intro || '').trim(),
        supportingParagraphs: paras,
        bullets: bullets.slice(0, 5),
        linkLabel: String(x.linkLabel || '').trim().slice(0, 48),
        suggestedInternalLinkType: String(x.suggestedInternalLinkType || '').trim(),
        imageSearchQuery: String(x.imageSearchQuery || '').trim(),
        imageAltText: String(x.imageAltText || '').trim()
      };
    })
    .filter(function (t) { return t.label && t.intro; })
    .slice(0, 12);

  while (tabs.length < 3) {
    tabs.push({
      label: 'Service ' + (tabs.length + 1),
      iconSuggestion: 'check',
      heading: 'Service ' + (tabs.length + 1),
      intro: 'Describe this service clearly for visitors.',
      supportingParagraphs: [],
      bullets: ['Clear scope', 'Practical options', 'Local delivery', 'Next steps'],
      linkLabel: 'Learn more',
      suggestedInternalLinkType: '',
      imageSearchQuery: 'professional local service australia',
      imageAltText: 'Professional local service'
    });
  }

  const cta = o.cta && typeof o.cta === 'object' ? o.cta : null;
  const faqs = Array.isArray(o.faqQuestions)
    ? o.faqQuestions
        .map(function (f) {
          return {
            question: String((f && (f.question || f.q)) || '').trim(),
            answer: String((f && (f.answer || f.a)) || '').trim()
          };
        })
        .filter(function (f) { return f.question && f.answer; })
        .slice(0, 8)
    : [];

  return {
    eyebrow: String(o.eyebrow || 'Our expertise').trim().slice(0, 48),
    heading: String(o.heading || 'Solutions designed around your needs').trim().slice(0, 120),
    intro: String(o.intro || '').trim(),
    tabs: tabs,
    cta: cta
      ? {
          heading: String(cta.heading || '').trim(),
          text: String(cta.text || '').trim(),
          buttonLabel: String(cta.buttonLabel || cta.primaryLabel || '').trim()
        }
      : null,
    faqQuestions: faqs
  };
}

function buildSearchCanvasSystemPrompt() {
  return [
    'You are creating visible, people-first homepage content for a real business website.',
    'Create useful, specific and natural content based on the supplied business information.',
    'Return ONLY valid JSON matching the SearchCanvas schema. No Markdown. No combined text dump.',
    '',
    'TAB RULES (CRITICAL):',
    '- Each tab MUST be a real customer-facing SERVICE this business offers (e.g. Landscape Design, Retaining Walls, Water Tanks, Garden Maintenance).',
    '- NEVER use generic process labels like Planning, Delivery, Support, Maintenance, Consultation, Service 1.',
    '- MUST-INCLUDE SERVICES (from Extra information / Must-include list) ALWAYS get their own tabs — even if not in the site Services list.',
    '- If a Services list is supplied, use those service names as tab labels (you may tighten wording to 1–4 words).',
    '- Merge Services + Must-include into one tab list (dedupe). Prefer Must-include wording when they overlap.',
    '- If Services is empty, invent specific services that fit the business type, primary keyword, location AND Extra information.',
    '- Tabs are a service menu — not a generic how-we-work framework.',
    '',
    'PRIMARY KEYWORD RULES:',
    '- Use the exact primary keyword naturally in the main section heading OR introduction.',
    '- Use it once more in one appropriate supporting place.',
    '- Do not force the exact keyword into every tab.',
    '- Prefer natural semantic variations and related service wording elsewhere.',
    '- Avoid empty hype words (best, leading, number one, trusted, expert) unless supported by supplied facts.',
    '',
    'CONTENT RULES:',
    '- Australian English when the business is in Australia.',
    '- Clear, confident, practical language.',
    '- Do not invent licences, awards, prices, guarantees or experience.',
    '- Use Extra information when provided — treat named services there as required tabs.',
    '- 4–12 tabs (prefer the requested count). Never create filler tabs.',
    '- Each tab: label 1–4 words; heading 3–8 words; intro 45–80 words; 3–5 bullets of 3–9 words.',
    '- Provide iconSuggestion (stroke icon key), imageSearchQuery and imageAltText for every tab.',
    '- Optional closing CTA with heading, text and buttonLabel (default intent: quote form).',
    '- Optional faqQuestions (3–6) only if useful; answers must be factual from context.'
  ].join('\n');
}

function buildSearchCanvasUserPrompt(brief) {
  const b = brief || {};
  const services = Array.isArray(b.services) ? b.services.filter(Boolean) : [];
  const must = Array.isArray(b.mustIncludeServices) ? b.mustIncludeServices.filter(Boolean) : [];
  return [
    'Business name: ' + (b.businessName || ''),
    'Business type: ' + (b.businessType || b.trade || ''),
    'Primary keyword: ' + (b.primaryKeyword || ''),
    'Location: ' + (b.location || ''),
    'Services (use as tab labels when present): ' +
      (services.length ? services.join('; ') : '(none supplied)'),
    'MUST-INCLUDE SERVICES (create a tab for EACH of these — required): ' +
      (must.length ? must.join('; ') : '(none)'),
    'Existing pages: ' + (Array.isArray(b.pages) ? b.pages.join('; ') : String(b.pages || '')),
    'Extra information (read carefully — extract any services mentioned): ' + (b.extraInfo || '(none)'),
    'Requested tabs: ' + (b.tabCount || 5),
    'Tone: ' + (b.tone || 'practical and professional'),
    'Include CTA: ' + (b.includeCta !== false ? 'yes' : 'no'),
    'Include FAQ questions: ' + (b.includeFaq ? 'yes' : 'no'),
    '',
    'Create the SearchCanvas JSON now. Every MUST-INCLUDE service and every service named in Extra information must appear as its own tab.'
  ].join('\n');
}

function extractServicesFromExtraInfo(extra) {
  const text = String(extra || '').trim();
  if (!text) return [];
  const found = [];
  const seen = {};
  function push(s) {
    const t = String(s || '')
      .replace(/[.\s]+$/g, '')
      .replace(/^[\s\-•*]+/, '')
      .trim();
    if (!t || t.length < 3 || t.length > 48) return;
    const key = t.toLowerCase();
    if (seen[key]) return;
    // Skip generic process words
    if (/^(planning|delivery|support|maintenance|consultation|service)$/i.test(t)) return;
    seen[key] = 1;
    found.push(t);
  }
  // One-per-line lists
  text.split(/\n+/).forEach(function (line) {
    const m = line.match(/^\s*[-•*]?\s*(?:we\s+(?:also\s+)?(?:do|offer|provide|specialise in|specialize in)\s+)?(.+)$/i);
    if (m && !/[.!?]{2,}/.test(m[1]) && m[1].split(/\s+/).length <= 6) push(m[1]);
  });
  // "we do X", "we offer X and Y", "including X, Y and Z"
  const patterns = [
    /\bwe\s+(?:also\s+)?(?:do|offer|provide|install|supply)\s+([^.!?\n]+)/gi,
    /\bincluding\s+([^.!?\n]+)/gi,
    /\bspeciali[sz]e(?:s|d)?\s+in\s+([^.!?\n]+)/gi
  ];
  patterns.forEach(function (re) {
    let m;
    while ((m = re.exec(text))) {
      String(m[1] || '')
        .split(/\s*(?:,|;|\band\b|\+)\s*/i)
        .forEach(push);
    }
  });
  return found.slice(0, 12);
}

function servicesFromKeyword(kw, trade) {
  const s = (String(kw || '') + ' ' + String(trade || '')).toLowerCase();
  if (/landscape|landscap|garden|turf|lawn|outdoor/.test(s)) {
    return [
      'Landscape Design',
      'Retaining Walls',
      'Outdoor Living',
      'Garden Maintenance',
      'Water Tanks',
      'Rural Improvements'
    ];
  }
  if (/plumb/.test(s)) {
    return ['Blocked Drains', 'Hot Water', 'Leak Repairs', 'Tap & Toilet', 'Gas Fitting', 'Bathroom Plumbing'];
  }
  if (/electric/.test(s)) {
    return ['Switchboards', 'Power & Lighting', 'Fault Finding', 'EV Chargers', 'Safety Switches', 'Renovations'];
  }
  if (/roof/.test(s)) {
    return ['Re-roofing', 'Leak Repairs', 'Guttering', 'Roof Restorations', 'Skylights', 'Maintenance'];
  }
  if (/clean/.test(s)) {
    return ['Regular Cleans', 'End of Lease', 'Carpet Cleaning', 'Window Cleaning', 'Office Cleaning'];
  }
  if (/account|bookkeep|tax|bas/.test(s)) {
    return ['Tax Returns', 'BAS Lodgement', 'Bookkeeping', 'Business Advice', 'Payroll'];
  }
  // Last resort: split keyword into plausible service-shaped labels — still not Planning/Delivery.
  const base = String(kw || 'Local services').replace(/\b(in|near|for)\b/gi, ' ').trim();
  return [
    base,
    'Repairs & fixes',
    'New installs',
    'Maintenance plans',
    'On-site quotes'
  ].slice(0, 5);
}

function mockSearchCanvasDraft(brief) {
  const kw = String((brief && brief.primaryKeyword) || 'local services').trim();
  const loc = String((brief && brief.location) || 'your area').trim();
  const biz = String((brief && brief.businessName) || 'Our team').trim();
  const trade = String((brief && (brief.businessType || brief.trade)) || '').trim();
  const must = []
    .concat(Array.isArray(brief && brief.mustIncludeServices) ? brief.mustIncludeServices : [])
    .concat(extractServicesFromExtraInfo(brief && brief.extraInfo))
    .map(function (s) { return String(s || '').trim(); })
    .filter(Boolean);
  const fromBrief = Array.isArray(brief && brief.services)
    ? brief.services.map(function (s) { return String(s || '').trim(); }).filter(Boolean)
    : [];
  const seen = {};
  const merged = [];
  must.concat(fromBrief.length ? fromBrief : servicesFromKeyword(kw, trade)).forEach(function (s) {
    const k = s.toLowerCase();
    if (seen[k]) return;
    seen[k] = 1;
    merged.push(s);
  });
  const tabCount = Math.max(3, Math.min(12, Number(brief && brief.tabCount) || Math.max(5, must.length || 0)));
  const services = merged.slice(0, tabCount);
  return normalizeSearchCanvasDraft({
    eyebrow: 'Our expertise',
    heading: kw + (loc ? ' solutions in ' + loc : ' solutions'),
    intro:
      biz +
      ' helps customers' +
      (loc ? ' across ' + loc : '') +
      ' with practical ' +
      kw +
      ' support. Explore the services below to see what fits your project.',
    tabs: services.map(function (s) {
      const label = String(s).trim() || 'Service';
      return {
        label: label.split(/\s+/).slice(0, 4).join(' '),
        iconSuggestion: pickIcon('', label),
        heading: label,
        intro:
          'We provide ' +
          label.toLowerCase() +
          ' with clear communication and careful workmanship for homes and businesses' +
          (loc ? ' in ' + loc : '') +
          '. Tell us your goals and we will outline practical options that suit your site and budget.',
        supportingParagraphs: [],
        bullets: [
          'Clear scope of work',
          'Practical options',
          'Quality materials',
          'Local follow-through'
        ],
        linkLabel: 'View ' + label,
        imageSearchQuery: label.toLowerCase() + ' ' + loc + ' australia',
        imageAltText: label + (loc ? ' in ' + loc : '')
      };
    }),
    cta: {
      heading: 'Ready to talk through your project?',
      text: 'Share a few details and we will help you plan the next step with a clear, no-obligation conversation.',
      buttonLabel: 'Get a Free Quote'
    },
    faqQuestions: brief && brief.includeFaq
      ? [
          {
            question: 'Do you service ' + loc + '?',
            answer: 'Yes — we regularly work with customers in ' + loc + ' and nearby areas.'
          },
          {
            question: 'How do I get started?',
            answer: 'Tell us about your project and we will outline practical next steps and timing.'
          }
        ]
      : []
  });
}

module.exports = {
  SEARCH_CANVAS_DRAFT_SCHEMA,
  normalizeSearchCanvasDraft,
  buildSearchCanvasSystemPrompt,
  buildSearchCanvasUserPrompt,
  mockSearchCanvasDraft,
  servicesFromKeyword,
  extractServicesFromExtraInfo,
  pickIcon
};
