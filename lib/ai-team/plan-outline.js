'use strict';

/**
 * Business-language checklists + Discuss intent helpers for Atlas.
 * Keep free of config paths / section ids — Forge owns those when drafting.
 */

function cleanTopic(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract the offer/topic from a landing-page ask.
 * "landing page: cold coffee options" → "cold coffee options"
 */
function parseLandingFocus(requestText) {
  let t = cleanTopic(requestText);
  if (!t) return '';
  t = t.replace(/^landing\s*pages?\s*[:\-–]\s*/i, '');
  t = t.replace(/^(i need |we need |create |build |make |plan )?(a )?landing\s*pages?\s+(on|for|about)\s*[:\-–]?\s*/i, '');
  t = t.replace(/^plan a landing page for:\s*/i, '');
  t = t.replace(/^landing page for:\s*/i, '');
  // Avoid "landing page: landing page: …"
  t = t.replace(/^(landing\s*pages?\s*[:\-–]\s*)+/i, '');
  return cleanTopic(t);
}

function isFocusedLandingAsk(requestText) {
  const q = String(requestText || '').toLowerCase();
  return (
    /\blanding\s*pages?\b/.test(q) ||
    q.includes('landingpage') ||
    (/^\s*landing\s*pages?\s*[:\-–]/.test(q) && q.length > 12)
  );
}

function defaultPlanOutline(outcome, opts) {
  const o = opts || {};
  const topic = cleanTopic(o.topic || o.requestText || '');
  const steps = buildPlanSteps(outcome, o);
  if (steps && steps.length) return planOutlineFromSteps(steps);
  // Fallback string lists for non-structured outcomes
  if (outcome === 'strengthen_primary_cta') {
    return [
      'Use your approved preferred CTA from Site Knowledge as the single next-step phrase.',
      'Update the Hero button text to that phrase.',
      'Update Sticky CTA (if enabled) to the same phrase.',
      'Update Footer CTA (if present) to the same phrase.',
      'You review Change Preview → Apply Changes → Publish Live Site yourself.'
    ];
  }
  if (outcome === 'enable_faq_for_objections') {
    return [
      'Turn on the FAQ section on the homepage so common objections are answered before enquiry.',
      'Keep existing FAQ items if any; Echo can write answers later.',
      'You review Change Preview → Apply Changes → Publish Live Site yourself.'
    ];
  }
  if (outcome === 'confirm_business_goal') {
    return [
      'Answer Atlas (or edit Site Knowledge) with one clear primary goal.',
      'Save as approved business truth — this does not change live page copy yet.',
      'Ask Atlas again so strategy recommendations use the new goal.'
    ];
  }
  if (outcome === 'clarify_preferred_cta') {
    return [
      'Choose a specific button phrase (not “Contact us” / “Learn more”).',
      'Save it in Site Knowledge as preferred CTA.',
      'Optionally Draft in Forge to apply that phrase to Hero / Sticky / Footer.'
    ];
  }
  if (outcome === 'expand_main_services') {
    return [
      'List the main services customers hire you for (one per line) in Site Knowledge.',
      'Save as approved business truth.',
      'Echo can turn those facts into public service copy later.'
    ];
  }
  if (outcome === 'refine_brief') {
    return [
      'Tell Atlas the specific business result you want next.',
      'Atlas will propose a new Summary → Suggestion checklist.',
      'Discuss to refine, then Draft in Forge when the steps look right.'
    ];
  }
  if (outcome === 'plan_quote_form') {
    return planOutlineFromSteps(buildPlanSteps(outcome, o) || []);
  }
  if (outcome === 'plan_hero_slider') {
    return planOutlineFromSteps(buildPlanSteps(outcome, o) || []);
  }
  return [
    'Review the Summary and Suggestion with Atlas in Discuss.',
    'Answer any steps that need your input.',
    'Draft in Forge when ready.',
    'You publish the live site yourself — AI never publishes.'
  ];
}

/**
 * Structured steps for interactive answering on the card.
 */
function buildPlanSteps(outcome, opts) {
  const o = opts || {};
  const topic = parseLandingFocus(o.topic || o.requestText || '') || cleanTopic(o.topic || o.requestText || '');

  if (outcome === 'plan_quote_form') {
    return [
      {
        id: 'request',
        status: topic ? 'done' : 'needs_answer',
        label: topic
          ? 'Quote form should collect interest in: “' + topic.slice(0, 100) + '”.'
          : 'Confirm what visitors should request on the form.',
        value: topic || '',
        fields: topic
          ? []
          : [{ key: 'focus', label: 'What they request', placeholder: 'e.g. a wedding coffee cart quote' }]
      },
      {
        id: 'fields',
        status: 'needs_answer',
        label: 'Lock the must-have fields (name, email, phone, event date, notes).',
        value: '',
        fields: [
          {
            key: 'fields',
            label: 'Must-have fields',
            placeholder: 'name, email, phone, event date'
          }
        ]
      },
      {
        id: 'cta',
        status: 'needs_answer',
        label: 'Choose the form button phrase (CTA).',
        value: '',
        fields: [{ key: 'cta', label: 'Form CTA', placeholder: 'e.g. Request a quote' }]
      },
      {
        id: 'review',
        status: 'pending',
        label: 'Review the brief with Pulse via Discuss, then refine the Quote section in the editor.',
        value: '',
        fields: []
      },
      {
        id: 'publish',
        status: 'pending',
        label: 'You Publish Live Site yourself — AI never publishes.',
        value: '',
        fields: []
      }
    ];
  }

  if (outcome === 'plan_hero_slider') {
    return [
      {
        id: 'focus',
        status: topic ? 'done' : 'needs_answer',
        label: topic
          ? 'Hero slider should showcase: “' + topic.slice(0, 100) + '”.'
          : 'Confirm what the hero slider should showcase.',
        value: topic || '',
        fields: topic
          ? []
          : [{ key: 'focus', label: 'Slider focus', placeholder: 'e.g. wedding setups' }]
      },
      {
        id: 'slides',
        status: 'needs_answer',
        label: 'List 3–5 slide ideas (one line each).',
        value: '',
        fields: [
          {
            key: 'slides',
            label: 'Slide ideas',
            placeholder: 'Wedding cart\nCorporate morning tea\nIced drinks summer'
          }
        ]
      },
      {
        id: 'cta',
        status: 'needs_answer',
        label: 'Pick the slide CTA phrase.',
        value: '',
        fields: [{ key: 'cta', label: 'Slide CTA', placeholder: 'e.g. Get a free quote' }]
      },
      {
        id: 'review',
        status: 'pending',
        label: 'Review with Nova via Discuss, then adjust the Hero / Slider in the editor.',
        value: '',
        fields: []
      },
      {
        id: 'publish',
        status: 'pending',
        label: 'You Publish Live Site yourself — AI never publishes.',
        value: '',
        fields: []
      }
    ];
  }

  if (outcome === 'strengthen_primary_cta') {
    return [
      {
        id: 'cta',
        status: topic ? 'done' : 'needs_answer',
        label: topic
          ? 'Use this CTA phrase: “' + topic.slice(0, 60) + '”.'
          : 'Choose the main button phrase visitors should see.',
        value: topic || '',
        fields: topic
          ? []
          : [{ key: 'cta', label: 'CTA phrase', placeholder: 'e.g. Get a free quote' }]
      },
      {
        id: 'places',
        status: 'pending',
        label: 'Apply the same phrase on Hero, Sticky CTA, and Footer (via Forge).',
        value: '',
        fields: []
      },
      {
        id: 'publish',
        status: 'pending',
        label: 'Review Change Preview → Apply → you Publish Live Site yourself.',
        value: '',
        fields: []
      }
    ];
  }

  if (outcome === 'enable_faq_for_objections') {
    return [
      {
        id: 'objections',
        status: topic ? 'done' : 'needs_answer',
        label: topic
          ? 'Cover these objections: “' + topic.slice(0, 100) + '”.'
          : 'List the top objections customers raise before they enquire.',
        value: topic || '',
        fields: topic
          ? []
          : [
              {
                key: 'objections',
                label: 'Objections',
                placeholder: 'price, travel fees, weather backup'
              }
            ]
      },
      {
        id: 'enable',
        status: 'pending',
        label: 'Turn on the FAQ section so those answers appear before enquiry (Forge).',
        value: '',
        fields: []
      },
      {
        id: 'publish',
        status: 'pending',
        label: 'Review Change Preview → Apply → you Publish Live Site yourself.',
        value: '',
        fields: []
      }
    ];
  }

  if (outcome !== 'plan_seo_landing') return null;

  // Match Landing pages → Write with AI (SEO mode) fields exactly.
  return [
    {
      id: 'focus',
      status: topic ? 'done' : 'needs_answer',
      label: topic
        ? 'Focus this landing page on: “' + topic.slice(0, 100) + '”.'
        : 'Confirm what this landing page is about.',
      value: topic || '',
      fields: topic
        ? []
        : [
            {
              key: 'focus',
              label: 'Page topic',
              help: 'What this page is about — used to seed the Primary keyword.',
              placeholder: 'e.g. Halloween pumpkin carvings',
              example: 'Halloween pumpkin carvings'
            }
          ]
    },
    {
      id: 'seo_inputs',
      status: 'needs_answer',
      label:
        'Fill the same fields as Landing pages → Write with AI: Primary keyword, Location, plus optional Extra information and Negative keywords.',
      value: '',
      fields: [
        {
          key: 'primaryKeyword',
          label: 'Primary keyword',
          help: 'Main Google phrase to rank for — same field as Write with AI.',
          placeholder: topic ? topic.slice(0, 80) : 'e.g. pumpkin carving Canberra',
          example: 'pumpkin carving Canberra',
          required: true
        },
        {
          key: 'location',
          label: 'Location',
          help: 'Suburb or city this page targets — same field as Write with AI.',
          placeholder: 'e.g. Canberra',
          example: 'Canberra',
          required: true
        },
        {
          key: 'extraInfo',
          label: 'Extra information',
          help: 'Optional — anything else Write with AI should know (audience, offer, what not to cover).',
          placeholder: 'e.g. Family workshops only — no corporate events.',
          example: 'Family workshops only — no corporate events.',
          optional: true,
          multiline: true
        },
        {
          key: 'negativeKeywords',
          label: 'Negative keywords',
          help: 'Optional — hard ban words the page must never mention (comma-separated). Same as Write with AI.',
          placeholder: 'e.g. coffee, barista, wedding',
          example: 'coffee, barista, wedding',
          optional: true
        }
      ]
    },
    {
      id: 'draft',
      status: 'pending',
      label:
        'Open Landing pages → Write with AI (SEO mode), paste those fields, then Generate draft.',
      value: '',
      fields: []
    },
    {
      id: 'publish',
      status: 'pending',
      label: 'Review the draft, refine copy, then you Publish Live Site yourself.',
      value: '',
      fields: []
    }
  ];
}

function planOutlineFromSteps(steps) {
  return (Array.isArray(steps) ? steps : []).map(function (s) {
    return String((s && s.label) || '').trim();
  }).filter(Boolean);
}

function attachPlanOutline(proposedChange, outcome, opts) {
  const change = Object.assign({}, proposedChange || {});
  const key = outcome || change.outcome || null;
  const o = opts || {};
  if (!Array.isArray(change.planSteps) || !change.planSteps.length) {
    const built = buildPlanSteps(key, o);
    if (built) change.planSteps = built;
  }
  if (!Array.isArray(change.planOutline) || !change.planOutline.length) {
    change.planOutline = change.planSteps
      ? planOutlineFromSteps(change.planSteps)
      : defaultPlanOutline(key, o);
  }
  return change;
}

function classifyDiscussIntent(userMessage) {
  const msg = cleanTopic(userMessage);
  if (!msg) return 'ack';
  const lower = msg.toLowerCase();

  if (
    /^(no[,.]?\s*)?(i('m| am)\s+)?(asking|just asking)/i.test(msg) ||
    /\?$/.test(msg) ||
    /^(what|why|how|when|where|who|which|can you|could you|do you|is there|are we)\b/i.test(msg) ||
    /\b(what is|what's|whats|tell me|explain|clarify)\b/i.test(lower)
  ) {
    return 'question';
  }

  if (
    /^(focus|change|update|set|use|make|target|lock|refine)\b/i.test(msg) ||
    /\b(focus on|change (the )?plan|update (the )?plan|use .+ as|primary (search )?phrase (is|should)|keyword should)\b/i.test(
      lower
    ) ||
    /^["“'].+["”']$/.test(msg)
  ) {
    return 'edit';
  }

  if (msg.length <= 80 && !/[?]/.test(msg) && !/^(ok|okay|thanks|thank you|yes|yep|sure)\b/i.test(msg)) {
    return 'edit';
  }

  return 'ack';
}

function topicFromRecommendation(rec) {
  const change = (rec && (rec.proposed_change || rec.proposedChange)) || {};
  if (change.promptSummary) return parseLandingFocus(change.promptSummary) || cleanTopic(change.promptSummary);
  const evidence = Array.isArray(rec && rec.evidence) ? rec.evidence : [];
  for (let i = 0; i < evidence.length; i++) {
    const e = String(evidence[i] || '');
    const m = e.match(/^User request:\s*(.+)$/i);
    if (m) return parseLandingFocus(m[1]) || cleanTopic(m[1]);
  }
  const steps = Array.isArray(change.planSteps) ? change.planSteps : [];
  const focus = steps.find(function (s) {
    return s && s.id === 'focus' && s.value;
  });
  if (focus && focus.value) return cleanTopic(focus.value);
  const outline = Array.isArray(change.planOutline) ? change.planOutline : [];
  if (outline[0]) {
    const m = String(outline[0]).match(/Focus this landing page on:\s*[“"](.+?)[”"]/i);
    if (m) {
      const t = cleanTopic(m[1]);
      if (t && !/[?]/.test(t) && !/\b(what is|asking you)\b/i.test(t)) return parseLandingFocus(t) || t;
    }
  }
  return '';
}

function inferPrimarySearchPhrase(rec, site) {
  const s = site || {};
  const topic = topicFromRecommendation(rec);
  if (topic) return topic.slice(0, 80);
  const goal = cleanTopic(s.primaryGoal || '');
  const services = Array.isArray(s.mainServices) ? s.mainServices.map(cleanTopic).filter(Boolean) : [];
  if (services[0]) return services[0].slice(0, 80);
  if (goal) return goal.replace(/^get more\s+/i, '').slice(0, 80);
  return '';
}

function sanitizeOutline(outline, outcome, opts) {
  const steps = Array.isArray(outline) ? outline.slice() : defaultPlanOutline(outcome, opts);
  if (steps[0] && /Focus this landing page on:/i.test(steps[0])) {
    const m = String(steps[0]).match(/Focus this landing page on:\s*[“"](.+?)[”"]/i);
    const focus = m ? cleanTopic(m[1]) : '';
    if (
      !focus ||
      /[?]/.test(focus) ||
      /\b(what is|asking you|primary search phrase)\b/i.test(focus) ||
      /^plan a landing page for:/i.test(focus) ||
      /^landing page:/i.test(focus)
    ) {
      const topic = parseLandingFocus((opts && (opts.topic || opts.requestText)) || '') || cleanTopic((opts && opts.topic) || '');
      steps[0] = topic
        ? 'Focus this landing page on: “' + topic.slice(0, 100) + '”.'
        : 'Confirm what this landing page is about.';
    }
  }
  return steps;
}

function syncOutlineFromPlanSteps(change) {
  const c = Object.assign({}, change || {});
  if (Array.isArray(c.planSteps) && c.planSteps.length) {
    c.planOutline = planOutlineFromSteps(c.planSteps);
  }
  return c;
}

/**
 * Apply client answers to a structured plan step (same recommendation).
 */
function applyStepAnswers(change, stepId, answers) {
  const c = Object.assign({}, change || {});
  let steps = Array.isArray(c.planSteps) ? c.planSteps.map(function (s) {
    return Object.assign({}, s);
  }) : [];
  if (!steps.length) {
    steps = buildPlanSteps(c.outcome, { topic: c.promptSummary || '' }) || [];
  }
  const ans = answers || {};
  const idx = steps.findIndex(function (s) {
    return s && s.id === stepId;
  });
  if (idx < 0) return syncOutlineFromPlanSteps(c);

  const step = steps[idx];
  if (stepId === 'focus') {
    const focus = cleanTopic(ans.focus || ans.value || '');
    if (focus) {
      step.value = focus;
      step.status = 'done';
      step.label = 'Focus this landing page on: “' + focus.slice(0, 100) + '”.';
      step.fields = [];
      const seo = steps.find(function (s) {
        return s.id === 'seo_inputs' || s.id === 'keywords';
      });
      if (seo && seo.status === 'needs_answer' && Array.isArray(seo.fields)) {
        seo.fields = seo.fields.map(function (f) {
          if (f.key === 'primaryKeyword' || f.key === 'searchPhrase') {
            return Object.assign({}, f, { placeholder: focus.slice(0, 80) });
          }
          return f;
        });
      }
    }
  } else if (stepId === 'seo_inputs' || stepId === 'keywords') {
    const phrase = cleanTopic(
      ans.primaryKeyword || ans.searchPhrase || ans.phrase || ''
    );
    const location = cleanTopic(ans.location || '');
    const extraInfo = cleanTopic(ans.extraInfo || ans.extra || '');
    const negatives = cleanTopic(ans.negativeKeywords || ans.negatives || '');
    if (phrase && location) {
      step.value = phrase + ' · ' + location;
      step.status = 'done';
      step.label =
        'Write with AI fields locked — Primary keyword: “' +
        phrase +
        '”; Location: “' +
        location +
        '”' +
        (extraInfo ? '; Extra information set' : '') +
        (negatives ? '; Negative keywords set' : '') +
        '.';
      step.answers = {
        primaryKeyword: phrase,
        location: location,
        extraInfo: extraInfo,
        negativeKeywords: negatives
      };
      step.fields = [];
      c.landingAiInputs = {
        mode: 'seo',
        primaryKeyword: phrase,
        location: location,
        extraInfo: extraInfo,
        negativeKeywords: negatives
      };
      const draft = steps.find(function (s) {
        return s.id === 'draft';
      });
      if (draft && draft.status === 'pending') draft.status = 'ready';
    }
  } else if (stepId === 'brief') {
    // Legacy cards only — prefer seo_inputs going forward.
    const headline = cleanTopic(ans.headline || '');
    const proof = cleanTopic(ans.proofPoints || '');
    const objections = cleanTopic(ans.objections || '');
    const cta = cleanTopic(ans.cta || '');
    if (headline || proof || objections || cta) {
      step.value = [headline, proof, objections, cta].filter(Boolean).join(' | ');
      step.status = 'done';
      step.label = 'Legacy brief saved (prefer Primary keyword + Location on new cards).';
      step.answers = { headline: headline, proofPoints: proof, objections: objections, cta: cta };
      step.fields = [];
      const draft = steps.find(function (s) {
        return s.id === 'draft';
      });
      if (draft && draft.status === 'pending') draft.status = 'ready';
    }
  } else if (Array.isArray(step.fields) && step.fields.length) {
    const values = {};
    let any = false;
    step.fields.forEach(function (f) {
      const v = cleanTopic(ans[f.key] || '');
      if (v) {
        values[f.key] = v;
        any = true;
      }
    });
    if (any) {
      const joined = Object.keys(values)
        .map(function (k) {
          return values[k];
        })
        .join(' · ');
      step.value = joined;
      step.status = 'done';
      step.answers = values;
      step.label = (step.label || stepId).replace(/\.\s*$/, '') + ' — “' + joined.slice(0, 80) + '”.';
      step.fields = [];
    }
  }

  steps[idx] = step;
  c.planSteps = steps;
  return syncOutlineFromPlanSteps(c);
}

function refinePlanOutline(outline, userMessage, outcome, opts) {
  const intent = classifyDiscussIntent(userMessage);
  const steps = sanitizeOutline(outline, outcome, opts);
  if (intent !== 'edit') return steps;

  const msg = cleanTopic(userMessage);
  if (!msg) return steps;

  if (outcome === 'plan_seo_landing') {
    const topic = parseLandingFocus(
      msg
        .replace(/^(please\s+)?(focus( this)?( landing page)? on|change (the )?focus to|use|target|set)\s*/i, '')
        .replace(/^["“]|["”]$/g, '')
    );
    if (topic && !/[?]/.test(topic)) {
      steps[0] = 'Focus this landing page on: “' + topic.slice(0, 120) + '”.';
    }
  }

  if (outcome === 'strengthen_primary_cta' || outcome === 'clarify_preferred_cta') {
    const m =
      msg.match(/["“']([^"”']{3,40})["”']/) ||
      msg.match(/\b(get a[^.!?]{3,40}|book[^.!?]{3,40}|call[^.!?]{3,40})\b/i);
    if (m) {
      const phrase = String(m[1] || m[0]).trim();
      if (phrase && !/[?]/.test(phrase)) {
        steps[0] = 'Use this agreed CTA phrase: “' + phrase.slice(0, 60) + '”.';
      }
    }
  }

  return steps;
}

function formatOutlineList(outline) {
  const steps = Array.isArray(outline) ? outline : [];
  if (!steps.length) return '1. Refine the brief with me\n2. Draft in Forge when you agree';
  return steps.map((s, i) => String(i + 1) + '. ' + s).join('\n');
}

function answerDiscussQuestion(rec, userMessage, outline, site) {
  const lower = cleanTopic(userMessage).toLowerCase();
  const title = (rec && rec.title) || 'this suggestion';
  const phrase = inferPrimarySearchPhrase(rec, site);
  const list = formatOutlineList(outline);

  if (/\b(primary search phrase|search phrase|keyword|keywords|primary keyword)\b/i.test(lower)) {
    if (phrase) {
      return (
        'Use **Primary keyword** (same as Landing pages → Write with AI): **' +
        phrase +
        '**.\n\nTap Answer on the Write with AI fields step to lock Primary keyword + Location (Extra information and Negative keywords are optional). Plan unchanged until you save.\n\nCurrent steps:\n' +
        list
      );
    }
    return 'We have not locked a Primary keyword yet. Use Answer on the Write with AI fields step.';
  }

  if (/\b(what (is|are) (the )?steps|what will|how will|explain the plan)\b/i.test(lower)) {
    return 'Here is exactly how we would pursue “' + title + '”:\n\n' + list;
  }

  return (
    'I can answer without changing the plan.\n\nCurrent steps:\n' +
    list +
    (phrase ? '\n\nSuggested focus/keyword: “' + phrase + '”.' : '')
  );
}

function discussReply(rec, userMessage, outline, opts) {
  const o = opts || {};
  const title = (rec && rec.title) || 'this suggestion';
  const steps = Array.isArray(outline) ? outline : [];
  const list = formatOutlineList(steps);
  const msg = cleanTopic(userMessage);

  if (!msg) {
    return (
      'Here is exactly how we would pursue “' +
      title +
      '”:\n\n' +
      list +
      '\n\nUse Answer on steps that need your input, or ask me a question. Press Draft in Forge when you agree.'
    );
  }

  const intent = classifyDiscussIntent(msg);
  if (intent === 'question') return answerDiscussQuestion(rec, msg, steps, o.site || {});
  if (intent === 'edit') {
    return 'Updated the plan for “' + title + '”.\n\nHow we will do it:\n' + list;
  }
  return 'Plan unchanged.\n\n' + list;
}

module.exports = {
  defaultPlanOutline,
  attachPlanOutline,
  refinePlanOutline,
  discussReply,
  classifyDiscussIntent,
  inferPrimarySearchPhrase,
  sanitizeOutline,
  topicFromRecommendation,
  answerDiscussQuestion,
  parseLandingFocus,
  isFocusedLandingAsk,
  buildPlanSteps,
  planOutlineFromSteps,
  applyStepAnswers,
  syncOutlineFromPlanSteps
};
