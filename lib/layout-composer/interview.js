'use strict';

/**
 * Layout Composer business briefing interview.
 * Claude-style turns: one question, recommended chips, optional free text.
 * Builds an `understanding` object used to fill every confirmed section.
 * Deterministic by default (no network). Optional Brain polish later.
 */

function clean(s, n) {
  return String(s == null ? '' : s).trim().slice(0, n || 240);
}

function tradeKey(trade) {
  return clean(trade, 80).toLowerCase();
}

/** Combine business name + trade + location + known services for smarter chip seeding. */
function briefBlob(briefOrTrade) {
  if (typeof briefOrTrade === 'string') return tradeKey(briefOrTrade);
  const b = briefOrTrade || {};
  const bits = [
    b.businessName,
    b.trade,
    b.location,
    Array.isArray(b.services) ? b.services.join(' ') : '',
    b.differentiator || '',
    b.notes || ''
  ];
  return tradeKey(bits.filter(Boolean).join(' '));
}

function isVentilationBusiness(briefOrTrade) {
  const blob = briefBlob(briefOrTrade);
  // Must run BEFORE generic /roof/ — "Roof Ventilation Products" is not a roofing contractor.
  return /ventilat|ventilator|\bvents?\b|whirly|ridge.?vent|roof.?vent|louvre.?vent|eave.?vent|corrugated.?roof.?vent/.test(blob);
}

/**
 * Deterministic service chips from the brief.
 * Accepts a trade string (legacy) or a brief/understanding object.
 */
function defaultServices(briefOrTrade) {
  const t = typeof briefOrTrade === 'string'
    ? tradeKey(briefOrTrade)
    : tradeKey((briefOrTrade && briefOrTrade.trade) || '');
  const blob = briefBlob(briefOrTrade);

  // Ventilation / manufactured roof vents — NEVER roof-repair / gutter chips.
  if (isVentilationBusiness(briefOrTrade)) {
    return [
      'Metal corrugated roof ventilators',
      'Low-profile roof vents',
      'Ridge & turbine vents',
      'Custom flashings for vents',
      'Commercial roof ventilation supply'
    ];
  }
  if (/plumb/.test(t) || /plumb/.test(blob)) {
    return ['Blocked drains', 'Hot water', 'Leak repairs', 'Bathroom renovations', 'Gas fitting'];
  }
  if (/electr|sparky/.test(t) || /electr|sparky/.test(blob)) {
    return ['Switchboard upgrades', 'Lighting', 'Smoke alarms', 'EV charger install', 'Fault finding'];
  }
  // Generic roofing contractors only (repairs / re-roof) — after ventilation check.
  if (/(roof.?repair|re-?roof|roofer|roofing(?!\s*vent))/.test(blob) || (/roof/.test(t) && !/vent/.test(t))) {
    return ['Roof repairs', 'Re-roofing', 'Guttering', 'Leak detection', 'Skylights'];
  }
  if (/build|carpentr|reno/.test(t)) {
    return ['Renovations', 'Extensions', 'Decks', 'Kitchens', 'Bathrooms'];
  }
  if (/clean/.test(t)) {
    return ['End of lease', 'Office cleaning', 'Carpet cleaning', 'Window cleaning', 'Regular cleans'];
  }
  if (/landscap|garden/.test(t)) {
    return ['Garden design', 'Lawn care', 'Irrigation', 'Retaining walls', 'Maintenance'];
  }
  if (/hvac|air.?con|heating/.test(t)) {
    return ['Installation', 'Servicing', 'Repairs', 'Ducted systems', 'Split systems'];
  }
  // Prefer trade label chips over useless "Repairs / Maintenance" generics.
  const label = clean(
    (typeof briefOrTrade === 'object' && briefOrTrade && briefOrTrade.trade) || briefOrTrade,
    40
  ) || 'core service';
  return [
    label,
    'Supply & install',
    'Custom orders',
    'Commercial supply',
    'Product advice'
  ];
}

