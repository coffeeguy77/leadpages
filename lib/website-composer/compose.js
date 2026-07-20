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
const { selectAppsForConcept, installAppsIntoDraft } = require('./install-apps');
const { buildStructuredImageBriefs, pickImageDirection } = require('./image-direction');
const { resolveImageBriefs } = require('../image-service');
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
    logoImageUrl: String(b.logoImageUrl || b.logoUrl || '').trim(),
    existingImages: String(b.existingImages || '').trim(),
    testimonials: list(b.testimonials),
    certifications: list(b.certifications),
    awards: list(b.awards),
    clientLogos: list(b.clientLogos),
    guarantees: list(b.guarantees),
    notes: String(b.notes || b.brief || b.shortDescription || '').trim()
  };
}

function normalizeHex(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const h = s.charAt(0) === '#' ? s : '#' + s;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) return h.length === 4
    ? ('#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]).toLowerCase()
    : h.toLowerCase();
  return '';
}

function luminance(hex) {
  const h = normalizeHex(hex).slice(1);
  if (h.length !== 6) return 0.5;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Build three distinct themes from operator-preferred colours when provided. */
function themesFromPreferred(preferred, base, slot) {
  const hexes = (preferred || []).map(normalizeHex).filter(Boolean);
  if (hexes.length < 2) return null;
  const dark = hexes.find((h) => luminance(h) < 0.45) || hexes[0];
  const light = hexes.find((h) => luminance(h) >= 0.45) || hexes[1];
  const accent = hexes.find((h) => h !== dark && h !== light) || base.hivis || '#C4A484';
  const variants = [
    {
      pipe: dark,
      hivis: accent,
      steel: dark,
      safety: light,
      lightBg: light,
      presetName: (base.presetName || 'Brand') + ' · Primary'
    },
    {
      pipe: dark,
      hivis: light,
      steel: accent,
      safety: '#F4F1EC',
      lightBg: '#FAFAF8',
      presetName: (base.presetName || 'Brand') + ' · Contrast'
    },
    {
      pipe: accent,
      hivis: dark,
      steel: dark,
      safety: light,
      lightBg: light,
      presetName: (base.presetName || 'Brand') + ' · Clarity'
    }
  ];
  return variants[slot % variants.length];
}

/**
 * Nudge (never flatten) slot palettes by foundation category.
 * Preferred colours from the brief always win and stay distinct per slot.
 */
function adjustPalette(base, category, brief, slot) {
  const fromBrief = themesFromPreferred(brief && brief.preferredColours, base, slot || 0);
  if (fromBrief) return fromBrief;

  // Keep Signature / Contrast / Clarity visually distinct — do not collapse
  // every trade/auto slot onto the same hi-vis navy/yellow pair.
  if (category === 'trades' || category === 'construction' || category === 'automotive') {
    const industrial = [
      {
        pipe: '#0B1F33',
        hivis: '#F5B700',
        steel: '#1F3A54',
        safety: '#E8EEF4',
        lightBg: '#F7F9FB',
        presetName: 'Industrial Bold'
      },
      {
        pipe: '#111827',
        hivis: '#F97316',
        steel: '#1F2937',
        safety: '#F3F4F6',
        lightBg: '#FAFAFA',
        presetName: 'Workshop Heat'
      },
      {
        pipe: '#0F172A',
        hivis: '#38BDF8',
        steel: '#1E293B',
        safety: '#E2E8F0',
        lightBg: '#F8FAFC',
        presetName: 'Steel Clarity'
      }
    ];
    const pick = industrial[(slot || 0) % industrial.length];
    return { ...pick, presetName: pick.presetName + ' · ' + (base.presetName || '') };
  }
  if (category === 'hospitality' || category === 'beauty') {
    const warm = [
      { pipe: '#3B2F2F', hivis: '#C27A4A', steel: '#6B4F4F', safety: '#F3E7D3', lightBg: '#FFF9F2', presetName: 'Warm Hospitality' },
      { pipe: '#2C1810', hivis: '#D4A574', steel: '#5C4033', safety: '#F7EDE4', lightBg: '#FFFBF7', presetName: 'Espresso' },
      { pipe: '#4A3040', hivis: '#E8B4B8', steel: '#6B4A5A', safety: '#F8E8EC', lightBg: '#FFF8FA', presetName: 'Blush Service' }
    ];
    return warm[(slot || 0) % warm.length];
  }
  return { ...base };
}

/**
 * Compose N complete website concepts from a brief (async — resolves images).
 * Does NOT clone trade template content. Does NOT shallow-merge source sites.
 *
 * @param {object} briefInput
 * @param {{
 *   foundationId?: string,
 *   recipeId?: string,
 *   count?: number,
 *   sourceConfig?: object|null,
 *   actor?: object,
 *   ownedCloudinaryAssets?: object[],
 *   allowMockImages?: boolean,
 *   fetchImpl?: Function
 * }} [opts]
 */
async function composeWebsiteConcepts(briefInput, opts) {
  const options = opts || {};
  const brief = normalizeBrief(briefInput);
  if (!brief.businessName || !brief.industry) {
    return {
      ok: false,
      errors: [{ code: 'brief_incomplete', message: 'businessName and industry are required' }]
    };
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
    const built = await composeOne({
      brief: classifiedBrief,
      profile,
      foundation,
      recipe,
      layoutId,
      theme: adjustPalette(
        PALETTE_PRESETS[i % PALETTE_PRESETS.length],
        foundation.category,
        classifiedBrief,
        i
      ),
      slot: i,
      actor: options.actor || { isSuperuser: true },
      ownedCloudinaryAssets: options.ownedCloudinaryAssets || [],
      allowMockImages: options.allowMockImages !== false,
      fetchImpl: options.fetchImpl
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

async function composeOne({
  brief,
  profile,
  foundation,
  recipe,
  layoutId,
  theme,
  slot,
  actor,
  ownedCloudinaryAssets,
  allowMockImages,
  fetchImpl
}) {
  const names = ['Signature', 'Contrast', 'Clarity'];
  const appSelection = selectAppsForConcept({ foundation, recipe, profile, brief, slot });
  const sectionOrder = appSelection.sectionOrder;
  // Hero slider must use the shell layout that actually reveals the slider.
  let effectiveLayoutId = layoutId;
  const preferredLayout =
    appSelection.layoutHints && appSelection.layoutHints.preferredLayoutId;
  if (
    preferredLayout &&
    (foundation.compatibleLayoutIds || []).includes(preferredLayout)
  ) {
    effectiveLayoutId = preferredLayout;
  }
  const cta = primaryCta(brief, recipe);
  const generated = generateSectionContent(brief, profile, foundation, recipe, {
    sectionOrder,
    cta,
    slot,
    layoutId: effectiveLayoutId
  });

  const direction = pickImageDirection(profile, foundation, slot);
  const structuredImages = buildStructuredImageBriefs({
    brief,
    profile,
    foundation,
    sectionOrder,
    direction
  });

  let imageResolution;
  try {
    imageResolution = await resolveImageBriefs(structuredImages.briefs, {
      actor,
      ownedCloudinaryAssets,
      allowMock: allowMockImages,
      fetchImpl
    });
  } catch (_e) {
    imageResolution = { ok: true, results: [], diagnostics: [], usedProviderAssetIds: [] };
  }

  /** @type {Record<string, object>} */
  const imagesBySection = {};
  const imageSelections = [];
  const galleryImages = [];
  const sliderImages = [];
  const trustImages = [];
  for (const r of imageResolution.results || []) {
    if (!r.selection) continue;
    imageSelections.push(r.selection);
    const sid = r.brief && r.brief.sectionId;
    if (!sid) continue;
    imagesBySection[sid] = r.selection;
    if (sid === 'featuredProjects' || String(sid).startsWith('featuredProjects:')) {
      galleryImages.push(r.selection);
    }
    if (String(sid).startsWith('heroSlider:')) {
      sliderImages.push(r.selection);
    }
    if (String(sid).startsWith('trustBar:')) {
      trustImages.push(r.selection);
    }
  }
  if (sliderImages.length) imagesBySection.heroSlider = sliderImages[0];
  if (trustImages.length) imagesBySection.trustBar = trustImages[0];
  if (galleryImages.length && generated.sections.featuredProjects) {
    const projects =
      generated.sections.featuredProjects.projects ||
      generated.sections.featuredProjects.items ||
      [];
    projects.forEach((p, idx) => {
      const keyed = imagesBySection['featuredProjects:' + idx];
      const pick = keyed || galleryImages[idx];
      if (pick) p.image = pick.selectedVariantUrl || pick.sourceImageUrl;
    });
    generated.sections.featuredProjects.projects = projects;
    imagesBySection.featuredProjects = galleryImages[0];
  }
  if (generated.sections.heroSlider && Array.isArray(generated.sections.heroSlider.slides)) {
    generated.sections.heroSlider.slides = generated.sections.heroSlider.slides.map((slide, idx) => {
      const pick = imagesBySection['heroSlider:' + idx] || sliderImages[idx] || sliderImages[0];
      const url = pick && (pick.selectedVariantUrl || pick.sourceImageUrl);
      return url ? { ...slide, imageUrl: url, image: url } : slide;
    });
  }
  if (generated.sections.trustBar && Array.isArray(generated.sections.trustBar.badges)) {
    generated.sections.trustBar.badges = generated.sections.trustBar.badges.map((badge, idx) => {
      const pick = imagesBySection['trustBar:' + idx] || trustImages[idx];
      const url = pick && (pick.selectedVariantUrl || pick.sourceImageUrl);
      return url ? { ...badge, image: url, imageUrl: url, on: badge.on !== false } : badge;
    });
    if (generated.sections.trustBar.badges.some((b) => b.image)) {
      generated.sections.trustBar.mode = 'images';
    }
  }

  // Attach gallery/hero imagery onto service cards so the services grid is not icon-empty.
  if (Array.isArray(generated.services) && generated.services.length) {
    const pool = galleryImages.length
      ? galleryImages
      : imageSelections.filter((s) => s && (s.selectedVariantUrl || s.sourceImageUrl));
    const heroPick = imagesBySection.hero;
    generated.services = generated.services.map((svc, idx) => {
      if (svc && svc.image) return svc;
      const pick = pool[idx] || pool[idx % Math.max(1, pool.length)] || heroPick;
      const url = pick && (pick.selectedVariantUrl || pick.sourceImageUrl);
      return url ? { ...svc, image: url } : svc;
    });
    if (generated.sections.services && Array.isArray(generated.sections.services.items)) {
      generated.sections.services.items = generated.services;
    }
  }

  const installed = installAppsIntoDraft({
    sectionOrder,
    sectionContentMap: generated.sections,
    imagesBySection,
    provenanceMap: generated.provenanceMap
  });

  if (!installed.ok) {
    return {
      ok: false,
      errors: installed.errors,
      diagnostics: { appSelection, adapterErrors: installed.errors }
    };
  }

  const heroVariant = appSelection.heroAppId || 'hero';
  const compat = checkFoundationCompatibility(foundation, {
    layoutId: effectiveLayoutId,
    sectionKeys: sectionOrder.filter((k) => k !== 'footer'),
    heroVariant: ['hero', 'heroSlider', 'splitHero', 'heroBeforeAfter'].includes(heroVariant)
      ? heroVariant
      : 'hero'
  });

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
      effectiveLayoutId +
      ', hero ' +
      heroVariant +
      '.',
    foundationId: foundation.id,
    rendererShellId: RENDERER_SHELL_NEUTRAL_V1,
    recipeId: recipe.id,
    sourceAppIds: installed.installedApps.map((a) => a.appId),
    businessProfile: {
      businessName: brief.businessName,
      industry: brief.industry,
      specialisation: brief.specialisation,
      location: brief.location,
      audience: brief.audience,
      tone: brief.desiredStyle,
      conversionGoal: brief.conversionGoal || recipe.conversionStyle || foundation.conversionStyle,
      desiredStyle: brief.desiredStyle,
      classificationProfileId: profile.profileId,
      logoImageUrl: brief.logoImageUrl || '',
      phoneCta: brief.phoneCta || ''
    },
    logo: brief.logoImageUrl
      ? { mode: 'image', imageUrl: brief.logoImageUrl, text: brief.businessName }
      : { mode: 'text', text: brief.businessName },
    theme,
    typography: {
      fontDisplay: foundation.typographyProfile.headingFont,
      fontUi: foundation.typographyProfile.bodyFont
    },
    globalStyles: {
      buttonTreatment: 'solid',
      cardTreatment: foundation.category === 'retail' ? 'flat' : 'bordered',
      motionDirection: 'subtle',
      density: appSelection.layoutHints.density || foundation.spacingProfile || 'balanced',
      colorMode: 'light'
    },
    layoutId: effectiveLayoutId,
    header: {
      headerStyle: (foundation.supportedHeaderVariants || ['solid-sticky'])[slot % 2],
      ctaLabel: generated.cta
    },
    navigation: { items: cloneNav(foundation.navigationDefaults) },
    pages: [{ id: 'home', title: 'Home', path: '/' }],
    sectionOrder,
    sections: installed.sections,
    // Selected hero wins over recipe default so concept slots can diversify.
    sectionVariants: { ...(recipe.variants || {}), hero: heroVariant },
    content: {},
    callsToAction: {
      primary: { label: generated.cta, action: (recipe.ctas && recipe.ctas.primaryAction) || 'enquire' },
      secondary: {
        label: 'Learn more',
        action: (recipe.ctas && recipe.ctas.secondaryAction) || 'services'
      }
    },
    imagery: imageSelections,
    imageDirection: direction,
    structuredImageBriefs: structuredImages.briefs,
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
    placeholderFields: imageSelections.some((s) => s.placeholder)
      ? [{ field: 'imagery', reason: 'One or more slots used safe placeholders' }]
      : [],
    validationStatus: 'pending',
    warnings: compat.ok ? [] : compat.errors,
    provenance: {
      generatedBy: 'website_composer',
      createdAt: new Date().toISOString(),
      brainTasks: [],
      sectionProvenance: generated.provenanceMap,
      foundationContribution: PROVENANCE.FOUNDATION,
      recipeContribution: PROVENANCE.RECIPE
    },
    services: installed.services || generated.services,
    installedApps: installed.installedApps,
    imageBriefs: generated.imageBriefs
  };

  const validated = validateConcept(concept, { checkLeakage: true });
  const draftBuild = validated.ok
    ? buildDraftConfig({
        concept,
        foundation,
        recipe,
        provenanceMap: generated.provenanceMap,
        imageBriefs: generated.imageBriefs,
        installedApps: installed.installedApps,
        imageSelections,
        imageDirection: direction,
        imageDiagnostics: imageResolution.diagnostics
      })
    : { ok: false, errors: validated.errors, warnings: validated.warnings, sectionsSkipped: [] };

  // Prefer adapter-installed section payloads on the draft
  if (draftBuild.ok && draftBuild.draftConfig) {
    draftBuild.draftConfig.sections = {
      ...draftBuild.draftConfig.sections,
      ...installed.sections
    };
    for (const key of Object.keys(draftBuild.draftConfig.sections)) {
      if (!sectionOrder.includes(key) && draftBuild.draftConfig.sections[key]) {
        draftBuild.draftConfig.sections[key] = {
          on: false,
          provenance: PROVENANCE.FOUNDATION,
          disabledReason: 'not_in_composition'
        };
      }
    }
    draftBuild.draftConfig.sectionOrder = sectionOrder;
    if (installed.services) draftBuild.draftConfig.services = installed.services;
  }

  const diagnostics = buildDiagnostics({
    brief,
    profile,
    foundation,
    recipe,
    layoutId: effectiveLayoutId,
    sectionOrder,
    provenanceMap: generated.provenanceMap,
    imageBriefs: generated.imageBriefs,
    apps: installed.installedApps,
    sectionsSkipped: draftBuild.sectionsSkipped || [],
    validation: validated,
    draftBuild,
    rendererWarnings: [
      {
        code: 'shell_neutral_v1',
        message:
          'Preview uses landing-shell-neutral-v1. Live trade.template.json is unchanged for production trade sites.'
      }
    ]
  });
  diagnostics.appSelection = appSelection;
  diagnostics.imageDirection = direction;
  diagnostics.image = imageResolution.diagnostics;
  diagnostics.installedApps = installed.installedApps;
  diagnostics.layoutChoiceReasons = [
    { layoutId: effectiveLayoutId, reason: 'recipe_layout_pool_slot_' + slot },
    {
      layoutId: effectiveLayoutId,
      reason:
        preferredLayout && effectiveLayoutId === preferredLayout
          ? 'hero_slider_requires_hero_image_slider_layout'
          : 'recipe_layout_pool_slot_' + slot
    },
    { heroAppId: heroVariant, reason: 'concept_slot_diversity' }
  ];

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
