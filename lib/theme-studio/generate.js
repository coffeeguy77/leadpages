'use strict';

const { randomUUID } = require('crypto');
const {
  selectFoundationCandidates,
  getFoundation
} = require('./foundations');
const { validateConcept } = require('./validate-concept');
const { adaptConceptToSiteConfig } = require('./adapt-to-site-config');
const { PROTECTED_FIELDS } = require('./constants');

/** Distinct palette seeds per concept slot (luxury → trade → warm). */
const PALETTE_PRESETS = [
  {
    pipe: '#2A1020',
    hivis: '#C4A1A8',
    steel: '#5C3A4A',
    safety: '#F2E6EA',
    lightBg: '#FBF7F8',
    presetName: 'Editorial Soft'
  },
  {
    pipe: '#0B1F33',
    hivis: '#F5B700',
    steel: '#1F3A54',
    safety: '#E8EEF4',
    lightBg: '#F7F9FB',
    presetName: 'Bold Contrast'
  },
  {
    pipe: '#1C2430',
    hivis: '#3D6B8C',
    steel: '#334155',
    safety: '#E8EEF4',
    lightBg: '#F8FAFC',
    presetName: 'Calm Authority'
  }
];

/**
 * Normalize intake brief.
 * @param {object} raw
 */
function normalizeBrief(raw) {
  const b = raw || {};
  return {
    businessName: String(b.businessName || b.business_name || '').trim(),
    industry: String(b.industry || '').trim(),
    specialisation: String(b.specialisation || b.specialization || '').trim(),
    location: String(b.location || '').trim(),
    audience: String(b.audience || '').trim(),
    desiredStyle: String(b.desiredStyle || b.style || '').trim(),
    conversionGoal: String(b.conversionGoal || '').trim(),
    notes: String(b.notes || b.brief || '').trim()
  };
}

/**
 * Build three deterministic concepts from a brief (no live AI required).
 * Used as the reliable path for mock Brain and as fallback when AI fails validation.
 *
 * @param {object} briefInput
 * @param {{ foundationId?: string, sourceConfig?: object|null, count?: number }} [opts]
 */
function buildDeterministicConcepts(briefInput, opts) {
  const options = opts || {};
  const brief = normalizeBrief(briefInput);
  if (!brief.businessName || !brief.industry) {
    return {
      ok: false,
      errors: [{ code: 'brief_incomplete', message: 'businessName and industry are required' }]
    };
  }

  let foundationId = options.foundationId;
  if (!foundationId) {
    const candidates = selectFoundationCandidates(brief, { minScore: -50, limit: 1 });
    foundationId = candidates[0] && candidates[0].foundationId;
  }
  const foundation = getFoundation(foundationId);
  if (!foundation) {
    return {
      ok: false,
      errors: [{ code: 'foundation_missing', message: 'No foundation available for brief' }]
    };
  }

  const layouts = (foundation.compatibleLayoutIds || [foundation.defaultLayoutId]).slice(0, 3);
  while (layouts.length < 3) layouts.push(foundation.defaultLayoutId);

  const services = buildServices(brief, foundation);
  const concepts = [];
  const errors = [];

  for (let i = 0; i < (options.count || 3); i++) {
    const layoutId = layouts[i % layouts.length];
    const theme = adjustPalette(PALETTE_PRESETS[i % PALETTE_PRESETS.length], foundation.category);
    const concept = buildOneConcept({
      brief,
      foundation,
      layoutId,
      theme,
      services,
      slot: i,
      sourceConfig: options.sourceConfig || null
    });
    const validated = validateConcept(concept);
    if (!validated.ok) {
      errors.push({
        slot: i,
        conceptId: concept.conceptId,
        errors: validated.errors
      });
      continue;
    }
    const adapted = adaptConceptToSiteConfig(concept, options.sourceConfig || null);
    if (!adapted.ok) {
      errors.push({
        slot: i,
        conceptId: concept.conceptId,
        errors: adapted.errors
      });
      continue;
    }
    concepts.push({
      concept: { ...concept, validationStatus: 'valid', warnings: validated.warnings },
      draftConfig: adapted.draftConfig,
      adapterWarnings: [...adapted.warnings, ...adapted.ignoredFields],
      writtenPaths: adapted.writtenPaths
    });
  }

  if (!concepts.length) {
    return { ok: false, errors, foundationId: foundation.id };
  }

  return {
    ok: true,
    foundationId: foundation.id,
    foundationName: foundation.name,
    candidates: selectFoundationCandidates(brief, { limit: 5 }),
    concepts,
    discarded: errors
  };
}