function defaultCustomers(briefOrTrade) {
  const t = typeof briefOrTrade === 'string'
    ? tradeKey(briefOrTrade)
    : tradeKey((briefOrTrade && briefOrTrade.trade) || '');
  if (isVentilationBusiness(briefOrTrade)) {
    return ['Homeowners', 'Builders & trades', 'Roofing contractors', 'Property managers', 'Commercial projects'];
  }
  if (/commercial|office|industrial/.test(t)) {
    return ['Small businesses', 'Property managers', 'Facilities teams', 'Homeowners'];
  }
  return ['Homeowners', 'Landlords', 'Property managers', 'Local businesses', 'Builders & trades'];
}

function defaultDifferentiators(briefOrTrade, location) {
  const loc = clean(location, 40) ||
    clean(typeof briefOrTrade === 'object' && briefOrTrade && briefOrTrade.location, 40) ||
    'the local area';
  if (isVentilationBusiness(briefOrTrade)) {
    return [
      'Modern low-profile metal roof ventilators',
      'Made for Australian conditions',
      'Designed to suit corrugated roofing',
      'Clear product specs for builders',
      'Supply across ' + loc
    ];
  }
  return [
    'Fast response across ' + loc,
    'Clear fixed-price quotes',
    'Fully licensed & insured',
    'Neat, respectful on site',
    'Same-day availability when possible',
    'Long-term local reputation'
  ];
}

function defaultAreas(location) {
  const loc = clean(location, 60);
  if (!loc) {
    return ['Inner suburbs', 'Surrounding towns', 'New estates', 'Commercial precincts'];
  }
  if (/australia|nationwide|national/i.test(loc)) {
    return [loc, 'Metro areas', 'Regional Australia', 'Trade supply partners', 'Project deliveries'];
  }
  return [loc, loc + ' north', loc + ' south', 'Nearby suburbs', 'Regional call-outs'];
}

function defaultCtas(briefOrTrade) {
  const t = typeof briefOrTrade === 'string'
    ? tradeKey(briefOrTrade)
    : tradeKey((briefOrTrade && briefOrTrade.trade) || '');
  if (isVentilationBusiness(briefOrTrade)) {
    return ['Visit our online shop', 'View products', 'Request product info', 'Talk to supply'];
  }
  if (/emerg|24/.test(t)) return ['Call now', 'Request urgent help', 'Get a callback'];
  if (/clean|landscap/.test(t)) return ['Book a visit', 'Get a free quote', 'Check availability'];
  return ['Get a free quote', 'Request a callback', 'Book an inspection', 'Call the team'];
}

/**
 * After free-text / chip answers, rebuild upcoming step chips from understanding
 * so Q2+ is not frozen to the Q1 trade guess.
 */
function refreshUpcomingStepOptions(session) {
  if (!session || !Array.isArray(session.steps)) return;
  const u = session.understanding || {};
  const brief = {
    businessName: u.businessName,
    trade: u.trade,
    location: u.location,
    services: u.services,
    differentiator: u.differentiator
  };
  const idx = Number(session.stepIndex) || 0;
  for (let i = idx; i < session.steps.length; i++) {
    const step = session.steps[i];
    if (!step || step.terminal || step.oneShot) continue;
    if (step.field === 'services' || step.id === 'services') {
      step.options = defaultServices(brief).map(function (label, j) {
        return { id: 'svc-' + j, label: label, recommended: j < 3 };
      });
      if (step.id === 'services' && i === idx && (u.services || []).length) {
        // Current services turn: keep chips product-specific; free text already captured.
      }
    } else if (step.field === 'customers' || step.id === 'customers') {
      step.options = defaultCustomers(brief).map(function (label, j) {
        return { id: 'cust-' + j, label: label, recommended: j < 2 };
      });
    } else if (step.field === 'differentiator' || step.id === 'differentiator') {
      step.options = defaultDifferentiators(brief, u.location).map(function (label, j) {
        return { id: 'diff-' + j, label: label, recommended: j === 0 };
      });
    } else if (step.field === 'serviceAreas' || step.id === 'areas') {
      step.options = defaultAreas(u.location).map(function (label, j) {
        return { id: 'area-' + j, label: label, recommended: j === 0 };
      });
    } else if (step.field === 'preferredCta' || step.id === 'cta') {
      step.options = defaultCtas(brief).map(function (label, j) {
        return { id: 'cta-' + j, label: label, recommended: j === 0 };
      });
    }
  }
}

