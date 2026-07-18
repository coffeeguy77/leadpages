'use strict';

/**
 * Website Studio generation entry (legacy module path).
 * Delegates to Website Composer — no trade-template shallow clone.
 */

const {
  normalizeBrief,
  composeWebsiteConcepts
} = require('../website-composer');

/**
 * Build three deterministic website concepts from a brief.
 * @param {object} briefInput
 * @param {{ foundationId?: string, recipeId?: string, sourceConfig?: object|null, count?: number }} [opts]
 */
async function buildDeterministicConcepts(briefInput, opts) {
  const result = await composeWebsiteConcepts(briefInput, opts);
  if (!result.ok) return result;
  return {
    ...result,
    // Back-compat fields expected by Theme Studio V2 API/UI
    source: result.source || 'website_composer'
  };
}

function buildServices(brief, foundation) {
  const spec = brief.specialisation || brief.industry;
  const loc = brief.location || 'your area';
  if (foundation.category === 'retail') {
    return [
      { title: 'Signature pieces', body: 'Curated ' + spec + ' with private viewings in ' + loc + '.' },
      { title: 'Bespoke design', body: 'Made-to-order settings guided by your taste and stone.' },
      { title: 'Private appointments', body: 'Quiet consultations for collectors and couples.' }
    ];
  }
  if (foundation.category === 'hospitality') {
    return [
      { title: 'Event coffee service', body: spec + ' for agencies and events across ' + loc + '.' },
      { title: 'Coffee cart & van', body: 'Mobile barista setups that look sharp on site.' },
      { title: 'Cafe-quality cups', body: 'Specialty coffee with warm hospitality service.' }
    ];
  }
  if (foundation.category === 'professional') {
    return [
      { title: 'Core advisory', body: spec + ' for growing businesses in ' + loc + '.' },
      { title: 'Clarity sessions', body: 'Practical guidance without jargon.' },
      { title: 'Ongoing support', body: 'A steady partner through each reporting cycle.' }
    ];
  }
  if (foundation.category === 'events') {
    return [
      { title: 'Hire packages', body: spec + ' sized for your guest list.' },
      { title: 'Styling pieces', body: 'Furniture and finishing touches that photograph well.' },
      { title: 'Delivery & setup', body: 'Reliable logistics across ' + loc + '.' }
    ];
  }
  if (foundation.category === 'trade' || foundation.category === 'property') {
    return [
      { title: 'Primary service', body: spec + ' delivered by a professional local team.' },
      { title: 'Quoted clearly', body: 'Upfront pricing before work starts in ' + loc + '.' },
      { title: 'Reliable follow-through', body: 'Tidy workmanship and clear communication.' }
    ];
  }
  return [
    { title: 'Featured service', body: spec + ' tailored for ' + (brief.audience || 'your clients') + '.' },
    { title: 'Guided experience', body: 'A clear path from first enquiry to outcome.' },
    { title: 'Local presence', body: 'Based in ' + loc + '.' }
  ];
}

function heroHeading(brief, foundation) {
  if (foundation.category === 'retail') {
    return brief.businessName + ' — ' + (brief.specialisation || 'rare pieces, quietly presented');
  }
  if (foundation.category === 'hospitality') {
    return brief.businessName + ' — ' + (brief.specialisation || brief.industry || 'specialty coffee');
  }
  if (foundation.category === 'trade') {
    return (brief.specialisation || brief.industry) + ' you can trust';
  }
  return brief.businessName;
}

function heroSub(brief) {
  const bits = [];
  if (brief.specialisation) bits.push(brief.specialisation);
  if (brief.location) bits.push(brief.location);
  if (brief.audience) bits.push('for ' + brief.audience);
  return bits.join(' · ') || 'Professional web presence built around your brief.';
}

function primaryCta(brief, foundation) {
  const style = foundation.conversionStyle || '';
  if (style.includes('appointment') || style.includes('book')) return 'Book an appointment';
  if (style.includes('call')) return 'Call now';
  if (style.includes('visit')) return 'Plan your visit';
  if (style.includes('quote') || style.includes('availability')) return 'Check availability';
  return 'Get in touch';
}

