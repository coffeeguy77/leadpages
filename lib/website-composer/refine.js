'use strict';

/**
 * Structured refinement planner for Website Composer concepts (Phase 4).
 * Emits patch.set paths + optional sectionOrder / app install intents.
 * Does not write freeform HTML or invent unsupported app IDs.
 */

const { isAppSupported } = require('./marketplace/catalogue');
const { hasAdapter } = require('./adapters/registry');
const { HERO_APPS } = require('./install-apps');

/**
 * @param {object} concept
 * @param {string} feedback
 */
function planRefinement(concept, feedback) {
  const text = String(feedback || '').trim();
  /** @type {Record<string, unknown>} */
  const set = {};
  /** @type {string[]} */
  const unset = [];
  /** @type {string[]} */
  const changeSummary = [];
  let sectionOrder = Array.isArray(concept.sectionOrder) ? concept.sectionOrder.slice() : [];

  function ensureApp(appId, position) {
    if (!isAppSupported(appId) && appId !== 'footer') return false;
    if (!hasAdapter(appId) && appId !== 'footer') return false;
    if (!sectionOrder.includes(appId)) {
      if (typeof position === 'number') sectionOrder.splice(position, 0, appId);
      else sectionOrder.push(appId);
      changeSummary.push('add:' + appId);
      return true;
    }
    return false;
  }

  function removeApp(appId) {
    if (HERO_APPS.has(appId) || appId === 'footer') return false;
    const before = sectionOrder.length;
    sectionOrder = sectionOrder.filter((k) => k !== appId);
    if (sectionOrder.length !== before) {
      changeSummary.push('remove:' + appId);
      return true;
    }
    return false;
  }

  if (/darker|more contrast|bolder/i.test(text)) {
    set['theme.hivis'] = '#E11D48';
    set['theme.pipe'] = '#111827';
    changeSummary.push('theme:darker');
  }
  if (/softer|lighter|feminine|luxury|warmer/i.test(text)) {
    set['theme.hivis'] = '#C4A1A8';
    set['theme.lightBg'] = '#FBF7F8';
    changeSummary.push('theme:softer');
  }
  if (/more white\s*space|airy|less dense/i.test(text)) {
    set['globalStyles.density'] = 'airy';
    changeSummary.push('density:airy');
  }
  if (/split hero/i.test(text)) {
    // Replace first hero with splitHero when supported
    const hi = sectionOrder.findIndex((k) => HERO_APPS.has(k));
    if (hi >= 0 && isAppSupported('splitHero')) {
      sectionOrder[hi] = 'splitHero';
      set['sectionVariants.hero'] = 'splitHero';
      changeSummary.push('hero:splitHero');
    }
  }
  if (/quote form higher|move (the )?quote|form higher/i.test(text)) {
    sectionOrder = sectionOrder.filter((k) => k !== 'quote');
    const afterHero = sectionOrder.findIndex((k) => HERO_APPS.has(k));
    sectionOrder.splice(Math.max(1, afterHero + 1), 0, 'quote');
    changeSummary.push('reorder:quote-higher');
  }
  if (/remove (the )?process|remove serviceProcess/i.test(text)) {
    removeApp('serviceProcess');
  }
  if (/add (a )?package comparison|add packageCompare|vehicle compare/i.test(text)) {
    ensureApp('packageCompare', 2);
  }
  if (/add (a )?client[- ]logo|logo strip|clientLogos/i.test(text)) {
    ensureApp('clientLogos');
  }
  if (/add (a )?brand story|brandStory/i.test(text)) {
    ensureApp('brandStory', 3);
  }
  if (/add (an? )?faq/i.test(text)) {
    ensureApp('faq');
  }
  if (/add booking|booking cta|appointment/i.test(text)) {
    ensureApp('bookingCta');
  }
  if (/product collection|product shelf|collections section/i.test(text)) {
    ensureApp('productCollection', 1);
  }
  if (/replace testimonials with (a )?gallery|gallery instead of reviews/i.test(text)) {
    removeApp('reviews');
    ensureApp('featuredProjects');
  }
  if (/shorter|make the page shorter|fewer sections/i.test(text)) {
    const optional = ['reviewHighlights', 'specialOffer', 'crew', 'clientLogos', 'featureStrip'];
    for (const k of optional) removeApp(k);
    changeSummary.push('shorten');
  }
  if (/premium|more premium|luxurious copy/i.test(text)) {
    set['sections.hero.sub'] = 'A considered experience — quietly exceptional.';
    set['sections.hero.subheading'] = 'A considered experience — quietly exceptional.';
    changeSummary.push('copy:premium');
  }
  if (/friendlier|more friendly|warmer tone/i.test(text)) {
    set['sections.hero.sub'] = 'Warm, welcoming, and easy to get started.';
    set['sections.hero.subheading'] = 'Warm, welcoming, and easy to get started.';
    changeSummary.push('copy:friendly');
  }
  if (/cta|button|call to action/i.test(text)) {
    const labelMatch = text.match(/cta[:\s]+[“"']?([^“"'\n.]+)[“"']?/i);
    const label = labelMatch ? labelMatch[1].trim() : null;
    if (label) {
      set['callsToAction.primary.label'] = label;
      set['sections.hero.cta'] = label;
      set['header.ctaLabel'] = label;
      changeSummary.push('cta:' + label);
    }
  }
  if (/corporate events/i.test(text)) {
    set['sections.services.intro'] = 'Corporate activations, launches and brand hospitality.';
    changeSummary.push('emphasise:corporate-events');
  }
  if (/wedding/i.test(text) && /emphas|more detail|add/i.test(text)) {
    set['sections.featuredProjects.eyebrow'] = 'Weddings';
    changeSummary.push('emphasise:weddings');
  }

  if (sectionOrder.join('|') !== (concept.sectionOrder || []).join('|')) {
    set.sectionOrder = sectionOrder;
  }

  if (!Object.keys(set).length && !changeSummary.length && text) {
    set.rationale = (concept.rationale || '') + ' Refined: ' + text.slice(0, 240);
    changeSummary.push('rationale');
  }

  return {
    set,
    unset,
    rationale: text.slice(0, 500),
    changeSummary,
    sectionOrder
  };
}

module.exports = { planRefinement };