function defaultTones() {
  return [
    { id: 'plain', label: 'Plain & practical (recommended)', recommended: true },
    { id: 'premium', label: 'Premium & polished' },
    { id: 'friendly', label: 'Warm & neighbourly' },
    { id: 'urgent', label: 'Fast & direct' }
  ];
}

/**
 * Suggest marketplace / section apps that fit the business — advisory only.
 * Does not change the confirmed layout.
 */
function phraseList(items, fallback) {
  const arr = (items || []).map(function (x) { return clean(x, 60); }).filter(Boolean);
  if (!arr.length) return fallback;
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return arr[0] + ' and ' + arr[1];
  return arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1];
}

function suggestApps(understanding, blueprintKeys) {
  const u = understanding || {};
  const trade = tradeKey(u.trade || (u.brief && u.brief.trade));
  const biz = clean(u.businessName, 80) || 'Your business';
  const loc = clean(u.location, 60) || 'your area';
  const services = phraseList(u.services, (u.trade || 'local') + ' services');
  const areas = phraseList(u.serviceAreas, loc);
  const edge = clean(u.differentiator, 120) || ('Reliable ' + (u.trade || 'service') + ' across ' + loc);
  const cta = clean(u.preferredCta, 60) || 'Get a free quote';
  const have = {};
  (blueprintKeys || []).forEach(function (k) { have[k] = true; });
  const out = [];

  function add(key, title, reason, seo, opts) {
    opts = opts || {};
    var inLayout = !!have[key];
    var related = Array.isArray(opts.relatedKeys)
      ? opts.relatedKeys.some(function (k) { return !!have[k]; })
      : false;
    var defaultSelected = opts.defaultSelected != null
      ? !!opts.defaultSelected
      : (!inLayout && !related);
    out.push({
      key: key,
      title: title,
      reason: reason,
      inLayout: inLayout,
      status: inLayout ? 'already_in_layout' : (related ? 'related_in_layout' : 'suggested_add'),
      defaultSelected: defaultSelected,
      sampleSeo: seo || null
    });
  }

  add(
    'faq',
    'FAQ',
    'Answer “Do you cover ' + areas + '?” and pricing questions for ' + services + '.',
    {
      h1: services + ' FAQs in ' + loc,
      intro: biz + ' answers the questions locals ask before they ' + cta.toLowerCase() + '.',
      bullets: [
        'Do you service ' + areas + '?',
        'What is included in a typical quote for ' + services + '?',
        edge
      ]
    }
  );
  add(
    'reviews',
    'Reviews',
    'Show proof from ' + phraseList(u.customers, 'local customers') + ' next to your offer.',
    {
      h1: 'What customers say about ' + biz,
      intro: 'Recent feedback from ' + phraseList(u.customers, 'clients') + ' across ' + areas + '.',
      bullets: [
        '"' + biz + ' explained the job clearly."',
        '"Neat work and easy to book in ' + loc + '."'
      ]
    }
  );
  add(
    'area',
    'Service area',
    'Name ' + areas + ' on-page — strong local SEO for ' + (u.trade || 'your trade') + '.',
    {
      h1: (u.trade || 'Services') + ' across ' + loc,
      intro: biz + ' regularly works through ' + areas + '.',
      bullets: (u.serviceAreas || [loc]).slice(0, 4)
    }
  );
  if (/plumb|electr|hvac|roof|lock|vent/.test(trade)) {
    add(
      'emergencyAvailability',
      'Emergency availability',
      'Capture urgent ' + (u.trade || 'trade') + ' searches without changing your core offer.',
      {
        h1: 'Urgent ' + (u.trade || 'help') + ' in ' + loc,
        intro: 'Need fast help with ' + services + '? ' + biz + ' — ' + cta + '.',
        bullets: [edge, 'Coverage: ' + areas]
      }
    );
  }
  if (/build|reno|paint|landscap|roof|vent/.test(trade)) {
    // Do not auto-tick gallery before/after when a before/after hero is already in the layout.
    add(
      'beforeAfter',
      'Before & after',
      'Show ' + services + ' transformations that win quote-ready visitors.',
      {
        h1: services + ' results',
        intro: 'Recent projects from ' + biz + ' around ' + areas + '.',
        bullets: [edge, cta]
      },
      { relatedKeys: ['heroBeforeAfter', 'beforeAfterFeed', 'beforeAfter'] }
    );
  }
  if (/plumb|build|reno|hvac|electr|roof|vent/.test(trade)) {
    add(
      'onlineQuote',
      'Online quote',
      'Let ' + phraseList(u.customers, 'buyers') + ' start a brief after hours.',
      {
        h1: cta + ' — ' + biz,
        intro: 'Tell us the suburb and job details for ' + services + '.',
        bullets: ['Areas: ' + areas, edge]
      }
    );
  }
  add(
    'quote',
    'Quote form',
    'Primary conversion path — button copy: “' + cta + '”.',
    {
      h1: cta,
      intro: 'Send ' + biz + ' a short job brief for ' + services + ' in ' + areas + '.',
      bullets: [edge]
    }
  );
  return out.slice(0, 6);
}

