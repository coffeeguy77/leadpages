'use strict';

/**
 * Business-language checklists + Discuss intent helpers for Atlas.
 * Keep free of config paths / section ids — Forge owns those when drafting.
 */

function defaultPlanOutline(outcome, opts) {
  const o = opts || {};
  const topic = cleanTopic(o.topic || o.requestText || '');

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

  if (outcome === 'plan_seo_landing') {
    const focus = topic
      ? 'Focus this landing page on: “' + topic.slice(0, 100) + (topic.length > 100 ? '…' : '') + '”.'
      : 'Confirm the offer, audience, and location this landing page should win.';
    return [
      focus,
      'Lock the primary search phrase and location (keywords + suburb/city).',
      'Write a short brief: headline, 3 proof points, top objections, and CTA.',
      'Create a draft landing page in Landing pages from that brief (Scout/editor).',
      'Review the draft, refine copy, then you Publish Live Site yourself.'
    ];
  }

  if (outcome === 'refine_brief') {
    return [
      'Tell Atlas the specific business result you want next.',
      'Atlas will propose a new Issue → Suggestion → How checklist.',
      'Discuss to refine, then Draft in Forge when the steps look right.'
    ];
  }

  return [
    'Review the Issue and Suggestion with Atlas in Discuss.',
    'Agree the How-we’ll-do-it checklist.',
    'Draft in Forge when ready (or complete Site Knowledge first if asked).',
    'You publish the live site yourself — AI never publishes.'
  ];
}

function cleanTopic(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function attachPlanOutline(proposedChange, outcome, opts) {
  const change = Object.assign({}, proposedChange || {});
  const key = outcome || change.outcome || null;
  if (!Array.isArray(change.planOutline) || !change.planOutline.length) {
    change.planOutline = defaultPlanOutline(key, opts);
  }
  return change;
}

/**
 * Classify Discuss messages so questions are answered, not pasted into the plan.
 * @returns {'question'|'edit'|'ack'}
 */
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

  // Short declarative topic/phrase without question marks — treat as edit.
  if (msg.length <= 80 && !/[?]/.test(msg) && !/^(ok|okay|thanks|thank you|yes|yep|sure)\b/i.test(msg)) {
    return 'edit';
  }

  return 'ack';
}

function topicFromRecommendation(rec) {
  const evidence = Array.isArray(rec && rec.evidence) ? rec.evidence : [];
  for (let i = 0; i < evidence.length; i++) {
    const e = String(evidence[i] || '');
    const m = e.match(/^User request:\s*(.+)$/i);
    if (m) return cleanTopic(m[1]);
  }
  const change = (rec && (rec.proposed_change || rec.proposedChange)) || {};
  const outline = Array.isArray(change.planOutline) ? change.planOutline : [];
  if (outline[0]) {
    const m = String(outline[0]).match(/Focus this landing page on:\s*[“"](.+?)[”"]/i);
    if (m) {
      const t = cleanTopic(m[1]);
      // Ignore if previous bug stuffed a question into the focus.
      if (t && !/[?]/.test(t) && !/\b(what is|asking you)\b/i.test(t)) return t;
    }
  }
  return '';
}

function inferPrimarySearchPhrase(rec, site) {
  const s = site || {};
  const topic = topicFromRecommendation(rec);
  const goal = cleanTopic(s.primaryGoal || '');
  const audience = cleanTopic(s.audience || '');
  const services = Array.isArray(s.mainServices)
    ? s.mainServices.map(cleanTopic).filter(Boolean)
    : [];
  const areas = Array.isArray(s.serviceAreas)
    ? s.serviceAreas.map(cleanTopic).filter(Boolean)
    : [];

  // Prefer explicit user ask / topic.
  if (topic && topic.length >= 8 && !/^plan (a |local )/i.test(topic)) {
    // Strip leading "I need a landing page on/for"
    const stripped = topic
      .replace(/^(i need |we need |create |build |make )?(a )?landing ?pages? (on|for|about)\s+/i, '')
      .replace(/^landing ?pages? (on|for|about)\s+/i, '')
      .trim();
    if (stripped) return stripped.slice(0, 80);
  }

  const parts = [];
  if (services[0]) parts.push(services[0]);
  else if (goal) parts.push(goal.replace(/^get more\s+/i, '').replace(/\.$/, ''));
  if (audience && /wedding|corporate|homeowner|office/i.test(audience)) {
    const a = audience.match(/\b(weddings?|corporate|homeowners?|offices?)\b/i);
    if (a) parts.push(a[1].toLowerCase());
  }
  if (areas[0]) parts.push(areas[0]);
  else if (/\bcanberra\b/i.test(topic + ' ' + goal + ' ' + audience)) parts.push('Canberra');

  if (parts.length) return parts.join(' ').slice(0, 80);
  if (goal) return goal.slice(0, 80);
  return '';
}

