/**
 * App content drafts — same brief as landing SEO (keyword, exclusions, extra notes)
 * but written for one section/app at a time. Draft first; the editor applies on approval.
 *
 * Not included: page title/meta, FAQ builder, hero/slider builders.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LP_APP_AI = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function clean(s, n) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n || 500);
  }

  /**
   * apply.scalars: draft field -> section field
   * apply.list: { key, map } on the section, or { root: 'services', map }
   * apply.tabs: SearchCanvas
   * apply.suburbs: write string[] from item labels
   * depth guides the model: line | cards | section | article
   */
  var APP_SPECS = {
    hero: {
      label: 'Hero',
      depth: 'section',
      purpose: 'Opening promise under the logo. One specific headline, a two-sentence subheading a visitor can act on, and short proof badges. Not a slider.',
      targetsHint: '',
      apply: {
        section: 'hero',
        scalars: { eyebrow: 'eyebrow', heading: 'title', highlight: 'titleHl', intro: 'sub' },
        list: { key: 'badges', map: { title: 'text' } }
      }
    },
    trustBar: {
      label: 'Trust Bar',
      depth: 'line',
      purpose: 'Trust Bar items. For classic badges: short label phrases. For image tiles: caption in title. For side image cards: title plus a one-line info sentence in text. Specific claims only — not slogans.',
      apply: {
        section: 'trustBar',
        list: { key: 'badges', map: { title: 'label', text: 'text' } }
      }
    },
    services: {
      label: 'Services',
      depth: 'cards',
      purpose: 'Service cards. Each card is one real offer: a clear title and a 40–70 word explanation of who it is for and what happens.',
      targetsHint: 'Card titles to write (comma-separated). Leave blank and the AI will propose 4–6 from the keyword.',
      apply: {
        section: 'services',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' },
        rootList: 'services',
        rootMap: { title: 'title', text: 'body' }
      }
    },
    serviceProcess: {
      label: 'How it works',
      depth: 'cards',
      purpose: 'The steps from first contact to finished work. 4–6 steps. Each step title is plain; the detail is 2–3 sentences a customer can follow.',
      targetsHint: 'Step names (comma-separated), or leave blank for a sensible path.',
      apply: {
        section: 'serviceProcess',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' },
        list: { key: 'steps', map: { title: 'title', text: 'text' } }
      }
    },
    featureStrip: {
      label: 'Feature strip',
      depth: 'cards',
      purpose: 'Horizontal reasons to choose this business. Each feature has a title and a 2-sentence detail grounded in the brief.',
      apply: {
        section: 'featureStrip',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' },
        list: { key: 'items', map: { title: 'title', text: 'text' } }
      }
    },
    why: {
      label: 'Why us',
      depth: 'cards',
      purpose: 'Reasons this business is the right choice. Each reason is a heading plus a substantial paragraph (about 50 words), not a slogan.',
      apply: {
        section: 'why',
        scalars: { eyebrow: 'eyebrow', heading: 'heading' },
        list: { key: 'items', map: { title: 'title', text: 'body' } }
      }
    },
    area: {
      label: 'Service area',
      depth: 'section',
      purpose: 'Where you work. Intro explains coverage in plain language. Suburb list only includes places named in the brief or obvious parts of the location — do not invent a fake suburb directory.',
      targetsHint: 'Suburbs or areas to name (comma-separated).',
      apply: {
        section: 'area',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' },
        suburbs: true
      }
    },
    serviceAreas: {
      label: 'Service areas',
      depth: 'section',
      purpose: 'Suburb coverage grid plus an intro. Only name places from the brief or the location.',
      targetsHint: 'Place names (comma-separated).',
      apply: {
        section: 'serviceAreas',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' },
        list: { key: 'areas', map: { title: 'name' } }
      }
    },
    serviceAreaMap: {
      label: 'Service area map',
      depth: 'section',
      purpose: 'Map section intro plus the same suburb names used as pins. Do not invent coordinates.',
      targetsHint: 'Place names (comma-separated).',
      apply: {
        section: 'serviceAreaMap',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' },
        alsoList: { section: 'serviceAreas', key: 'areas', map: { title: 'name' } }
      }
    },
    reviews: {
      label: 'Reviews',
      depth: 'cards',
      sample: true,
      purpose: 'Sample review cards that sound like real customers talking about this specific service. Mark them as samples — never claim they are verified reviews. 3–4 quotes, each 2–4 sentences with a concrete detail.',
      apply: {
        section: 'reviews',
        scalars: { eyebrow: 'eyebrow', heading: 'heading' },
        list: { key: 'items', map: { title: 'who', text: 'text' } }
      }
    },
    reviewHighlights: {
      label: 'Review highlights',
      depth: 'cards',
      sample: true,
      purpose: 'Short standout sample quotes. Each quote is specific to the keyword. Label the person as a sample, not a real named customer unless the brief names them.',
      apply: {
        section: 'reviewHighlights',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' },
        list: { key: 'items', map: { title: 'who', text: 'text' } }
      }
    },
    customerReactions: {
      label: 'Customer reactions',
      depth: 'cards',
      sample: true,
      purpose: 'Sample messages (Google-style or SMS-style) about this service. Specific, human, not generic praise. These are drafts to replace with real messages.',
      apply: {
        section: 'customerReactions',
        list: { key: 'items', map: { title: 'name', text: 'message' } }
      }
    },
    beforeAfter: {
      label: 'Before & after',
      depth: 'cards',
      purpose: 'Project story cards. Title names the job; caption is 2–3 sentences describing the problem and the result. Do not invent image URLs.',
      apply: {
        section: 'beforeAfter',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' },
        list: { key: 'items', map: { title: 'title', text: 'caption' } }
      }
    },
    beforeAfterFeed: {
      label: 'Before/after feed',
      depth: 'cards',
      purpose: 'A feed of recent transformations. Title, place if known, and a caption that tells the story. No fake image URLs.',
      apply: {
        section: 'beforeAfterFeed',
        list: { key: 'items', map: { title: 'title', text: 'caption', label: 'location' } }
      }
    },
    responseCards: {
      label: 'Response cards',
      depth: 'cards',
      purpose: 'Trust and urgency cards under the hero. Title plus a 2-sentence explanation tied to how this business actually works.',
      apply: {
        section: 'responseCards',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' },
        list: { key: 'cards', map: { title: 'title', text: 'text' } }
      }
    },
    projectStats: {
      label: 'Project stats',
      depth: 'line',
      purpose: 'Credibility stats. Write the label (what the number means). Put a number in value ONLY if the brief states it. Otherwise set value to an em dash so the owner fills the real figure. Never invent years, review counts, or team size.',
      apply: {
        section: 'projectStats',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' },
        list: { key: 'stats', map: { title: 'label', value: 'value' } }
      }
    },
    activityCounter: {
      label: 'Activity counter',
      depth: 'line',
      purpose: 'Live-looking counters. Labels only unless the brief gives real numbers. Do not invent “387 happy customers”.',
      apply: {
        section: 'activityCounter',
        list: { key: 'stats', map: { title: 'label', value: 'value' } }
      }
    },
    featuredProjects: {
      label: 'Project portfolio',
      depth: 'cards',
      purpose: 'Portfolio cards. Each project has a title, a tag (type of work), a location only if known, and a 50-word description of the work. No fake photos.',
      apply: {
        section: 'featuredProjects',
        list: { key: 'projects', map: { title: 'title', label: 'tag', text: 'description', who: 'location' } }
      }
    },
    projectFeed: {
      label: 'Project feed',
      depth: 'cards',
      purpose: 'Recent-work feed captions. Title, service type, and a caption that reads like a job update, not an ad slogan.',
      apply: {
        section: 'projectFeed',
        list: { key: 'items', map: { title: 'title', label: 'service', text: 'caption', who: 'location' } }
      }
    },
    jobsFeed: {
      label: 'Jobs feed',
      depth: 'cards',
      purpose: 'Completed-job cards. Title is the job, result is 1–2 sentences on what was done. Do not invent street addresses.',
      apply: {
        section: 'jobsFeed',
        list: { key: 'items', map: { title: 'title', text: 'result', label: 'location' } }
      }
    },
    specialOffer: {
      label: 'Special offer',
      depth: 'section',
      purpose: 'One honest offer. Heading, intro, and 3–4 tick points. Do not invent discounts or deadlines that are not in the brief.',
      apply: {
        section: 'specialOffer',
        scalars: { heading: 'heading', intro: 'intro', button: 'cta' },
        list: { key: 'points', map: { text: 'text' } }
      }
    },
    promotions: {
      label: 'Promotions',
      depth: 'cards',
      purpose: 'Offer titles and descriptions only. Do not invent countdown dates, spot counts, or dollar discounts unless the brief states them.',
      apply: {
        section: 'promotions',
        list: { key: 'items', map: { title: 'title', text: 'description' } }
      }
    },
    proofStream: {
      label: 'Proof stream',
      depth: 'cards',
      purpose: 'A mix of job notes and sample quotes. Each item has a title and a specific sentence. Sample reviews must not pretend to be verified.',
      apply: {
        section: 'proofStream',
        list: { key: 'items', map: { title: 'title', text: 'text', who: 'who', label: 'location' } }
      }
    },
    crew: {
      label: 'Team',
      depth: 'cards',
      purpose: 'Team cards. Use real names and roles from the brief. If names are unknown, use roles only (Owner, Technician) and say the name should be added — do not invent personal biographies or years of experience.',
      apply: {
        section: 'crew',
        scalars: { heading: 'heading', intro: 'intro' },
        list: { key: 'members', map: { title: 'name', label: 'role', text: 'detail' } }
      }
    },
    certifications: {
      label: 'Certifications',
      depth: 'cards',
      purpose: 'Licence and insurance rows. Describe what to show. Leave licence numbers blank unless the brief includes them. Never invent an ABN, licence number, or insurer.',
      apply: {
        section: 'certifications',
        list: { key: 'items', map: { title: 'name', text: 'body' } }
      }
    },
    estimateBuilder: {
      label: 'Estimate builder',
      depth: 'cards',
      purpose: 'Wizard choices grouped into steps (what they need, timing, access). Labels only. Do not invent dollar min/max.',
      targetsHint: 'Steps or choices (comma-separated).',
      apply: {
        section: 'estimateBuilder',
        list: { key: 'options', map: { label: 'step', title: 'label' } }
      }
    },
    quote: {
      label: 'Quote form',
      depth: 'section',
      purpose: 'Quote section copy: heading, supporting paragraph, button, trust ticks beside the form, and dropdown job types that match the keyword. No page title or meta.',
      targetsHint: 'Job types for the dropdown (comma-separated).',
      apply: {
        section: 'quote',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'sub', button: 'button' },
        list: { key: 'points', map: { text: 'text' } },
        optionsList: { section: 'quote', key: 'jobOptions', map: { title: 'text' } }
      }
    },
    onlineQuote: {
      label: 'Online quote',
      depth: 'section',
      purpose: 'Intro to the quote wizard. Explain what the visitor will tell you and what they get back. Do not invent prices.',
      apply: {
        section: 'onlineQuote',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' }
      }
    },
    finance: {
      label: 'Finance options',
      depth: 'section',
      purpose: 'Explain how payment or finance works in plain language. Do not invent weekly amounts, interest rates, or lender names unless the brief states them.',
      apply: {
        section: 'finance',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'description', body: 'disclaimer' }
      }
    },
    textBox: {
      label: 'Text box',
      depth: 'article',
      purpose: 'A readable block of on-page copy: short intro plus 250–400 words in content, with natural mentions of the service and place. Break into paragraphs. No FAQ list, no title tag.',
      apply: {
        section: 'textBox',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro', body: 'content' }
      }
    },
    seoText: {
      label: 'SEO text',
      depth: 'article',
      purpose: 'Homepage article copy only (not the Google title or meta). One H1, one supporting H2, a short intro, then 300–450 words of useful body in content. Answer what the service is, who it is for, how it is done, and the area. No FAQ block inside the body.',
      apply: {
        section: 'seoText',
        scalars: { heading: 'h1', highlight: 'h2', intro: 'intro', body: 'content' }
      }
    },
    videoReels: {
      label: 'Video reels',
      depth: 'line',
      purpose: 'Reel titles and tags that describe real kinds of jobs. Do not invent video URLs.',
      apply: {
        section: 'videoReels',
        list: { key: 'reels', map: { title: 'title', label: 'tag' } }
      }
    },
    activityTimeline: {
      label: 'Activity timeline',
      depth: 'cards',
      purpose: 'A sample day of jobs. Task names match the keyword. Do not invent exact street addresses or pretend this is a live feed.',
      apply: {
        section: 'activityTimeline',
        list: { key: 'events', map: { title: 'task', label: 'location', value: 'time' } }
      }
    },
    footer: {
      label: 'Footer',
      depth: 'section',
      purpose: 'Footer about blurb (2–3 sentences) and service link labels. Do not invent a licence number.',
      apply: {
        section: 'footer',
        scalars: { body: 'blurb' },
        list: { key: 'services', map: { title: 'label' } }
      }
    },
    emerg: {
      label: 'Top bar',
      depth: 'line',
      purpose: 'One line for the top bar. Specific and calm, not shouty keyword stuffing.',
      apply: {
        section: 'emerg',
        scalars: { heading: 'text' }
      }
    },
    searchCanvas: {
      label: 'SearchCanvas',
      depth: 'article',
      purpose: 'Tabbed expertise that replaces the empty placeholder. Section eyebrow, heading and intro, then one tab per topic. Each item: label = short tab name, title = tab heading, text = 90–140 word intro a visitor can quote, body = 120–180 more words of useful detail (blank line between paragraphs), bullets = exactly 4 concrete points. Do not invent images.',
      targetsHint: 'Tab labels to write (comma-separated), e.g. Metal roof vents, Ridge vents, Flashings.',
      apply: { searchCanvas: true }
    },
    emergencyAvailability: {
      label: 'Emergency availability',
      depth: 'section',
      purpose: 'Honest hours copy. heading and intro explain when someone can reach you. eyebrow = the “available” label, highlight = the response-time line, button = the after-hours label, body = the after-hours message, blurb = a short emergency note. Do not invent a 24/7 promise or a minute count unless the brief says so.',
      apply: {
        section: 'emergencyAvailability',
        scalars: {
          heading: 'heading',
          intro: 'intro',
          eyebrow: 'availableLabel',
          highlight: 'responseText',
          button: 'afterHoursLabel',
          body: 'afterHoursText',
          blurb: 'emergencyText'
        }
      }
    },
    instaGallery: {
      label: 'Instagram gallery',
      depth: 'section',
      purpose: 'Only the heading above the live Instagram grid. Eyebrow, heading, and a 2–3 sentence intro about the kind of work the photos show. Do not invent posts, handles, hashtags, or image URLs.',
      apply: {
        section: 'instaGallery',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' }
      }
    },
    igProjectFeed: {
      label: 'Instagram project feed',
      depth: 'section',
      purpose: 'Heading block above Instagram project tiles, plus three button labels. Put callLabel, quoteLabel and linkLabel in items as label, with the button wording in title (2–4 words). Do not invent posts.',
      targetsHint: 'Optional button wording, or leave blank.',
      apply: {
        section: 'igProjectFeed',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' },
        labelFields: ['callLabel', 'quoteLabel', 'linkLabel']
      }
    },
    orderStorefront: {
      label: 'Order storefront',
      depth: 'section',
      purpose: 'Intro to the on-site shop. Eyebrow, heading, and an intro of 60–100 words on what can be ordered and how pickup or delivery works — only if the brief says. Do not invent prices, products, or minimums.',
      apply: {
        section: 'orderStorefront',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro' }
      }
    },
    bookingStorefront: {
      label: 'Bookings',
      depth: 'section',
      purpose: 'Call-to-action into the booking page. Eyebrow, heading, a 60–100 word intro on what can be booked, and a short button label. Do not invent prices, time slots, or staff names.',
      apply: {
        section: 'bookingStorefront',
        scalars: { eyebrow: 'eyebrow', heading: 'heading', intro: 'intro', button: 'ctaLabel' }
      }
    },
    premiumGallery: {
      label: 'Premium gallery',
      depth: 'section',
      purpose: 'Gallery heading only. Eyebrow, heading, intro (what the photos show), body as a short supporting line, highlight as a small badge only if the brief earns it, and a button label. Do not invent image URLs or project counts.',
      apply: {
        section: 'premiumGallery',
        scalars: {
          eyebrow: 'eyebrow',
          heading: 'heading',
          intro: 'intro',
          body: 'supporting',
          highlight: 'badge',
          button: 'ctaText'
        }
      }
    },
    scrollingSponsorBanner: {
      label: 'Scrolling sponsor banner',
      depth: 'section',
      purpose: 'Heading above an existing logo strip. Eyebrow, heading, and a one- or two-sentence intro. Do not invent sponsor names, logos, or links.',
      apply: { sponsorHeading: true }
    },
    mobileBar: {
      label: 'Mobile bar',
      depth: 'line',
      purpose: 'Short button labels only. items use label exactly call, directions, message, mail, or custom, and title as 1–3 words. Do not invent phone numbers or URLs.',
      targetsHint: 'Buttons to label: call, directions, message, mail, custom.',
      apply: { mobileBar: true }
    },
    lpFooter: {
      label: 'LeadPages footer',
      depth: 'line',
      purpose: 'One optional caption beside the LeadPages logo. Put it in heading, under 80 characters. Do not invent a slogan that fights the brand.',
      apply: {
        section: 'lpFooter',
        scalars: { heading: 'text' }
      }
    }
  };

  var SKIP = {
    faq: 'FAQ has its own builder.',
    heroSlider: 'Slider builder is separate.',
    heroBeforeAfter: 'Slider builder is separate.',
    splitHero: 'Slider builder is separate.',
    seoTokens: 'Page title and meta stay on the landing SEO generator.',
    details: 'Business details are not generated section copy.',
    branding: 'Colours and type, not section copy.',
    logo: 'Logo upload, not section copy.',
    sectionOrder: 'Layout order, not copy.',
    navMenu: 'Menu destinations stay yours — this tool does not invent links.',
    customHtml: 'Custom HTML is code. This tool does not write script or markup.'
  };

  function spec(appKey) {
    return APP_SPECS[appKey] || null;
  }

  function writingBrief(appKey) {
    var s = spec(appKey);
    if (!s) return '';
    return [
      'App: ' + s.label + ' (' + appKey + ')',
      'Depth: ' + s.depth,
      'Job: ' + s.purpose,
      s.targetsHint ? 'If the user lists what to write, use those exact names. Do not rename them and do not add extras.' : '',
      s.sample ? 'SAMPLE COPY: summary must say the owner should replace this with real proof. Use roles, not fake full names.' : '',
      'Leave every JSON string you do not need as "".'
    ].filter(Boolean).join('\n');
  }

  var SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'items'],
    properties: {
      summary: { type: 'string' },
      eyebrow: { type: 'string' },
      heading: { type: 'string' },
      highlight: { type: 'string' },
      intro: { type: 'string' },
      sub: { type: 'string' },
      button: { type: 'string' },
      body: { type: 'string' },
      blurb: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            text: { type: 'string' },
            body: { type: 'string' },
            label: { type: 'string' },
            who: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
            caption: { type: 'string' },
            value: { type: 'string' },
            bullets: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      options: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            text: { type: 'string' }
          }
        }
      }
    }
  };

  function normalizeDraft(raw) {
    var o = raw && typeof raw === 'object' ? raw : {};
    var items = Array.isArray(o.items) ? o.items : [];
    return {
      summary: clean(o.summary, 400),
      eyebrow: clean(o.eyebrow, 80),
      heading: clean(o.heading, 160),
      highlight: clean(o.highlight, 80),
      intro: clean(o.intro, 2000),
      sub: clean(o.sub, 400),
      button: clean(o.button, 40),
      body: String(o.body || '').trim().slice(0, 6000),
      blurb: clean(o.blurb, 500),
      items: items.slice(0, 8).map(function (it) {
        it = it || {};
        var bullets = [];
        if (Array.isArray(it.bullets)) {
          bullets = it.bullets.map(function (b) {
            if (b && typeof b === 'object') return clean(b.text || b.title, 200);
            return clean(b, 200);
          }).filter(Boolean).slice(0, 6);
        }
        var text = String(it.text || '').trim();
        var body = String(it.body || '').trim();
        if (!text && it.caption) text = String(it.caption).trim();
        if (!text && body) {
          text = body;
          body = '';
        }
        if (!bullets.length && text.indexOf('\n') >= 0) {
          var parts = text.split(/\n+/).map(function (x) {
            return x.replace(/^[-*•]\s*/, '').trim();
          }).filter(Boolean);
          if (parts.length > 1) {
            text = parts[0];
            bullets = parts.slice(1, 7).map(function (x) { return clean(x, 200); });
          }
        }
        return {
          title: clean(it.title, 140),
          text: text.slice(0, 2500),
          body: body.slice(0, 4000),
          label: clean(it.label || it.role || it.name, 80),
          who: clean(it.who, 80),
          value: clean(it.value, 40),
          bullets: bullets
        };
      }).filter(function (it) { return it.title || it.text || it.label || it.body; }),
      options: (Array.isArray(o.options) ? o.options : []).slice(0, 8).map(function (it) {
        it = it || {};
        return { title: clean(it.title || it.text, 80) };
      }).filter(function (it) { return it.title; })
    };
  }

  function ensureSec(cfg, id) {
    if (!cfg.sections) cfg.sections = {};
    if (!cfg.sections[id] || typeof cfg.sections[id] !== 'object') cfg.sections[id] = {};
    return cfg.sections[id];
  }

  function rowHasMedia(row) {
    if (!row || typeof row !== 'object') return false;
    var keys = ['image', 'imageUrl', 'src', 'photo', 'videoUrl', 'thumbnail', 'images', 'logo', 'logoUrl'];
    return keys.some(function (k) {
      var v = row[k];
      if (Array.isArray(v)) return v.length > 0;
      return !!(v && String(v).trim());
    });
  }

  function mergeList(existing, incoming, map) {
    var cur = Array.isArray(existing) ? existing.map(function (x) { return Object.assign({}, x); }) : [];
    incoming.forEach(function (src, i) {
      var row = cur[i] ? cur[i] : { on: true };
      Object.keys(map).forEach(function (from) {
        var to = map[from];
        var val = src[from];
        if (val) row[to] = val;
      });
      if (row.on == null) row.on = true;
      if (!cur[i]) cur.push(row);
      else cur[i] = row;
    });
    if (incoming.length && cur.length > incoming.length) {
      var head = cur.slice(0, incoming.length);
      var tail = cur.slice(incoming.length).filter(rowHasMedia);
      cur = head.concat(tail);
    }
    return cur;
  }

  function itemSrc(it) {
    return {
      title: it.title,
      text: it.text,
      label: it.label,
      who: it.who,
      value: it.value
    };
  }

  function applyAppContent(config, appKey, draft) {
    var s = spec(appKey);
    if (!s) {
      var err = new Error('Unknown app: ' + appKey);
      err.code = 'unknown_app';
      throw err;
    }
    var cfg = config || {};
    var d = normalizeDraft(draft);
    var apply = s.apply || {};
    if (apply.section) {
      var sec = ensureSec(cfg, apply.section);
      sec.on = true;
      if (apply.scalars) {
        Object.keys(apply.scalars).forEach(function (from) {
          if (d[from]) sec[apply.scalars[from]] = d[from];
        });
      }
    }
    if (apply.list) {
      var host = ensureSec(cfg, apply.section || appKey);
      host[apply.list.key] = mergeList(host[apply.list.key], d.items.map(itemSrc), apply.list.map);
      host.on = true;
    }
    if (apply.rootList) {
      var mapped = d.items.map(itemSrc);
      var rootMap = apply.rootMap || { title: 'title', text: 'body' };
      cfg[apply.rootList] = mergeList(cfg[apply.rootList], mapped, rootMap);
      if (apply.section) {
        var mirror = ensureSec(cfg, apply.section);
        mirror.items = mergeList(mirror.items, mapped, rootMap);
        mirror.on = true;
      }
    }
    if (apply.alsoList) {
      var host2 = ensureSec(cfg, apply.alsoList.section);
      host2[apply.alsoList.key] = mergeList(host2[apply.alsoList.key], d.items.map(itemSrc), apply.alsoList.map);
    }
    if (apply.optionsList && d.options.length) {
      var host3 = ensureSec(cfg, apply.optionsList.section);
      host3[apply.optionsList.key] = mergeList(host3[apply.optionsList.key], d.options, apply.optionsList.map);
    }
    if (apply.suburbs) {
      var names = d.items.map(function (it) { return it.title || it.label; }).filter(Boolean);
      if (names.length) ensureSec(cfg, 'area').suburbs = names;
    }
    if (apply.searchCanvas) {
      var sc = ensureSec(cfg, 'searchCanvas');
      sc.on = true;
      if (!sc.header) sc.header = {};
      if (d.eyebrow) sc.header.eyebrow = d.eyebrow;
      if (d.heading) sc.header.heading = d.heading;
      if (d.intro) sc.header.intro = d.intro;
      var prevTabs = Array.isArray(sc.tabs) ? sc.tabs.slice() : [];
      if (d.items.length) {
        sc.tabs = d.items.map(function (it, i) {
        var prev = prevTabs[i] || {};
        return Object.assign({}, prev, {
          id: prev.id || ('tab-ai-' + (i + 1)),
          on: true,
          label: it.label || it.title || ('Topic ' + (i + 1)),
          heading: it.title || it.label || '',
          intro: it.text || '',
          content: it.body || '',
          bullets: (it.bullets && it.bullets.length) ? it.bullets.slice() : []
        });
        });
      }
      if (sc.tabs && sc.tabs[0]) sc.defaultTabId = sc.tabs[0].id;
    }
    if (apply.sponsorHeading) {
      var ssb = ensureSec(cfg, 'scrollingSponsorBanner');
      ssb.on = true;
      if (!Array.isArray(ssb.instances)) ssb.instances = [];
      if (!ssb.instances[0]) ssb.instances.push({ enabled: true, logos: [], heading: {} });
      var inst = ssb.instances[0];
      if (!inst.heading || typeof inst.heading !== 'object') inst.heading = {};
      if (d.eyebrow) inst.heading.eyebrow = d.eyebrow;
      if (d.heading) inst.heading.title = d.heading;
      if (d.intro) inst.heading.intro = d.intro;
    }
    if (apply.mobileBar) {
      var mb = ensureSec(cfg, 'mobileBar');
      mb.on = true;
      if (!mb.buttons || typeof mb.buttons !== 'object') mb.buttons = {};
      var allowedBtn = { call: 1, directions: 1, message: 1, mail: 1, custom: 1 };
      d.items.forEach(function (it) {
        var key = String(it.label || '').toLowerCase();
        if (!allowedBtn[key] || !it.title) return;
        if (!mb.buttons[key] || typeof mb.buttons[key] !== 'object') mb.buttons[key] = { on: true };
        mb.buttons[key].label = it.title;
        if (mb.buttons[key].on == null) mb.buttons[key].on = true;
      });
    }
    if (apply.labelFields) {
      var labelled = ensureSec(cfg, apply.section || appKey);
      labelled.on = true;
      d.items.forEach(function (it) {
        if (apply.labelFields.indexOf(it.label) >= 0 && it.title) labelled[it.label] = it.title;
      });
    }
    return { appKey: appKey, summary: d.summary, itemCount: d.items.length };
  }

  function previewHtml(appKey, draft) {
    var d = normalizeDraft(draft);
    var s = spec(appKey);
    var bits = [];
    if (s && s.sample) {
      bits.push('<p class="hint">Sample wording only — replace with real reviews or messages before you treat this as proof.</p>');
    }
    if (d.summary) bits.push('<p><strong>Draft:</strong> ' + esc(d.summary) + '</p>');
    ['eyebrow', 'heading', 'highlight', 'intro', 'button'].forEach(function (k) {
      if (d[k]) bits.push('<p><strong>' + k + ':</strong> ' + esc(d[k]) + '</p>');
    });
    if (d.body) {
      bits.push('<p><strong>Body:</strong></p><div style="white-space:pre-wrap;font-size:14px;line-height:1.45;">' + esc(d.body.slice(0, 1600)) + (d.body.length > 1600 ? '…' : '') + '</div>');
    }
    if (d.items.length) {
      bits.push('<ul>' + d.items.map(function (it) {
        var extra = it.bullets && it.bullets.length ? ' · ' + it.bullets.join('; ') : '';
        var more = it.body ? ' ' + it.body.slice(0, 180) : '';
        return '<li><strong>' + esc(it.title || it.label || 'Item') + '</strong> — ' + esc((it.text || '').slice(0, 280)) + esc(more) + esc(extra) + '</li>';
      }).join('') + '</ul>');
    }
    return bits.join('') || '<p class="hint">Empty draft.</p>';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mount(body, appKey, ctx) {
    if (!body || !spec(appKey) || body.querySelector('[data-app-ai="' + appKey + '"]')) return;
    ctx = ctx || {};
    var s = spec(appKey);
    var card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-app-ai', appKey);
    card.style.marginBottom = '22px';
    var targets = s.targetsHint
      ? '<div class="f" style="margin:0 0 10px"><label for="aca-targets">What to write</label><input id="aca-targets" class="tin" type="text" placeholder="' + esc(s.targetsHint) + '"></div>'
      : '';
    card.innerHTML =
      '<h2 style="margin:0 0 4px">Write this section with AI</h2>' +
      '<p class="lede" style="margin:0 0 12px">Same brief as a landing page: primary keyword, exclusions, and extra notes. You get a draft to review before it fills <strong>' + esc(s.label) + '</strong>. No page title, no FAQ block, no slider.</p>' +
      '<div class="row" style="gap:10px;flex-wrap:wrap;margin:0 0 10px">' +
      '<div class="f" style="margin:0;flex:1;min-width:180px"><label for="aca-kw">Primary keyword</label><input id="aca-kw" class="tin" type="text" placeholder="e.g. metal roof ventilators Australia"></div>' +
      '<div class="f" style="margin:0;flex:1;min-width:140px"><label for="aca-loc">Location</label><input id="aca-loc" class="tin" type="text" placeholder="e.g. Australia"></div>' +
      '</div>' +
      '<div class="f" style="margin:0 0 10px"><label for="aca-neg">Exclusions</label><input id="aca-neg" class="tin" type="text" placeholder="Hard ban, comma-separated — topics this section must never mention"></div>' +
      targets +
      '<div class="f" style="margin:0 0 10px"><label for="aca-extra">More information</label><textarea id="aca-extra" class="tin" rows="3" placeholder="Who you sell to, materials, what makes the offer different, facts the copy must keep."></textarea></div>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">' +
      '<button type="button" class="btn sm" id="aca-go">Generate draft</button>' +
      '<span class="hint" id="aca-note"></span></div>' +
      '<div id="aca-preview" hidden style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)"></div>';
    body.insertBefore(card, body.firstChild);

    var storeKey = 'lp_app_ai_' + String(ctx.siteId || '') + '_' + appKey;
    try {
      var saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
      if (saved) {
        if (card.querySelector('#aca-kw')) card.querySelector('#aca-kw').value = saved.primaryKeyword || '';
        if (card.querySelector('#aca-loc')) card.querySelector('#aca-loc').value = saved.location || '';
        if (card.querySelector('#aca-neg')) card.querySelector('#aca-neg').value = saved.negativeKeywords || '';
        if (card.querySelector('#aca-extra')) card.querySelector('#aca-extra').value = saved.extraInfo || '';
        if (card.querySelector('#aca-targets')) card.querySelector('#aca-targets').value = saved.targets || '';
      }
    } catch (_e) {}

    var btn = card.querySelector('#aca-go');
    var note = card.querySelector('#aca-note');
    var preview = card.querySelector('#aca-preview');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var payload = {
        appKey: appKey,
        primaryKeyword: (card.querySelector('#aca-kw').value || '').trim(),
        location: (card.querySelector('#aca-loc').value || '').trim(),
        negativeKeywords: (card.querySelector('#aca-neg').value || '').trim(),
        extraInfo: (card.querySelector('#aca-extra').value || '').trim(),
        targets: card.querySelector('#aca-targets') ? (card.querySelector('#aca-targets').value || '').trim() : ''
      };
      if (!payload.primaryKeyword && !payload.extraInfo) {
        if (note) note.textContent = 'Add a primary keyword or some notes.';
        return;
      }
      try { sessionStorage.setItem(storeKey, JSON.stringify(payload)); } catch (_e2) {}
      btn.disabled = true;
      if (note) note.textContent = 'Writing a draft…';
      ctx.generate(payload).then(function (draft) {
        card._draft = draft;
        if (preview) {
          preview.hidden = false;
          preview.innerHTML = previewHtml(appKey, draft) +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
            '<button type="button" class="btn sm" id="aca-use">Use this draft</button>' +
            '<button type="button" class="btn ghost sm" id="aca-drop">Discard</button></div>';
          var use = preview.querySelector('#aca-use');
          var drop = preview.querySelector('#aca-drop');
          if (use) use.addEventListener('click', function () {
            ctx.apply(appKey, card._draft);
            if (note) note.textContent = 'Applied to ' + s.label + '. Review the fields, then save.';
          });
          if (drop) drop.addEventListener('click', function () {
            card._draft = null;
            preview.hidden = true;
            preview.innerHTML = '';
            if (note) note.textContent = 'Draft discarded.';
          });
        }
        if (note) note.textContent = 'Draft ready — nothing is saved until you use it.';
      }).catch(function (e) {
        if (note) note.textContent = String((e && e.message) || e);
      }).then(function () {
        btn.disabled = false;
      });
    });
  }

  return {
    APP_SPECS: APP_SPECS,
    SKIP: SKIP,
    SCHEMA: SCHEMA,
    spec: spec,
    writingBrief: writingBrief,
    normalizeDraft: normalizeDraft,
    applyAppContent: applyAppContent,
    previewHtml: previewHtml,
    mount: mount
  };
});