function blueprintSectionKeys(blueprint) {
  const home = (blueprint && blueprint.pages && blueprint.pages[0]) || {};
  return (home.sections || [])
    .filter(function (s) { return s && s.key && s.enabled !== false; })
    .map(function (s) { return s.key; });
}

function confidenceFromUnderstanding(u) {
  let score = 0;
  if (u.businessName) score += 0.15;
  if (u.trade) score += 0.15;
  if (u.location) score += 0.1;
  if (u.services && u.services.length) score += 0.2;
  if (u.customers && u.customers.length) score += 0.1;
  if (u.differentiator) score += 0.15;
  if (u.serviceAreas && u.serviceAreas.length) score += 0.1;
  if (u.preferredCta) score += 0.05;
  return Math.min(1, Math.round(score * 100) / 100);
}

function buildSteps(brief) {
  const trade = clean(brief && brief.trade, 80);
  const loc = clean(brief && brief.location, 80);
  const biz = clean(brief && brief.businessName, 120) || 'your business';
  const seed = {
    businessName: biz,
    trade: trade,
    location: loc
  };
  const servicesQ = isVentilationBusiness(seed)
    ? 'Which roof ventilation products does ' + biz + ' make or supply?'
    : 'What does ' + biz + ' mainly do day-to-day?';
  return [
    {
      id: 'services',
      field: 'services',
      multi: true,
      question: servicesQ,
      help: 'Pick all that apply, or type your own. This becomes your services SEO copy.',
      options: defaultServices(seed).map(function (label, i) {
        return { id: 'svc-' + i, label: label, recommended: i < 3 };
      })
    },
    {
      id: 'customers',
      field: 'customers',
      multi: true,
      question: 'Who usually buys from you?',
      help: 'Helps tone and proof (homeowners vs builders vs commercial).',
      options: defaultCustomers(seed).map(function (label, i) {
        return { id: 'cust-' + i, label: label, recommended: i < 2 };
      })
    },
    {
      id: 'differentiator',
      field: 'differentiator',
      multi: false,
      question: 'What should we emphasise so you stand out in ' + (loc || 'your area') + '?',
      help: 'One clear edge beats a laundry list.',
      options: defaultDifferentiators(seed, loc).map(function (label, i) {
        return { id: 'diff-' + i, label: label, recommended: i === 0 };
      })
    },
    {
      id: 'areas',
      field: 'serviceAreas',
      multi: true,
      question: 'Which areas should SEO pages and the area section mention?',
      help: 'Suburbs and towns you actually want leads from.',
      options: defaultAreas(loc).map(function (label, i) {
        return { id: 'area-' + i, label: label, recommended: i === 0 };
      })
    },
    {
      id: 'cta',
      field: 'preferredCta',
      multi: false,
      question: 'What should the main button say?',
      help: 'Used across hero, quote, and promo blocks.',
      options: defaultCtas(seed).map(function (label, i) {
        return { id: 'cta-' + i, label: label, recommended: i === 0 };
      })
    },
    {
      id: 'tone',
      field: 'tone',
      multi: false,
      question: 'How should the website sound?',
      help: 'Keeps every app’s copy consistent.',
      options: defaultTones()
    },
    {
      id: 'ready',
      field: null,
      multi: false,
      terminal: true,
      question: 'Happy that I understand ' + biz + '?',
      help: 'We’ll fill every app in your confirmed layout with SEO-ready content. Structure stays locked.',
      options: [
        { id: 'ready-yes', label: 'Yes — fill my layout', recommended: true, completes: true },
        {
          id: 'ready-more',
          label: 'Ask me one more thing about services',
          recommended: false,
          completes: false,
          followUp: {
            field: 'services',
            multi: true,
            question: 'What else should we emphasise in your services (products, niches, or jobs you want more of)?',
            help: 'One follow-up only — then we return to confirm. Type your own or pick chips.',
            optionsFrom: 'services'
          }
        }
      ]
    }
  ];
}

