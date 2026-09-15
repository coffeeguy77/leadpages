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

function defaultServices(trade) {
  const t = tradeKey(trade);
  if (/plumb/.test(t)) {
    return ['Blocked drains', 'Hot water', 'Leak repairs', 'Bathroom renovations', 'Gas fitting'];
  }
  if (/electr|sparky/.test(t)) {
    return ['Switchboard upgrades', 'Lighting', 'Smoke alarms', 'EV charger install', 'Fault finding'];
  }
  if (/roof/.test(t)) {
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
  const label = clean(trade, 40) || 'core service';
  return [
    label + ' call-outs',
    'Maintenance',
    'Repairs',
    'New installs',
    'Commercial work'
  ];
}

function defaultCustomers(trade) {
  const t = tradeKey(trade);
  if (/commercial|office|industrial/.test(t)) {
    return ['Small businesses', 'Property managers', 'Facilities teams', 'Homeowners'];
  }
  return ['Homeowners', 'Landlords', 'Property managers', 'Local businesses', 'Builders & trades'];
}

function defaultDifferentiators(trade, location) {
  const loc = clean(location, 40) || 'the local area';
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
  return [loc, loc + ' north', loc + ' south', 'Nearby suburbs', 'Regional call-outs'];
}

function defaultCtas(trade) {
  const t = tradeKey(trade);
  if (/emerg|24/.test(t)) return ['Call now', 'Request urgent help', 'Get a callback'];
  if (/clean|landscap/.test(t)) return ['Book a visit', 'Get a free quote', 'Check availability'];
  return ['Get a free quote', 'Request a callback', 'Book an inspection', 'Call the team'];
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
function suggestApps(understanding, blueprintKeys) {
  const u = understanding || {};
  const trade = tradeKey(u.trade || u.brief && u.brief.trade);
  const have = {};
  (blueprintKeys || []).forEach(function (k) { have[k] = true; });
  const out = [];

  function add(key, title, reason) {
    if (have[key]) {
      out.push({
        key: key,
        title: title,
        reason: reason,
        inLayout: true,
        status: 'already_in_layout'
      });
    } else {
      out.push({
        key: key,
        title: title,
        reason: reason,
        inLayout: false,
        status: 'suggested_add'
      });
    }
  }

  add('faq', 'FAQ', 'Answer price, coverage, and “do you service my suburb?” searches.');
  add('reviews', 'Reviews', 'Local proof next to your offer builds trust for SEO visitors.');
  add('area', 'Service area', 'Name suburbs you cover — strong local SEO signal.');
  if (/plumb|electr|hvac|roof|lock/.test(trade)) {
    add('emergencyAvailability', 'Emergency availability', 'Capture urgent-intent searches without changing your core offer.');
  }
  if (/build|reno|paint|landscap|roof/.test(trade)) {
    add('beforeAfter', 'Before & after', 'Show transformations — great for quote conversions.');
  }
  if (/plumb|build|reno|hvac|electr/.test(trade)) {
    add('onlineQuote', 'Online quote', 'Let serious buyers start a job brief after hours.');
  }
  add('quote', 'Quote form', 'Primary conversion path from every SEO page.');
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
  return [
    {
      id: 'services',
      field: 'services',
      multi: true,
      question: 'What does ' + biz + ' mainly do day-to-day?',
      help: 'Pick all that apply, or type your own. This becomes your services SEO copy.',
      options: defaultServices(trade).map(function (label, i) {
        return { id: 'svc-' + i, label: label, recommended: i < 3 };
      })
    },
    {
      id: 'customers',
      field: 'customers',
      multi: true,
      question: 'Who usually calls you?',
      help: 'Helps tone and proof (homeowners vs commercial).',
      options: defaultCustomers(trade).map(function (label, i) {
        return { id: 'cust-' + i, label: label, recommended: i < 2 };
      })
    },
    {
      id: 'differentiator',
      field: 'differentiator',
      multi: false,
      question: 'What should we emphasise so you stand out in ' + (loc || 'your area') + '?',
      help: 'One clear edge beats a laundry list.',
      options: defaultDifferentiators(trade, loc).map(function (label, i) {
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
      options: defaultCtas(trade).map(function (label, i) {
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
        { id: 'ready-more', label: 'Ask me one more thing about services', completes: false, jumpTo: 'services' }
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
  const selected = Array.isArray(answer.selectedLabels)
    ? answer.selectedLabels.map(function (x) { return clean(x, 120); }).filter(Boolean)
    : [];
  const free = clean(answer.freeText, 400);
  if (free) selected.push(free);

  if (!step.field) {
    if (free) u.notes = (u.notes || []).concat([free]);
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

  // Terminal ready step
  if (step.terminal) {
    const pickedId = selectedIds[0] || '';
    const opt = (step.options || []).find(function (o) { return o.id === pickedId; }) ||
      (step.options || []).find(function (o) {
        return (selectedLabels || []).indexOf(o.label) >= 0;
      });
    if (opt && opt.jumpTo) {
      const jump = steps.findIndex(function (s) { return s.id === opt.jumpTo; });
      session.stepIndex = jump >= 0 ? jump : 0;
      session.understanding = applyAnswerToUnderstanding(session.understanding, step, payload);
      session.answers = (session.answers || []).concat([{ stepId: step.id, answer: payload }]);
      return {
        session: session,
        turn: presentTurn(steps[session.stepIndex], session.understanding, {
          pages: [{ sections: (session.blueprintKeys || []).map(function (k) { return { key: k, enabled: true }; }) }]
        }),
        ready: false
      };
    }
    session.understanding = applyAnswerToUnderstanding(session.understanding, step, payload);
    session.answers = (session.answers || []).concat([{ stepId: step.id, answer: payload }]);
    session.ready = true;
    session.stepIndex = idx;
    const bp = {
      pages: [{ sections: (session.blueprintKeys || []).map(function (k) { return { key: k, enabled: true }; }) }]
    };
    return {
      session: session,
      turn: presentTurn(step, session.understanding, bp),
      ready: true,
      understanding: summaryUnderstanding(session.understanding),
      appSuggestions: suggestApps(session.understanding, session.blueprintKeys),
      confidence: confidenceFromUnderstanding(session.understanding)
    };
  }

  if (!selectedLabels.length && !clean(payload.freeText, 20)) {
    const err = new Error('answer_required');
    err.code = 400;
    throw err;
  }

  session.understanding = applyAnswerToUnderstanding(session.understanding, step, payload);
  session.answers = (session.answers || []).concat([{ stepId: step.id, answer: payload }]);
  session.stepIndex = Math.min(idx + 1, steps.length - 1);
  const next = steps[session.stepIndex];
  const bp = {
    pages: [{ sections: (session.blueprintKeys || []).map(function (k) { return { key: k, enabled: true }; }) }]
  };
  return {
    session: session,
    turn: presentTurn(next, session.understanding, bp),
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