function buildOneConcept({ brief, foundation, layoutId, theme, services, slot, sourceConfig }) {
  const names = ['Signature', 'Contrast', 'Clarity'];
  const sectionOrder = (foundation.defaultSectionOrder || []).filter((k) =>
    (foundation.supportedSectionKeys || []).includes(k)
  );
  const required = foundation.requiredSectionKeys || [];
  for (const key of required) {
    if (!sectionOrder.includes(key)) sectionOrder.push(key);
  }

  const heading = heroHeading(brief, foundation);
  const subheading = heroSub(brief);
  const cta = primaryCta(brief, foundation);

  /** @type {Record<string, object>} */
  const sections = {};
  for (const key of sectionOrder) {
    sections[key] = sectionContent(key, brief, foundation, { heading, subheading, cta, services });
  }

  return {
    schemaVersion: 1,
    conceptId: 'concept_' + randomUUID().replace(/-/g, '').slice(0, 12),
    conceptName: names[slot] + ' · ' + foundation.name,
    rationale:
      'Concept ' +
      (slot + 1) +
      ' for ' +
      brief.businessName +
      ' (' +
      brief.industry +
      ') using foundation ' +
      foundation.id +
      ' and layout ' +
      layoutId +
      '.',
    foundationId: foundation.id,
    sourceTemplateId: foundation.sourceTemplateId || 'trade',
    sourceAppIds: (foundation.sourceAppIds || []).slice(0, 6),
    businessProfile: {
      businessName: brief.businessName,
      industry: brief.industry,
      specialisation: brief.specialisation,
      location: brief.location,
      audience: brief.audience,
      tone: brief.desiredStyle,
      conversionGoal: brief.conversionGoal || foundation.conversionStyle,
      desiredStyle: brief.desiredStyle
    },
    theme,
    typography: {
      fontDisplay: foundation.typographyProfile.headingFont,
      fontUi: foundation.typographyProfile.bodyFont
    },
    globalStyles: {
      buttonTreatment: 'solid',
      cardTreatment: foundation.category === 'retail' ? 'flat' : 'bordered',
      motionDirection: 'subtle',
      density: 'balanced',
      colorMode: 'light'
    },
    layoutId,
    header: {
      headerStyle: (foundation.supportedHeaderVariants || ['solid-sticky'])[0],
      ctaLabel: cta
    },
    navigation: {
      items: [
        { label: 'Services', target: '#services' },
        { label: 'Contact', target: '#quote' }
      ]
    },
    pages: [],
    sectionOrder,
    sections,
    sectionVariants: {},
    content: {},
    callsToAction: {
      primary: { label: cta, action: 'quote' },
      secondary: { label: 'Learn more', action: 'services' }
    },
    imagery: [
      {
        sectionKey: 'hero',
        subject: (foundation.imageDirectionProfile.mood || []).slice(0, 4).join(', '),
        composition: 'full-bleed editorial',
        // Do not echo foundation.avoid terms into concept text — leakage scanners
        // treat literal "drains"/"hi-vis" as content contamination.
        altDirection: 'On-brand photography for ' + foundation.category + ' only'
      }
    ],
    footer: { blurb: brief.businessName + (brief.location ? ' — ' + brief.location : '') },
    mobileRules: {
      notes: ['Stack hero copy below imagery on small screens'],
      stickyCta: !!(foundation.mobileProfile && foundation.mobileProfile.stickyCta),
      stackOrder: (foundation.mobileProfile && foundation.mobileProfile.stackOrder) || 'content-first'
    },
    accessibilityNotes: ['Maintain CTA contrast against lightBg'],
    preservedFields: PROTECTED_FIELDS.slice(),
    generatedFields: ['theme', 'sections', 'services', 'layout', 'sectionOrder', 'name', 'trade'],
    placeholderFields: [],
    validationStatus: 'pending',
    warnings: [],
    provenance: {
      generatedBy: 'deterministic',
      createdAt: new Date().toISOString(),
      brainTasks: []
    },
    services
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
 * Try Brain structured generation; always fall back to deterministic concepts.
 * @param {object} brain
 * @param {object} brief
 * @param {object} [opts]
 */
async function generateConceptsWithBrain(brain, brief, opts) {
  const deterministic = buildDeterministicConcepts(brief, opts);
  if (!brain || typeof brain.generateStructured !== 'function') {
    return { ...deterministic, source: 'deterministic' };
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
    if (result && result.ok && result.output && result.output.concept) {
      const concept = result.output.concept;
      const validated = validateConcept(concept);
      if (validated.ok) {
        const adapted = adaptConceptToSiteConfig(concept, (opts && opts.sourceConfig) || null);
        if (adapted.ok) {
          // Prefer a full set of 3: merge AI concept as first slot when valid
          if (deterministic.ok) {
            const rest = deterministic.concepts.slice(0, 2);
            return {
              ok: true,
              foundationId: concept.foundationId || deterministic.foundationId,
              foundationName: deterministic.foundationName,
              candidates: deterministic.candidates,
              concepts: [
                {
                  concept: { ...concept, validationStatus: 'valid' },
                  draftConfig: adapted.draftConfig,
                  adapterWarnings: adapted.warnings,
                  writtenPaths: adapted.writtenPaths
                },
                ...rest
              ].slice(0, 3),
              discarded: deterministic.discarded,
              source: 'brain+deterministic'
            };
          }
        }
      }
    }
  } catch (_e) {
    /* fall through */
  }

  return { ...deterministic, source: 'deterministic_fallback' };
}

module.exports = {
  normalizeBrief,
  buildDeterministicConcepts,
  generateConceptsWithBrain
};