function startInterview(brief, blueprint) {
  const b = {
    businessName: clean(brief && brief.businessName, 120),
    trade: clean(brief && brief.trade, 80),
    location: clean(brief && brief.location, 80)
  };
  if (!b.businessName) {
    const err = new Error('businessName_required');
    err.code = 400;
    throw err;
  }
  const steps = buildSteps(b);
  const understanding = {
    businessName: b.businessName,
    trade: b.trade,
    location: b.location,
    services: [],
    customers: [],
    serviceAreas: [],
    differentiator: '',
    preferredCta: '',
    tone: 'plain',
    notes: []
  };
  return {
    session: {
      version: 1,
      stepIndex: 0,
      steps: steps,
      understanding: understanding,
      answers: [],
      blueprintKeys: blueprintSectionKeys(blueprint),
      ready: false
    },
    turn: presentTurn(steps[0], understanding, blueprint)
  };
}

function presentTurn(step, understanding, blueprint) {
  const conf = confidenceFromUnderstanding(understanding);
  return {
    stepId: step.id,
    question: step.question,
    help: step.help || '',
    multi: !!step.multi,
    terminal: !!step.terminal,
    options: (step.options || []).map(function (o) {
      return {
        id: o.id,
        label: o.label,
        recommended: !!o.recommended
      };
    }),
    allowFreeText: true,
    freeTextPlaceholder: step.multi ? 'Or type another…' : 'Or type your own answer…',
    understanding: summaryUnderstanding(understanding),
    confidence: conf,
    confidenceLabel: conf >= 0.75 ? 'Ready to write' : conf >= 0.45 ? 'Getting clear' : 'Still learning',
    appSuggestions: step.terminal
      ? suggestApps(understanding, blueprintSectionKeys(blueprint))
      : []
  };
}

function summaryUnderstanding(u) {
  return {
    businessName: u.businessName || '',
    trade: u.trade || '',
    location: u.location || '',
    services: (u.services || []).slice(),
    customers: (u.customers || []).slice(),
    serviceAreas: (u.serviceAreas || []).slice(),
    differentiator: u.differentiator || '',
    preferredCta: u.preferredCta || '',
    tone: u.tone || 'plain'
  };
}

