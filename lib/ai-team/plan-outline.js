'use strict';

/**
 * Business-language checklists for Atlas recommendations.
 * Keep free of config paths / section ids — Forge owns those when drafting.
 */

function defaultPlanOutline(outcome, opts) {
  const o = opts || {};
  const topic = String(o.topic || o.requestText || '').replace(/\s+/g, ' ').trim();
  const fieldLabel = o.fieldLabel || o.fieldKey || 'Site Knowledge';

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

function attachPlanOutline(proposedChange, outcome, opts) {
  const change = Object.assign({}, proposedChange || {});
  const key = outcome || change.outcome || null;
  if (!Array.isArray(change.planOutline) || !change.planOutline.length) {
    change.planOutline = defaultPlanOutline(key, opts);
  }
  return change;
}

function refinePlanOutline(outline, userMessage, outcome, opts) {
  const steps = Array.isArray(outline) ? outline.slice() : defaultPlanOutline(outcome, opts);
  const msg = String(userMessage || '').replace(/\s+/g, ' ').trim();
  if (!msg) return steps;

  if (outcome === 'plan_seo_landing') {
    const lower = msg.toLowerCase();
    if (
      /\b(wedding|coffee|cart|hire|event|suburb|canberra|keyword|seo|landing)\b/.test(lower) ||
      msg.length > 12
    ) {
      steps[0] =
        'Focus this landing page on: “' + msg.slice(0, 120) + (msg.length > 120 ? '…' : '') + '”.';
    }
  }

  if (outcome === 'strengthen_primary_cta' || outcome === 'clarify_preferred_cta') {
    const m = msg.match(/["“']([^"”']{3,40})["”']/) || msg.match(/\b(get a[^.!?]{3,40}|book[^.!?]{3,40}|call[^.!?]{3,40})\b/i);
    if (m) {
      const phrase = String(m[1] || m[0]).trim();
      if (phrase) {
        steps[0] = 'Use this agreed CTA phrase: “' + phrase.slice(0, 60) + '”.';
      }
    }
  }

  return steps;
}

function discussReply(rec, userMessage, outline) {
  const title = (rec && rec.title) || 'this suggestion';
  const steps = Array.isArray(outline) ? outline : [];
  const list =
    steps.length > 0
      ? steps.map((s, i) => String(i + 1) + '. ' + s).join('\n')
      : '1. Refine the brief with me\n2. Draft in Forge when you agree';

  const msg = String(userMessage || '').trim();
  if (!msg) {
    return (
      'Here is exactly how we would pursue “' +
      title +
      '”:\n\n' +
      list +
      '\n\nTell me what to change in this plan, or press Draft in Forge when you agree.'
    );
  }

  return (
    'Got it — I updated the plan for “' +
    title +
    '” based on what you said.\n\nHow we will do it:\n' +
    list +
    '\n\nReply to refine further, or press Draft in Forge when this looks right. Nothing is published until you Apply and Publish yourself.'
  );
}

module.exports = {
  defaultPlanOutline,
  attachPlanOutline,
  refinePlanOutline,
  discussReply
};
