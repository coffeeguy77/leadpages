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
          supportingParagraphs: { type: 'array', items: { type: 'string' }, maxItems: 3 },
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
  if (/egg/.test(s)) return 'check';
  if (/beef|steak|brisket|carcass|butcher|mince|burger/.test(s)) return 'layers';
  if (/lamb|mutton/.test(s)) return 'leaf';
  if (/chicken|poultry|turkey|schnitzel/.test(s)) return 'star';
  if (/pie|pastry|quiche|pastie|pasty/.test(s)) return 'coffee';
  if (/sausage|small.?good|bacon|ham|smok|salami|prosciutto|devon|kransky|chorizo/.test(s)) return 'toolbox';
  if (/offal|liver|kidney|tripe|sweetbread/.test(s)) return 'layers';
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

function looksLikeSectionTitle(line) {
  const t = String(line || '').trim().replace(/^#{1,3}\s+/, '').trim();
  if (!t || t.length < 2 || t.length > 48) return false;
  if (/^(give me|view the|learn about|explore the|this is an overview)/i.test(t)) return false;
  if (/^(view|learn|explore)\s+the\s+/i.test(t)) return false;
  if (/\b(is|are|was|were|comes|offers|provides|includes|centres|center|stocks|makes|help|give)\b/i.test(t)) {
    return false;
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 5) return false;
  if (/[.!?]$/.test(t) && words.length > 2) return false;
  return /^[A-Za-z0-9]/.test(t);
}

function isSkippableExtraLine(line) {
  const t = String(line || '').trim();
  if (!t) return true;
  if (/^view the .+ range\.?$/i.test(t)) return true;
  if (/^learn about /i.test(t)) return true;
  if (/^explore the /i.test(t)) return true;
  if (/^give me a quick/i.test(t)) return true;
  return false;
}

/**
 * Parse pasted prose with section headings (e.g. Beef / Lamb / Chicken blocks).
 * @returns {{ title: string, body: string }[]}
 */
function parseExtraInfoSections(extra) {
  const text = String(extra || '').trim();
  if (!text) return [];
  const lines = text.split(/\n/);
  const sections = [];
  let current = null;
  let preamble = [];

  function flush() {
    if (!current) return;
    const body = String(current.body || '').trim();
    if (current.title && body) sections.push({ title: current.title, body: body });
    current = null;
  }

  lines.forEach(function (line) {
    const trimmed = String(line || '').trim();
    if (!trimmed) return;
    if (isSkippableExtraLine(trimmed)) return;
    if (looksLikeSectionTitle(trimmed)) {
      flush();
      current = { title: trimmed.replace(/^#{1,3}\s+/, '').trim(), body: '' };
      return;
    }
    if (current) {
      current.body += (current.body ? '\n' : '') + trimmed;
    } else if (trimmed.length > 60) {
      preamble.push(trimmed);
    }
  });
  flush();

  if (!sections.length && preamble.length) {
    return [];
  }
  return sections;
}

function parseExtraInfoOverview(extra) {
  const text = String(extra || '').trim();
  if (!text) return '';
  const sections = parseExtraInfoSections(text);
  if (!sections.length) return '';
  const last = sections[sections.length - 1];
  const lastStart = text.lastIndexOf(last.body);
  if (lastStart < 0) return '';
  const tail = text.slice(lastStart + last.body.length).trim();
  if (!tail || tail.length < 80) return '';
  const paras = tail.split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(Boolean);
  return paras.slice(0, 2).join('\n\n');
}

function introFromSectionBody(body, maxWords) {
  maxWords = maxWords || 95;
  const text = String(body || '').trim();
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [text];
  let intro = '';
  for (let i = 0; i < sentences.length; i++) {
    const next = (intro + sentences[i]).trim();
    if (next.split(/\s+/).length > maxWords && intro) break;
    intro = next;
    if (intro.split(/\s+/).length >= 40) break;
  }
  intro = intro.trim() || text.split(/\s+/).slice(0, maxWords).join(' ');
  if (intro.split(/\s+/).length > maxWords) {
    intro = intro.split(/\s+/).slice(0, maxWords).join(' ') + '…';
  }
  return intro;
}

function bulletsFromSectionBody(body, label) {
  const text = String(body || '');
  const bullets = [];
  const seen = {};
  function add(s) {
    const t = String(s || '')
      .replace(/^[\s\-•*]+/, '')
      .replace(/[.;:]+$/g, '')
      .trim();
    if (!t || t.length < 3 || t.length > 56) return;
    const key = t.toLowerCase();
    if (seen[key]) return;
    if (/^(and|or|the|with|from|including)$/i.test(t)) return;
    seen[key] = 1;
    bullets.push(t.charAt(0).toUpperCase() + t.slice(1));
  }
  const listMatch = text.match(/\b(?:includes?|including|range includes|selection includes|options include)\s+([^.!?\n]+)/i);
  if (listMatch && listMatch[1]) {
    String(listMatch[1])
      .split(/\s*(?:,|;|\band\b)\s*/i)
      .forEach(add);
  }
  const emDashLists = text.match(/(?:—|-)\s*([^.!?\n]{12,120})/g) || [];
  emDashLists.forEach(function (chunk) {
    String(chunk.replace(/^[\s—-]+/, ''))
      .split(/\s*(?:,|;|\band\b)\s*/i)
      .forEach(add);
  });
  if (bullets.length < 3) {
    const nouns = text.match(/\b(?:free[- ]range|grass[- ]fed|organic|wood[- ]smoked|handmade|whole carcass|preservative[- ]free|gluten[- ]free)[^.!?\n]*/gi) || [];
    nouns.slice(0, 3).forEach(function (n) { add(n.trim()); });
  }
  if (bullets.length < 3) {
    const fallbacks = ['Locally sourced', 'Whole-carcass butchery', 'Custom cuts on request', 'Traditional methods', 'Quality ingredients'];
    for (let i = 0; i < fallbacks.length && bullets.length < 3; i++) add(fallbacks[i]);
  }
  return bullets.slice(0, 5);
}

function formatStructuredSourceForPrompt(sections, overview) {
  if (!sections.length) return '';
  const blocks = sections.map(function (sec) {
    return '### ' + sec.title + '\n' + sec.body;
  });
  let out = blocks.join('\n\n---\n\n');
  if (overview) {
    out += '\n\n---\n\n### Business overview (use for main section intro)\n' + overview;
  }
  return out;
}

function buildSearchCanvasSystemPrompt() {
  return [
    'You are creating visible, people-first homepage content for a real business website.',
    'Create useful, specific and natural content based on the supplied business information.',
    'Return ONLY valid JSON matching the SearchCanvas schema. No Markdown. No combined text dump.',
    '',
    'TAB RULES (CRITICAL):',
    '- Each tab MUST be a real customer-facing SERVICE or PRODUCT CATEGORY this business offers.',
    '- NEVER use generic process labels like Planning, Delivery, Support, Maintenance, Consultation, Service 1.',
    '- MUST-INCLUDE SERVICES (from Extra information / Must-include list) ALWAYS get their own tabs — even if not in the site Services list.',
    '- When STRUCTURED SOURCE MATERIAL is provided, create exactly one tab per section (same order). Tab label = section title.',
    '- If a Services list is supplied, use those service names as tab labels (you may tighten wording to 1–4 words).',
    '- Merge Services + Must-include into one tab list (dedupe). Prefer Must-include wording when they overlap.',
    '- If Services is empty, derive tabs from STRUCTURED SOURCE MATERIAL or Extra information — never invent unrelated categories.',
    '- Tabs are a service menu — not a generic how-we-work framework.',
    '',
    'SOURCE FIDELITY (CRITICAL when STRUCTURED SOURCE MATERIAL is present):',
    '- Preserve specific facts: farm names, locations, dates, husbandry practices, product examples, and cut lists from the source.',
    '- Do NOT replace supplied detail with generic tradie/agency copy or invented claims.',
    '- intro: 2–3 sentences (55–100 words) faithful to that section\'s body.',
    '- supportingParagraphs: 0–2 short paragraphs with extra specifics from the same section (optional).',
    '- bullets: 4–5 items — specific products, cuts, varieties, or facts from that section (never generic filler like "Clear scope" or "Quality materials").',
    '- Main section intro: synthesise the business overview from supplied overview text when present.',
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
    '- Each tab: label 1–4 words; heading 3–8 words; intro 55–100 words; 3–5 bullets of 3–12 words.',
    '- Provide iconSuggestion (stroke icon key), imageSearchQuery and imageAltText for every tab.',
    '- Optional closing CTA with heading, text and buttonLabel (default intent: quote form).',
    '- Optional faqQuestions (3–6) only if useful; answers must be factual from context.'
  ].join('\n');
}

function buildSearchCanvasUserPrompt(brief) {
  const b = brief || {};
  const services = Array.isArray(b.services) ? b.services.filter(Boolean) : [];
  const must = Array.isArray(b.mustIncludeServices) ? b.mustIncludeServices.filter(Boolean) : [];
  const sections = Array.isArray(b.extraSections) ? b.extraSections : parseExtraInfoSections(b.extraInfo);
  const overview = b.extraOverview || parseExtraInfoOverview(b.extraInfo);
  const structured = formatStructuredSourceForPrompt(sections, overview);
  const lines = [
    'Business name: ' + (b.businessName || ''),
    'Business type: ' + (b.businessType || b.trade || ''),
    'Primary keyword: ' + (b.primaryKeyword || ''),
    'Location: ' + (b.location || ''),
    'Services (use as tab labels when present): ' +
      (services.length ? services.join('; ') : '(none supplied)'),
    'MUST-INCLUDE SERVICES (create a tab for EACH of these — required): ' +
      (must.length ? must.join('; ') : '(none)'),
    'Existing pages: ' + (Array.isArray(b.pages) ? b.pages.join('; ') : String(b.pages || '')),
    'Requested tabs: ' + (b.tabCount || 5),
    'Tone: ' + (b.tone || 'practical and professional'),
    'Include CTA: ' + (b.includeCta !== false ? 'yes' : 'no'),
    'Include FAQ questions: ' + (b.includeFaq ? 'yes' : 'no')
  ];
  if (structured) {
    lines.push('');
    lines.push('STRUCTURED SOURCE MATERIAL (CRITICAL — one tab per section below, preserve facts):');
    lines.push(structured);
  } else {
    lines.push('Extra information (read carefully — extract any services mentioned): ' + (b.extraInfo || '(none)'));
  }
  lines.push('');
  lines.push(
    'Create the SearchCanvas JSON now. Every MUST-INCLUDE service and every section in STRUCTURED SOURCE MATERIAL must appear as its own tab with faithful detail.'
  );
  return lines.join('\n');
}

function extractServicesFromExtraInfo(extra) {
  const sections = parseExtraInfoSections(extra);
  if (sections.length) {
    return sections.map(function (s) { return s.title; }).filter(Boolean);
  }
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
  if (/butcher|meat|beef|lamb|poultry|smallgood|deli/.test(s)) {
    return ['Beef', 'Lamb', 'Chicken', 'Pies', 'Smallgoods', 'Sausages'];
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
  const sections = Array.isArray(brief && brief.extraSections)
    ? brief.extraSections
    : parseExtraInfoSections(brief && brief.extraInfo);
  const overview = (brief && brief.extraOverview) || parseExtraInfoOverview(brief && brief.extraInfo);
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
  const tabCount = Math.max(3, Math.min(12, Number(brief && brief.tabCount) || Math.max(5, sections.length || must.length || 0)));
  const sectionByTitle = {};
  sections.forEach(function (sec) {
    sectionByTitle[String(sec.title || '').toLowerCase()] = sec;
  });
  const services = (sections.length ? sections.map(function (s) { return s.title; }) : merged).slice(0, tabCount);
  const headerIntro = overview
    ? introFromSectionBody(overview, 120)
    : biz +
      ' helps customers' +
      (loc ? ' across ' + loc : '') +
      ' with practical ' +
      kw +
      ' support. Explore the categories below to see what is available.';
  return normalizeSearchCanvasDraft({
    eyebrow: 'Our expertise',
    heading: kw + (loc ? ' in ' + loc : ''),
    intro: headerIntro,
    tabs: services.map(function (s) {
      const label = String(s).trim() || 'Service';
      const sec = sectionByTitle[label.toLowerCase()];
      const body = sec && sec.body ? sec.body : '';
      const intro = body
        ? introFromSectionBody(body, 95)
        : 'We provide ' +
          label.toLowerCase() +
          ' with clear communication and careful workmanship for homes and businesses' +
          (loc ? ' in ' + loc : '') +
          '. Tell us your goals and we will outline practical options that suit your needs.';
      const paras = [];
      if (body) {
        const rest = body.replace(intro, '').trim();
        if (rest && rest.length > 40) paras.push(rest.split(/\n{2,}/)[0].trim());
      }
      return {
        label: label.split(/\s+/).slice(0, 4).join(' '),
        iconSuggestion: pickIcon('', label),
        heading: label,
        intro: intro,
        supportingParagraphs: paras.slice(0, 2),
        bullets: body ? bulletsFromSectionBody(body, label) : ['Clear scope', 'Practical options', 'Quality ingredients', 'Local follow-through'],
        linkLabel: 'View ' + label,
        imageSearchQuery: (label + ' ' + (trade || kw) + ' ' + loc + ' australia').toLowerCase(),
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
  parseExtraInfoSections,
  parseExtraInfoOverview,
  bulletsFromSectionBody,
  introFromSectionBody,
  pickIcon
};