function applyAnswerToUnderstanding(understanding, step, answer) {
  const u = Object.assign({}, understanding);
  const free = clean(answer && answer.freeText, 400);
  let selected = Array.isArray(answer && answer.selectedLabels)
    ? answer.selectedLabels.map(function (x) { return clean(x, 120); }).filter(Boolean)
    : [];

  // Free text wins for single-answer steps; for multi it is additive.
  // Comma/newline lists in free text become separate multi values.
  if (free) {
    if (step && step.multi) {
      const parts = free.split(/[\n,;·|]+/).map(function (x) { return clean(x, 80); }).filter(Boolean);
      selected = selected.concat(parts.length ? parts : [free]);
    } else {
      selected = [free];
    }
  }

  if (!step || !step.field) {
    if (free) {
      u.notes = (u.notes || []).concat([free]);
      // If user pasted a structured summary on the ready step, fold it in.
      const mSvc = free.match(/services?\s*:\s*([^\n]+)/i);
      const mCust = free.match(/customers?\s*:\s*([^\n]+)/i);
      const mEdge = free.match(/(?:edge|differentiator)\s*:\s*([^\n]+)/i);
      const mAreas = free.match(/areas?\s*:\s*([^\n]+)/i);
      const mCta = free.match(/cta\s*:\s*([^\n]+)/i);
      const mTone = free.match(/tone\s*:\s*([^\n]+)/i);
      function splitList(s) {
        return String(s || '').split(/,|·|\|/).map(function (x) { return clean(x, 80); }).filter(Boolean);
      }
      if (mSvc) u.services = Array.from(new Set((u.services || []).concat(splitList(mSvc[1]))));
      if (mCust) u.customers = Array.from(new Set((u.customers || []).concat(splitList(mCust[1]))));
      if (mAreas) u.serviceAreas = Array.from(new Set((u.serviceAreas || []).concat(splitList(mAreas[1]))));
      if (mEdge) u.differentiator = clean(mEdge[1], 160);
      if (mCta) u.preferredCta = clean(mCta[1], 80);
      if (mTone) u.tone = clean(mTone[1], 40).toLowerCase() || u.tone;
    }
    return u;
  }

  if (step.multi) {
    const set = {};
    (u[step.field] || []).concat(selected).forEach(function (x) {
      if (x) set[x] = true;
    });
    u[step.field] = Object.keys(set);
  } else if (step.field === 'tone') {
    const toneOpt = (step.options || []).find(function (o) {
      return selected.indexOf(o.label) >= 0 || selected.indexOf(o.id) >= 0;
    });
    u.tone = (toneOpt && toneOpt.id) || clean(selected[0], 40) || u.tone || 'plain';
  } else {
    u[step.field] = selected[0] || u[step.field] || '';
  }
  return u;
}