function sectionContent(key, brief, foundation, ctx) {
  const base = { on: true };
  switch (key) {
    case 'hero':
      return {
        ...base,
        variant: 'hero',
        // Renderer keys: title / sub / quoteText (not heading/subheading)
        content: {
          title: ctx.heading,
          sub: ctx.subheading,
          quoteText: ctx.cta,
          callText: ctx.cta,
          cta: ctx.cta
        }
      };
    case 'emerg':
      return {
        ...base,
        content: { text: brief.businessName + (brief.location ? ' · ' + brief.location : '') + ' — call now' }
      };
    case 'services':
      return {
        ...base,
        content: { heading: 'Services', intro: brief.specialisation || brief.industry },
        items: ctx.services
      };
    case 'featuredProjects':
      return {
        ...base,
        content: {
          heading: foundation.category === 'retail' ? 'Selected pieces' : 'Featured work',
          intro: 'Highlights from ' + brief.businessName
        }
      };
    case 'why':
      return {
        ...base,
        content: {
          heading: 'Why ' + brief.businessName,
          intro: brief.desiredStyle
            ? 'A ' + brief.desiredStyle.toLowerCase() + ' experience.'
            : 'Built around clarity and trust.'
        }
      };
    case 'reviews':
      return { ...base, content: { heading: 'What clients say' } };
    case 'quote':
      return { ...base, content: { heading: ctx.cta, buttonText: ctx.cta } };
    case 'faq':
      return { ...base, content: { heading: 'FAQs' } };
    case 'footer':
      return {
        ...base,
        content: { blurb: brief.businessName + (brief.location ? ' — ' + brief.location : '') }
      };
    case 'specialOffer':
      return {
        ...base,
        content: {
          heading: 'Current offer',
          text: 'Ask about our latest ' + (brief.location || '') + ' availability.'
        }
      };
    case 'trustBar':
      return { ...base, content: { heading: 'Trusted locally' } };
    case 'crew':
      return { ...base, content: { heading: 'Meet the team' } };
    case 'area':
      return {
        ...base,
        content: { heading: 'Areas we serve', intro: brief.location || 'Local coverage' }
      };
    case 'serviceProcess':
      return { ...base, content: { heading: 'How we work' } };
    default:
      return { ...base, content: { heading: key } };
  }
}

function adjustPalette(base, category) {
  if (category === 'trade' || category === 'property') {
    return {
      pipe: '#0B1F33',
      hivis: '#F5B700',
      steel: '#1F3A54',
      safety: '#E8EEF4',
      lightBg: '#F7F9FB',
      presetName: base.presetName
    };
  }
  if (category === 'hospitality') {
    return {
      pipe: '#3B2F2F',
      hivis: '#C27A4A',
      steel: '#6B4F4F',
      safety: '#F3E7D3',
      lightBg: '#FFF9F2',
      presetName: base.presetName
    };
  }
  return { ...base };
}

/**
 * Try Brain structured generation; always fall back to Website Composer.
 * @param {object} brain
 * @param {object} brief
 * @param {object} [opts]
 */
async function generateConceptsWithBrain(brain, brief, opts) {
  const deterministic = await buildDeterministicConcepts(brief, opts);
  if (!brain || typeof brain.generateStructured !== 'function') {
    return { ...deterministic, source: 'website_composer' };
  }

  try {
    const result = await brain.generateStructured({
      taskId: 'theme_studio.concept_generation',
      promptId: 'theme_studio.concept_generation',
      temperature: 0.55,
      input: {
        briefJson: JSON.stringify(normalizeBrief(brief)),
        foundationId: (opts && opts.foundationId) || '',
        slot: 'A'
      },
      responseSchema: {
        type: 'object',
        required: ['concept'],
        properties: { concept: { type: 'object' } }
      }
    });
    // Brain output is advisory only in Phase 2 — Composer remains source of truth
    // for complete, non-trade-inherited drafts. Keep deterministic concepts.
    if (result && result.ok) {
      return { ...deterministic, source: 'website_composer+brain_acknowledged' };
    }
  } catch (_e) {
    /* fall through */
  }

  return { ...deterministic, source: 'website_composer_fallback' };
}

module.exports = {
  normalizeBrief,
  buildDeterministicConcepts,
  generateConceptsWithBrain
};