function sanitizeOutline(outline, outcome, opts) {
  const steps = Array.isArray(outline) ? outline.slice() : defaultPlanOutline(outcome, opts);
  // Repair step 1 if a previous bug stuffed a question into the focus.
  if (steps[0] && /Focus this landing page on:/i.test(steps[0])) {
    const m = String(steps[0]).match(/Focus this landing page on:\s*[“"](.+?)[”"]/i);
    const focus = m ? cleanTopic(m[1]) : '';
    if (!focus || /[?]/.test(focus) || /\b(what is|asking you|primary search phrase)\b/i.test(focus)) {
      const topic = cleanTopic((opts && (opts.topic || opts.requestText)) || '');
      steps[0] = topic
        ? 'Focus this landing page on: “' + topic.slice(0, 100) + '”.'
        : 'Confirm the offer, audience, and location this landing page should win.';
    }
  }
  return steps;
}

function refinePlanOutline(outline, userMessage, outcome, opts) {
  const intent = classifyDiscussIntent(userMessage);
  const steps = sanitizeOutline(outline, outcome, opts);
  if (intent !== 'edit') return steps;

  const msg = cleanTopic(userMessage);
  if (!msg) return steps;

  if (outcome === 'plan_seo_landing') {
    const topic = msg
      .replace(/^(please\s+)?(focus( this)?( landing page)? on|change (the )?focus to|use|target|set)\s*/i, '')
      .replace(/^["“]|["”]$/g, '')
      .trim();
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
  const goal = cleanTopic((site && site.primaryGoal) || '');
  const cta = cleanTopic((site && site.preferredCta) || '');
  const list = formatOutlineList(outline);

  if (/\b(primary search phrase|search phrase|keyword|keywords|what (should|do) (we|i) (target|rank|search))\b/i.test(lower)) {
    if (phrase) {
      return (
        'Recommended primary search phrase: **' +
        phrase +
        '**.\n\nThat comes from your Site Knowledge' +
        (goal ? ' (goal: “' + goal + '”)' : '') +
        (topicFromRecommendation(rec) ? ' and your earlier ask' : '') +
        '.\n\nIf that looks right, say “focus on ' +
        phrase +
        '” and I will update step 1. Or give me a different phrase. The plan itself is unchanged until you tell me to change it.\n\nCurrent plan:\n' +
        list
      );
    }
    return (
      'We have not locked a primary search phrase yet.\n\nTell me the phrase you want (for example “wedding coffee cart hire Canberra”), and I will update step 1. Until then the plan stays as:\n' +
      list
    );
  }

  if (/\b(what (is|are) (the )?steps|what will (you|we|forge) do|how will (you|we)|explain the plan)\b/i.test(lower)) {
    return 'Here is exactly how we would pursue “' + title + '”:\n\n' + list + '\n\nAsk about any step, or tell me a concrete change (e.g. “focus on wedding coffee cart hire”).';
  }

  if (/\b(cta|call to action|button)\b/i.test(lower)) {
    if (cta) {
      return (
        'Your approved preferred CTA in Site Knowledge is “' +
        cta +
        '”. That is what Forge would use if we strengthen CTAs. Want a different phrase? Say “use “Get a free quote”” (or your phrase) to update the plan.'
      );
    }
    return 'No preferred CTA is saved in Site Knowledge yet. Say the button phrase you want, or use Answer with Atlas / Site Knowledge to set it.';
  }

  return (
    'I can answer questions about this plan without changing it.\n\nYou asked: “' +
    cleanTopic(userMessage) +
    '”.\n\nFor “' +
    title +
    '”, the current steps are:\n' +
    list +
    '\n\n' +
    (phrase
      ? 'If you are choosing a focus/keyword, my recommendation is “' + phrase + '”. Say “focus on ' + phrase + '” to lock it into step 1.'
      : 'To change the plan, give a clear instruction like “focus on wedding coffee cart hire Canberra”.')
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
      '\n\nAsk me anything about a step (I will answer without changing the plan), or give a clear edit like “focus on wedding coffee cart hire”. Press Draft in Forge when you agree.'
    );
  }

  const intent = classifyDiscussIntent(msg);
  if (intent === 'question') {
    return answerDiscussQuestion(rec, msg, steps, o.site || {});
  }

  if (intent === 'edit') {
    return (
      'Updated the plan for “' +
      title +
      '”.\n\nHow we will do it:\n' +
      list +
      '\n\nAsk a question if you want an explanation, or press Draft in Forge when this looks right.'
    );
  }

  return (
    'Plan unchanged for “' +
    title +
    '”.\n\n' +
    list +
    '\n\nAsk a question, or give a clear edit (e.g. “focus on …”).'
  );
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
  answerDiscussQuestion
};
