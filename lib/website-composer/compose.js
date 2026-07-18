'use strict';

const { randomUUID } = require('crypto');
const {
  PROVENANCE,
  RENDERER_SHELL_NEUTRAL_V1,
  PROTECTED_FIELDS
} = require('./constants');
const { classifyBusiness } = require('./classify');
const {
  getFoundation,
  selectFoundationCandidates,
  checkFoundationCompatibility
} = require('./foundations');
const { selectRecipe, selectRecipeCandidates, getRecipe } = require('./recipes');
const { primaryCta, generateSectionContent } = require('./content');
const { buildDraftConfig } = require('./build-draft');
const { buildDiagnostics } = require('./diagnostics');
const { validateConcept } = require('../theme-studio/validate-concept');

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
 * Normalize intake brief (shared with Website Studio UI).
 * @param {object} raw
 */
function normalizeBrief(raw) {
  const b = raw || {};
  const list = (v) => {
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === 'string' && v.trim()) {
      return v
        .split(/[\n,;|]/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
    return [];
  };
  return {
    businessName: String(b.businessName || b.business_name || '').trim(),
    industry: String(b.industry || '').trim(),
    businessType: String(b.businessType || b.business_type || '').trim(),
    specialisation: String(b.specialisation || b.specialization || '').trim(),
    location: String(b.location || '').trim(),
    serviceAreas: list(b.serviceAreas || b.service_areas),
    yearsOperating: String(b.yearsOperating || b.years_operating || '').trim(),
    shortDescription: String(b.shortDescription || b.description || '').trim(),
    mainServices: list(b.mainServices || b.services),
    products: list(b.products),
    packages: list(b.packages),
    primaryOffer: String(b.primaryOffer || '').trim(),
    differentiators: list(b.differentiators),
    pricingDisplay: String(b.pricingDisplay || '').trim(),
    promotions: list(b.promotions),
    faqs: list(b.faqs),
    processNotes: String(b.processNotes || b.process || '').trim(),
    audience: String(b.audience || '').trim(),
    customerProblems: list(b.customerProblems),
    buyingPriorities: list(b.buyingPriorities),
    tone: String(b.tone || b.desiredStyle || b.style || '').trim(),
    desiredStyle: String(b.desiredStyle || b.style || b.tone || '').trim(),
    geographicFocus: String(b.geographicFocus || '').trim(),
    conversionGoal: String(b.conversionGoal || b.primaryConversion || '').trim(),
    secondaryConversionGoal: String(b.secondaryConversionGoal || '').trim(),
    phoneCta: String(b.phoneCta || b.phone || '').trim(),
    formCta: String(b.formCta || '').trim(),
    bookingCta: String(b.bookingCta || '').trim(),
    preferredColours: list(b.preferredColours || b.colors),
    coloursToAvoid: list(b.coloursToAvoid || b.colorsToAvoid),
    visualStyle: String(b.visualStyle || b.desiredStyle || '').trim(),
    typographyDirection: String(b.typographyDirection || '').trim(),
    existingWebsiteUrl: String(b.existingWebsiteUrl || b.websiteUrl || '').trim(),
    inspirationNotes: String(b.inspirationNotes || '').trim(),
    testimonials: list(b.testimonials),
    certifications: list(b.certifications),
    awards: list(b.awards),
    clientLogos: list(b.clientLogos),
    guarantees: list(b.guarantees),
    notes: String(b.notes || b.brief || b.shortDescription || '').trim()
  };
}

function adjustPalette(base, category) {
  if (category === 'trades' || category === 'construction' || category === 'automotive') {
    return {
      pipe: '#0B1F33',
      hivis: '#F5B700',
      steel: '#1F3A54',
      safety: '#E8EEF4',
      lightBg: '#F7F9FB',
      presetName: base.presetName
    };
  }
  if (category === 'hospitality' || category === 'beauty') {
    return {
      pipe: '#3B2F2F',
      hivis: '#C27A4A',
      steel: '#6B4F4F',
      safety: '#F3E7D3',
      lightBg: '#FFF9F2',
      presetName: base.presetName
    };
  }
  if (category === 'retail') {
    return { ...base };
  }
  return { ...base };
}

/**
 * Compose N complete website concepts from a brief.
 * Does NOT clone trade template content. Does NOT shallow-merge source sites.
 *
 * @param {object} briefInput
 * @param {{
 *   foundationId?: string,
 *   recipeId?: string,
 *   count?: number,
 *   sourceConfig?: object|null
 * }} [opts]
 */
function composeWebsiteConcepts(briefInput, opts) {
  const options = opts || {};
  const brief = normalizeBrief(briefInput);
  if (!brief.businessName || !brief.industry) {
    return {
      ok: false,
      errors: [{ code: 'brief_incomplete', message: 'businessName and industry are required' }]
    };
  }

  // sourceConfig is intentionally ignored for section content (no shallow merge).
  if (options.sourceConfig) {
    /* redesign identity only — content still composed fresh */
  }

  const profile = classifyBusiness(brief);
  const classifiedBrief = {
    ...brief,
    industry: brief.industry || profile.industry,
    specialisation: brief.specialisation || profile.specialisation
  };

  let foundationId = options.foundationId || profile.preferredFoundationId;
  if (!foundationId) {
    const candidates = selectFoundationCandidates(classifiedBrief, { minScore: -50, limit: 1 });
    foundationId = candidates[0] && candidates[0].foundationId;
  }
  const foundation = getFoundation(foundationId);
  if (!foundation) {
    return {
      ok: false,
      errors: [{ code: 'foundation_missing', message: 'No foundation available for brief' }]
    };
  }

  const recipe =
    selectRecipe(
      {
        foundationId: foundation.id,
        industry: classifiedBrief.industry,
        specialisation: classifiedBrief.specialisation,
        notes: classifiedBrief.notes,
        profileId: profile.profileId
      },
      { recipeId: options.recipeId || profile.preferredRecipeId }
    ) || getRecipe('recipe-generic-local');

  const layoutPool = unique([
    ...(recipe.layoutIds || []),
    ...(foundation.compatibleLayoutIds || []),
    foundation.defaultLayoutId
  ]).filter((id) => (foundation.compatibleLayoutIds || []).includes(id));
  while (layoutPool.length < 3) {
    layoutPool.push(foundation.defaultLayoutId);
  }

  const concepts = [];
  const discarded = [];
  const count = options.count || 3;

  for (let i = 0; i < count; i++) {
    const layoutId = layoutPool[i % layoutPool.length];
    const built = composeOne({
      brief: classifiedBrief,
      profile,
      foundation,
      recipe,
      layoutId,
      theme: adjustPalette(PALETTE_PRESETS[i % PALETTE_PRESETS.length], foundation.category),
      slot: i
    });
    if (!built.ok) {
      discarded.push({ slot: i, errors: built.errors, diagnostics: built.diagnostics });
      continue;
    }
    concepts.push(built);
  }

  if (!concepts.length) {
    return {
      ok: false,
      errors: discarded.flatMap((d) => d.errors || []),
      foundationId: foundation.id,
      recipeId: recipe.id,
      profile,
      discarded
    };
  }

  return {
    ok: true,
    foundationId: foundation.id,
    foundationName: foundation.name,
    recipeId: recipe.id,
    recipeName: recipe.name,
    profile,
    candidates: selectFoundationCandidates(classifiedBrief, { limit: 5 }),
    recipeCandidates: selectRecipeCandidates(
      {
        foundationId: foundation.id,
        industry: classifiedBrief.industry,
        specialisation: classifiedBrief.specialisation,
        notes: classifiedBrief.notes,
        profileId: profile.profileId
      },
      { limit: 5 }
    ),
    concepts: concepts.map((c) => ({
      concept: c.concept,
      draftConfig: c.draftConfig,
      adapterWarnings: c.adapterWarnings,
      writtenPaths: c.writtenPaths,
      diagnostics: c.diagnostics
    })),
    discarded,
    source: 'website_composer'
  };
}

function composeOne({ brief, profile, foundation, recipe, layoutId, theme, slot }) {
  const names = ['Signature', 'Contrast', 'Clarity'];
  const sectionOrder = resolveSectionOrder(foundation, recipe);
  const cta = primaryCta(brief, recipe);
  const generated = generateSectionContent(brief, profile, foundation, recipe, {
    sectionOrder,
    cta
  });

  const compat = checkFoundationCompatibility(foundation, {
    layoutId,
    sectionKeys: sectionOrder,
    heroVariant: (recipe.variants && recipe.variants.hero) || 'hero'
  });
  if (!compat.ok) {
    return {
      ok: false,
      errors: compat.errors,
      diagnostics: buildDiagnostics({
        brief,
        profile,
        foundation,
        recipe,
        layoutId,
        sectionOrder,
        provenanceMap: generated.provenanceMap,
        imageBriefs: generated.imageBriefs,
        apps: recipe.apps,
        validation: { ok: false, errors: compat.errors, warnings: [] },
        draftBuild: { ok: false, errors: [], warnings: [] }
      })
    };
  }

  const concept = {
    schemaVersion: 1,
    conceptId: 'concept_' + randomUUID().replace(/-/g, '').slice(0, 12),
    conceptName: names[slot] + ' · ' + recipe.name,
    rationale:
      'Website Composer concept ' +
      (slot + 1) +
      ' for ' +
      brief.businessName +
      ' — foundation ' +
      foundation.id +
      ', recipe ' +
      recipe.id +
      ', layout ' +
      layoutId +
      '.',
    foundationId: foundation.id,
    // Intentionally omit sourceTemplateId — no trade template inheritance.
    rendererShellId: RENDERER_SHELL_LANDING_V1,
    recipeId: recipe.id,
    sourceAppIds: (recipe.apps || []).map((a) => a.sectionKey).slice(0, 8),
    businessProfile: {
      businessName: brief.businessName,
      industry: brief.industry,
      specialisation: brief.specialisation,
      location: brief.location,
      audience: brief.audience,
      tone: brief.desiredStyle,
      conversionGoal: brief.conversionGoal || recipe.conversionStyle || foundation.conversionStyle,
      desiredStyle: brief.desiredStyle,
      classificationProfileId: profile.profileId
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
      density: foundation.spacingProfile || 'balanced',
      colorMode: 'light'
    },
    layoutId,
    header: {
      headerStyle: (foundation.supportedHeaderVariants || ['solid-sticky'])[0],
      ctaLabel: generated.cta
    },
    navigation: {
      items: cloneNav(foundation.navigationDefaults)
    },
    pages: [{ id: 'home', title: 'Home', path: '/' }],
    sectionOrder,
    sections: generated.sections,
    sectionVariants: { ...(recipe.variants || {}) },
    content: {},
    callsToAction: {
      primary: { label: generated.cta, action: (recipe.ctas && recipe.ctas.primaryAction) || 'enquire' },
      secondary: {
        label: 'Learn more',
        action: (recipe.ctas && recipe.ctas.secondaryAction) || 'services'
      }
    },
    imagery: Object.entries(generated.imageBriefs).map(([slotKey, subject]) => ({
      slot: slotKey,
      sectionKey: slotKey.startsWith('hero') ? 'hero' : 'featuredProjects',
      subject,
      composition: 'editorial',
      // Phase 3 Image Service will resolve these descriptors.
      provider: 'placeholder',
      altDirection: subject
    })),
    footer: { blurb: brief.businessName + (brief.location ? ' — ' + brief.location : '') },
    mobileRules: {
      notes: ['Stack hero copy below imagery on small screens'],
      stickyCta: !!(foundation.mobileProfile && foundation.mobileProfile.stickyCta),
      stackOrder: (foundation.mobileProfile && foundation.mobileProfile.stackOrder) || 'content-first'
    },
    accessibilityNotes: ['Maintain CTA contrast against lightBg'],
    preservedFields: PROTECTED_FIELDS.slice(),
    generatedFields: [
      'theme',
      'sections',
      'services',
      'layout',
      'sectionOrder',
      'name',
      'trade',
      'pages',
      'imagery'
    ],
    placeholderFields: [{ field: 'imagery', reason: 'Resolved by Image Service in Phase 3' }],
    validationStatus: 'pending',
    warnings: [],
    provenance: {
      generatedBy: 'website_composer',
      createdAt: new Date().toISOString(),
      brainTasks: [],
      sectionProvenance: generated.provenanceMap,
      foundationContribution: PROVENANCE.FOUNDATION,
      recipeContribution: PROVENANCE.RECIPE
    },
    services: generated.services,
    imageBriefs: generated.imageBriefs
  };

  const validated = validateConcept(concept, { checkLeakage: true });
  const draftBuild = validated.ok
    ? buildDraftConfig({
        concept,
        foundation,
        recipe,
        provenanceMap: generated.provenanceMap,
        imageBriefs: generated.imageBriefs
      })
    : { ok: false, errors: validated.errors, warnings: validated.warnings, sectionsSkipped: [] };

  const diagnostics = buildDiagnostics({
    brief,
    profile,
    foundation,
    recipe,
    layoutId,
    sectionOrder,
    provenanceMap: generated.provenanceMap,
    imageBriefs: generated.imageBriefs,
    apps: recipe.apps,
    sectionsSkipped: draftBuild.sectionsSkipped || [],
    validation: validated,
    draftBuild,
    rendererWarnings: [
      {
        code: 'shell_neutral_v1',
        message:
          'Preview uses landing-shell-v1 HTML asset (legacy trade.template.json) as a renderer shell only — content was composed explicitly with no trade inheritance.'
      }
    ]
  });

  if (!validated.ok || !draftBuild.ok) {
    return {
      ok: false,
      errors: [...(validated.errors || []), ...(draftBuild.errors || [])],
      diagnostics
    };
  }

  return {
    ok: true,
    concept: {
      ...concept,
      validationStatus: 'valid',
      warnings: validated.warnings,
      diagnostics
    },
    draftConfig: draftBuild.draftConfig,
    adapterWarnings: [...(draftBuild.warnings || [])],
    writtenPaths: draftBuild.writtenPaths,
    diagnostics
  };
}

function resolveSectionOrder(foundation, recipe) {
  const supported = new Set(foundation.supportedSectionKeys || []);
  const incompatible = new Set((foundation.incompatibilities && foundation.incompatibilities.sectionKeys) || []);
  let order = (recipe.sectionOrder && recipe.sectionOrder.length
    ? recipe.sectionOrder
    : foundation.defaultSectionOrder || []
  ).filter((k) => supported.has(k) && !incompatible.has(k));

  for (const key of foundation.requiredSectionKeys || []) {
    if (!order.includes(key) && supported.has(key)) order.push(key);
  }
  for (const key of recipe.requiredSectionKeys || []) {
    if (!order.includes(key) && supported.has(key) && !incompatible.has(key)) order.push(key);
  }
  return order;
}

function cloneNav(items) {
  return (items || []).map((i) => ({ ...i }));
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

module.exports = {
  normalizeBrief,
  composeWebsiteConcepts,
  classifyBusiness
};
