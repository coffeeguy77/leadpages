'use strict';

/**
 * Read-only adapter: positioning_layouts (Themes / Preset Designs)
 * → Layout Composer preset blueprint DTO.
 *
 * Never mutates the source layout. Demo packs are preview-only.
 */

const {
  normalizeApps,
  normalizeSectionOrder,
} = require('../positioning-layouts');

function positioningLayoutToPresetBlueprint(layout) {
  layout = layout || {};
  const apps = normalizeApps(layout.apps || []);
  const order = normalizeSectionOrder(
    layout.section_order || layout.sectionOrder || [],
    false
  );

  const enabledByKey = {};
  apps.forEach(function (a) {
    const key = a.section_key || a.sectionKey || a.key;
    if (!key) return;
    enabledByKey[key] = a.enabled !== false;
  });

  const seen = {};
  const sections = [];
  order.forEach(function (key) {
    if (!key || seen[key]) return;
    seen[key] = true;
    sections.push({
      key: key,
      enabled: enabledByKey[key] !== false,
      origin: 'section_order',
    });
  });
  apps.forEach(function (a) {
    const key = a.section_key || a.sectionKey || a.key;
    if (!key || seen[key]) return;
    seen[key] = true;
    sections.push({
      key: key,
      enabled: a.enabled !== false,
      origin: 'apps',
      label: a.label || null,
    });
  });

  const demoPacks = layout.demo_packs || layout.demoPacks || {};
  const hasSamplePacks =
    !!demoPacks && typeof demoPacks === 'object' && Object.keys(demoPacks).length > 0;

  return {
    kind: 'preset',
    readOnly: true,
    source: 'positioning_layouts',
    sourceId: layout.id || null,
    slug: layout.slug || '',
    name: layout.name || 'Untitled preset',
    description: layout.description || '',
    status: 'preset',
    themeRef: null,
    pages: [
      {
        id: 'home',
        label: 'Home',
        path: '/',
        sections: sections,
      },
    ],
    apps: apps.map(function (a) {
      return {
        sectionKey: a.section_key || a.sectionKey || a.key,
        enabled: a.enabled !== false,
        label: a.label || null,
      };
    }),
    preview: {
      themeImageUrl: layout.theme_image_url || layout.themeImageUrl || null,
      layoutImageUrl: layout.layout_image_url || layout.layoutImageUrl || null,
      hasSamplePacks: hasSamplePacks,
      samplePackKeys: hasSamplePacks
        ? Object.keys(demoPacks).filter(function (k) {
            return k !== '_theme' && k !== '_site';
          })
        : [],
    },
    meta: {
      industryTags: Array.isArray(layout.industry_tags)
        ? layout.industry_tags
        : Array.isArray(layout.industryTags)
          ? layout.industryTags
          : [],
      visibility: layout.visibility || 'partners',
      enabled: layout.enabled !== false,
    },
  };
}

/**
 * Deep-clone a preset into a mutable user-design shell (not persisted).
 */
function customisePresetBlueprint(presetDto, owner) {
  const base = positioningLayoutToPresetBlueprint(
    presetDto && presetDto._raw
      ? presetDto._raw
      : {
          id: presetDto && presetDto.sourceId,
          slug: presetDto && presetDto.slug,
          name: presetDto && presetDto.name,
          description: presetDto && presetDto.description,
          section_order: (
            (presetDto &&
              presetDto.pages &&
              presetDto.pages[0] &&
              presetDto.pages[0].sections) ||
            []
          ).map(function (s) {
            return s.key;
          }),
          apps: ((presetDto && presetDto.apps) || []).map(function (a) {
            return {
              section_key: a.sectionKey,
              enabled: a.enabled,
              label: a.label,
            };
          }),
          theme_image_url:
            presetDto && presetDto.preview && presetDto.preview.themeImageUrl,
          layout_image_url:
            presetDto && presetDto.preview && presetDto.preview.layoutImageUrl,
          industry_tags:
            presetDto && presetDto.meta && presetDto.meta.industryTags,
          visibility: presetDto && presetDto.meta && presetDto.meta.visibility,
          enabled: presetDto && presetDto.meta && presetDto.meta.enabled,
        }
  );

  return Object.assign({}, base, {
    kind: 'user_design',
    readOnly: false,
    source: 'customised_preset',
    sourcePresetId: base.sourceId,
    sourcePresetSlug: base.slug,
    status: 'draft',
    owner: owner || null,
    name: base.name ? base.name + ' (custom)' : 'Custom design',
  });
}

module.exports = {
  positioningLayoutToPresetBlueprint,
  customisePresetBlueprint,
};