function answerInterview(session, answer) {
  if (!session || !Array.isArray(session.steps)) {
    const err = new Error('session_required');
    err.code = 400;
    throw err;
  }
  const steps = session.steps;
  let idx = Number(session.stepIndex) || 0;
  if (idx < 0 || idx >= steps.length) idx = 0;
  const step = steps[idx];
  const selectedIds = Array.isArray(answer && answer.selectedIds) ? answer.selectedIds : [];
  const selectedLabels = (answer && answer.selectedLabels) || selectedIds.map(function (id) {
    const opt = (step.options || []).find(function (o) { return o.id === id; });
    return opt ? opt.label : id;
  });

  const payload = {
    selectedIds: selectedIds,
    selectedLabels: selectedLabels,
    freeText: answer && answer.freeText
  };

  function fakeBlueprint() {
    return {
      pages: [{ sections: (session.blueprintKeys || []).map(function (k) { return { key: k, enabled: true }; }) }]
    };
  }

  // One-shot follow-up completed → return to ready (do NOT replay the whole interview)
  if (step.oneShot && step.returnToReady) {
    if (!selectedLabels.length && !clean(payload.freeText, 2)) {
      const err = new Error('answer_required');
      err.code = 400;
      throw err;
    }
    session.understanding = applyAnswerToUnderstanding(session.understanding, step, payload);
    session.answers = (session.answers || []).concat([{ stepId: step.id, answer: payload }]);
    // Drop the one-shot step and restore ready as current
    session.steps = steps.filter(function (s) { return s.id !== step.id; });
    const readyIdx = session.steps.findIndex(function (s) { return s.id === 'ready'; });
    session.stepIndex = readyIdx >= 0 ? readyIdx : session.steps.length - 1;
    session.ready = false;
    const readyStep = session.steps[session.stepIndex];
    return {
      session: session,
      turn: presentTurn(readyStep, session.understanding, fakeBlueprint()),
      ready: false,
      understanding: summaryUnderstanding(session.understanding),
      confidence: confidenceFromUnderstanding(session.understanding),
      appSuggestions: suggestApps(session.understanding, session.blueprintKeys)
    };
  }

  // Terminal ready step
  if (step.terminal) {
    const pickedId = selectedIds[0] || '';
    const opt = (step.options || []).find(function (o) { return o.id === pickedId; }) ||
      (step.options || []).find(function (o) {
        return (selectedLabels || []).indexOf(o.label) >= 0;
      });

    // Inject a single follow-up question, then return here — never restart the questionnaire
    if (opt && opt.followUp) {
      const fu = opt.followUp;
      const followId = 'followup-' + Date.now();
      let options = Array.isArray(fu.options) ? fu.options.slice() : [];
      if (!options.length && fu.optionsFrom === 'services') {
        options = defaultServices(session.understanding).map(function (label, i) {
          return { id: 'fu-svc-' + i, label: label, recommended: i < 2 };
        });
      }
      const followStep = {
        id: followId,
        field: fu.field || 'services',
        multi: fu.multi !== false,
        question: fu.question || 'What else should we know?',
        help: fu.help || 'One follow-up only.',
        options: options,
        oneShot: true,
        returnToReady: true
      };
      session.understanding = applyAnswerToUnderstanding(session.understanding, step, payload);
      session.answers = (session.answers || []).concat([{ stepId: step.id, answer: payload }]);
      session.steps.splice(idx + 1, 0, followStep);
      session.stepIndex = idx + 1;
      session.ready = false;
      refreshUpcomingStepOptions(session);
      return {
        session: session,
        turn: presentTurn(followStep, session.understanding, fakeBlueprint()),
        ready: false,
        understanding: summaryUnderstanding(session.understanding),
        confidence: confidenceFromUnderstanding(session.understanding)
      };
    }

    // Legacy jumpTo: treat as single services follow-up (do not replay all steps)
    if (opt && opt.jumpTo) {
      opt.followUp = {
        field: opt.jumpTo === 'services' ? 'services' : opt.jumpTo,
        multi: true,
        question: 'What else should we emphasise for ' + (session.understanding.businessName || 'your business') + '?',
        help: 'One extra answer only — then we return to confirm.',
        optionsFrom: opt.jumpTo === 'services' ? 'services' : null
      };
      // Re-enter via followUp path
      const followId = 'followup-' + Date.now();
      const options = defaultServices(session.understanding).map(function (label, i) {
        return { id: 'fu-svc-' + i, label: label, recommended: i < 2 };
      });
      const followStep = {
        id: followId,
        field: 'services',
        multi: true,
        question: opt.followUp.question,
        help: opt.followUp.help,
        options: options,
        oneShot: true,
        returnToReady: true
      };
      session.understanding = applyAnswerToUnderstanding(session.understanding, step, payload);
      session.answers = (session.answers || []).concat([{ stepId: step.id, answer: payload }]);
      session.steps.splice(idx + 1, 0, followStep);
      session.stepIndex = idx + 1;
      session.ready = false;
      refreshUpcomingStepOptions(session);
      return {
        session: session,
        turn: presentTurn(followStep, session.understanding, fakeBlueprint()),
        ready: false,
        understanding: summaryUnderstanding(session.understanding),
        confidence: confidenceFromUnderstanding(session.understanding)
      };
    }

    session.understanding = applyAnswerToUnderstanding(session.understanding, step, payload);
    session.answers = (session.answers || []).concat([{ stepId: step.id, answer: payload }]);
    session.ready = true;
    session.stepIndex = idx;
    return {
      session: session,
      turn: presentTurn(step, session.understanding, fakeBlueprint()),
      ready: true,
      understanding: summaryUnderstanding(session.understanding),
      appSuggestions: suggestApps(session.understanding, session.blueprintKeys),
      confidence: confidenceFromUnderstanding(session.understanding)
    };
  }

  if (!selectedLabels.length && !clean(payload.freeText, 2)) {
    const err = new Error('answer_required');
    err.code = 400;
    throw err;
  }

  session.understanding = applyAnswerToUnderstanding(session.understanding, step, payload);
  session.answers = (session.answers || []).concat([{ stepId: step.id, answer: payload }]);
  session.stepIndex = Math.min(idx + 1, steps.length - 1);
  refreshUpcomingStepOptions(session);
  const next = steps[session.stepIndex];
  return {
    session: session,
    turn: presentTurn(next, session.understanding, fakeBlueprint()),
    ready: false,
    understanding: summaryUnderstanding(session.understanding),
    confidence: confidenceFromUnderstanding(session.understanding)
  };
}

module.exports = {
  startInterview,
  answerInterview,
  suggestApps,
  confidenceFromUnderstanding,
  summaryUnderstanding,
  buildSteps,
  defaultServices
};
