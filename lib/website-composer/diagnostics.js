'use strict';

/**
 * Build Website Composer diagnostics for a composed concept/draft.
 */
function buildDiagnostics(input) {
  const {
    brief,
    profile,
    foundation,
    recipe,
    layoutId,
    sectionOrder,
    provenanceMap,
    imageBriefs,
    apps,
    sectionsSkipped,
    validation,
    draftBuild,
    rendererWarnings
  } = input;

  const contentSources = {};
  for (const [key, value] of Object.entries(provenanceMap || {})) {
    if (key.startsWith('__')) continue;
    contentSources[key] = value;
  }

  return {
    ok: !!(validation && validation.ok && draftBuild && draftBuild.ok),
    pipeline: [
      'business_brief',
      'business_classification',
      'industry_profile',
      'foundation',
      'marketplace_recipe',
      'layout_selection',
      'content_generation',
      'image_briefs',
      'renderer_configuration',
      'draft_preview_ready'
    ],
    brief: {
      businessName: brief && brief.businessName,
      industry: brief && brief.industry
    },
    classification: profile
      ? {
          profileId: profile.profileId,
          label: profile.label,
          industry: profile.industry,
          confidence: profile.confidence,
          signals: profile.signals
        }
      : null,
    foundation: foundation
      ? {
          id: foundation.id,
          name: foundation.name,
          category: foundation.category,
          conversionStyle: foundation.conversionStyle,
          spacingProfile: foundation.spacingProfile,
          sourceTemplateId: foundation.sourceTemplateId,
          rendererShellId: foundation.rendererShellId
        }
      : null,
    recipe: recipe
      ? {
          id: recipe.id,
          name: recipe.name,
          conversionStyle: recipe.conversionStyle,
          apps: (recipe.apps || []).map((a) => a.sectionKey)
        }
      : null,
    appsSelected: (apps || []).map((a) => (typeof a === 'string' ? a : a.sectionKey)),
    layoutSelected: layoutId || null,
    sectionOrder: sectionOrder || [],
    contentSources,
    imageBriefs: imageBriefs || {},
    sectionsSkipped: sectionsSkipped || [],
    validationWarnings: (validation && validation.warnings) || [],
    validationErrors: (validation && validation.errors) || [],
    draftWarnings: (draftBuild && draftBuild.warnings) || [],
    draftErrors: (draftBuild && draftBuild.errors) || [],
    rendererWarnings: rendererWarnings || [],
    notes: [
      'Foundations are structural only — no business copy.',
      'Recipes are independent of foundations.',
      'Draft composition does not shallow-merge trade template content.',
      'Marketplace apps are selected only when catalogue status is supported and an adapter exists.',
      'Images resolve through Image Service (Cloudinary → Pexels → AI superuser-only → placeholder).'
    ]
  };
}

module.exports = { buildDiagnostics };
