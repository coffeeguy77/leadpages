'use strict';

/**
 * Platform Capability Registry — real Marketplace / editor / renderer only.
 *
 * Authority: production App Marketplace + manage.html editor + production shell.
 * Website Composer catalogue/app-metadata are SECONDARY comparison only.
 *
 * An app is allowlisted for future Forge execution only when evidence paths
 * confirm marketplace + install + editor + renderer + save/reload.
 */

/**
 * Curated Phase 1 allowlist — each entry records evidence paths.
 * Authority (primary):
 * - app_registry via api/api-apps.js + lib/marketplace-catalog-seed.js
 * - install: api/api-site-apps.js + manage.html renderAppsMarketplace
 * - editor: manage.html TRADE_SUBTABS / section field editors
 * - renderer: trade.template.json + landing-shell-neutral-v1 applyCfg
 * - persist: sites.config.sections* save/reload in manage.html
 * Secondary comparison only: lib/website-composer/marketplace/*
 */
const CAPABILITIES = Object.freeze([
  {
    id: 'hero',
    sectionKey: 'hero',
    name: 'Hero',
    marketplace: true,
    editor: true,
    renderer: true,
    installable: true,
    studioOnly: false,
    evidence: {
      marketplace: 'lib/marketplace-catalog-seed.js DEFAULT_POSITION.hero → upsertAppRegistry(section_key=hero)',
      install: 'api/api-site-apps.js + manage.html App Marketplace toggle (site_apps)',
      editor: 'manage.html TRADE_SUBTABS hero + landingSub section editors',
      renderer: 'trade.template.json / landing-shell-neutral-v1.template.json applyCfg hero',
      config: 'sites.config.sections.hero',
      saveReload: 'manage.html persist sites.config; preview reload reads sections.hero'
    },
    fields: ['title', 'sub', 'eyebrow', 'cta', 'image', 'imageUrl', 'callText'],
    executableActions: [] // Phase 1 advisory only
  },
  {
    id: 'services',
    sectionKey: 'services',
    name: 'Services',
    marketplace: true,
    editor: true,
    renderer: true,
    installable: true,
    studioOnly: false,
    evidence: {
      marketplace: 'lib/marketplace-catalog-seed.js / marketplace app-content services',
      install: 'api/api-site-apps.js site_apps + manage.html apps panel',
      editor: 'manage.html TRADE_SUBTABS services',
      renderer: 'trade.template.json applyCfg C.services → .svcs',
      config: 'sites.config.services + sections.services',
      saveReload: 'manage.html config merge for services items + sections.services'
    },
    fields: ['eyebrow', 'heading', 'intro', 'items', 'title', 'body', 'image'],
    executableActions: []
  },
  {
    id: 'faq',
    sectionKey: 'faq',
    name: 'FAQ',
    marketplace: true,
    editor: true,
    renderer: true,
    installable: true,
    studioOnly: false,
    evidence: {
      marketplace: 'lib/marketplace-catalog-seed.js upsertAppRegistry(section_key=faq)',
      install: 'api/api-site-apps.js + landing pageApps attach',
      editor: 'manage.html TRADE_SUBTABS faq + Unique FAQ on landing pages',
      renderer: 'trade.template.json applyCfg sections.faq',
      config: 'sites.config.sections.faq',
      saveReload: 'manage.html sections.faq persist; pageApps unique mode merge'
    },
    fields: ['eyebrow', 'heading', 'items'],
    executableActions: []
  },
  {
    id: 'quote',
    sectionKey: 'quote',
    name: 'Contact / Quote form',
    marketplace: true,
    editor: true,
    renderer: true,
    installable: true,
    studioOnly: false,
    evidence: {
      marketplace: 'lib/marketplace-catalog-seed.js DEFAULT_POSITION.quote',
      install: 'api/api-site-apps.js site_apps',
      editor: 'manage.html TRADE_SUBTABS quote / contact form fields',
      renderer: 'trade.template.json applyCfg sections.quote',
      config: 'sites.config.sections.quote',
      saveReload: 'manage.html quote section persist',
      note: 'Form recipients are protected — AI Team must not change them in Phase 1'
    },
    fields: ['heading', 'intro', 'eyebrow'],
    protectedFields: ['recipients', 'webhook', 'crm'],
    executableActions: []
  },
  {
    id: 'reviews',
    sectionKey: 'reviews',
    name: 'Reviews',
    marketplace: true,
    editor: true,
    renderer: true,
    installable: true,
    studioOnly: false,
    evidence: {
      marketplace: 'lib/marketplace-catalog-seed.js / catalog_features section_key=reviews',
      install: 'api/api-site-apps.js site_apps',
      editor: 'manage.html TRADE_SUBTABS reviews',
      renderer: 'trade.template.json applyCfg sections.reviews',
      config: 'sites.config.sections.reviews',
      saveReload: 'manage.html reviews items persist'
    },
    fields: ['heading', 'items'],
    executableActions: []
  },
  {
    id: 'featuredProjects',
    sectionKey: 'featuredProjects',
    name: 'Project Portfolio',
    marketplace: true,
    editor: true,
    renderer: true,
    installable: true,
    studioOnly: false,
    evidence: {
      marketplace: 'lib/marketplace-catalog-seed.js DEFAULT_POSITION.featuredProjects + presets',
      install: 'api/api-site-apps.js site_apps',
      editor: 'manage.html TRADE_SUBTABS featuredProjects',
      renderer: 'trade.template.json applyCfg sections.featuredProjects',
      config: 'sites.config.sections.featuredProjects',
      saveReload: 'manage.html featuredProjects persist'
    },
    fields: ['heading', 'eyebrow', 'intro', 'projects'],
    executableActions: []
  },
  {
    id: 'trustBar',
    sectionKey: 'trustBar',
    name: 'Trust Bar',
    marketplace: true,
    editor: true,
    renderer: true,
    installable: true,
    studioOnly: false,
    evidence: {
      marketplace: 'lib/marketplace-catalog-seed.js DEFAULT_POSITION.trustBar',
      install: 'api/api-site-apps.js site_apps',
      editor: 'manage.html TRADE_SUBTABS trustBar',
      renderer: 'trade.template.json applyCfg sections.trustBar',
      config: 'sites.config.sections.trustBar',
      saveReload: 'manage.html trustBar persist'
    },
    fields: ['badges', 'mode', 'heading'],
    executableActions: []
  },
  {
    id: 'why',
    sectionKey: 'why',
    name: 'Why us',
    marketplace: true,
    editor: true,
    renderer: true,
    installable: true,
    studioOnly: false,
    evidence: {
      marketplace: 'lib/marketplace-catalog-seed.js / marketplace app-content why',
      install: 'api/api-site-apps.js site_apps',
      editor: 'manage.html TRADE_SUBTABS why',
      renderer: 'trade.template.json applyCfg sections.why',
      config: 'sites.config.sections.why',
      saveReload: 'manage.html why items persist'
    },
    fields: ['heading', 'items'],
    executableActions: []
  },
  {
    id: 'seoLandingPage',
    sectionKey: null,
    name: 'SEO landing page (existing generator)',
    marketplace: false,
    editor: true,
    renderer: true,
    installable: false,
    studioOnly: false,
    evidence: {
      editor: 'manage.html #av-landing + aiGenerate',
      api: 'api/brain/landing-draft.js',
      config: 'sites.config.pages[]',
      note: 'Not a Marketplace app install — existing SEO page tool. Phase 2 Scout execution; Phase 1 advisory only'
    },
    fields: ['slug', 'title', 'h1', 'metaDescription', 'body', 'faq'],
    executableActions: ['create_landing_page']
  },
  {
    id: 'pageMetadata',
    sectionKey: null,
    name: 'Page title & meta description',
    marketplace: false,
    editor: true,
    renderer: true,
    installable: false,
    studioOnly: false,
    evidence: {
      editor: 'manage.html landing page SEO fields',
      config: 'sites.config.pages[].seoTitle / metaDescription',
      note: 'Editor-native fields; not a Marketplace app'
    },
    fields: ['seoTitle', 'metaDescription'],
    executableActions: []
  },
  {
    id: 'lpAccessibility',
    sectionKey: 'lpAccessibility',
    name: 'Appearance & Accessibility',
    marketplace: true,
    editor: true,
    renderer: true,
    installable: true,
    studioOnly: false,
    evidence: {
      marketplace: 'api/api-apps.js LP_ACCESSIBILITY_APP upsert into app_registry',
      install: 'api/api-site-apps.js + manage.html Appearance & Accessibility',
      editor: 'manage.html Appearance & Accessibility overlay',
      config: 'sites.config visitor appearance keys',
      saveReload: 'manage.html appearance persist'
    },
    fields: [],
    executableActions: []
  }
]);

/**
 * Known virtual / Composer-oriented apps that must NOT be execution-allowlisted
 * unless they also exist as real Marketplace + editor apps (secondary audit).
 */
const VIRTUAL_OR_COMPOSER_EXCLUSIONS = Object.freeze([
  {
    id: 'composer-virtual-generic',
    reason: 'Website Composer adapters may invent section payloads for Studio drafts that are not installable as Marketplace apps',
    comparisonSource: 'lib/website-composer/adapters/registry.js',
    excluded: true
  },
  {
    id: 'websiteStudioSupport-only',
    reason: 'catalogue-data.json websiteStudioSupport flags are not proof of editor installability',
    comparisonSource: 'lib/website-composer/marketplace/catalogue-data.json',
    excluded: true
  },
  {
    id: 'composer-app-metadata',
    reason: 'app-metadata.js is a Studio/Composer secondary index, not the App Marketplace registry',
    comparisonSource: 'lib/website-composer/marketplace/app-metadata.js',
    excluded: true
  },
  {
    id: 'studio-preview-only-shells',
    reason: 'Theme Studio preview shells and mock providers are not production Marketplace installs',
    comparisonSource: 'lib/theme-studio/ + api/theme-studio/*',
    excluded: true
  }
]);

function listCapabilities() {
  return CAPABILITIES.slice();
}

function getCapability(idOrSection) {
  const key = String(idOrSection || '');
  return (
    CAPABILITIES.find((c) => c.id === key || c.sectionKey === key) || null
  );
}

function isExecutableCapability(idOrSection) {
  const key = String(idOrSection || '');
  return key === 'hero' || key === 'faq';
}

function isSupportedForRecommendation(idOrSection) {
  return !!getCapability(idOrSection);
}

function listExclusions() {
  return VIRTUAL_OR_COMPOSER_EXCLUSIONS.slice();
}

/**
 * Compare a Composer metadata id against the real allowlist (secondary audit).
 */
function classifyComposerCandidate(sectionKey) {
  const real = getCapability(sectionKey);
  if (real && !real.studioOnly) {
    return { status: 'real', capability: real };
  }
  return {
    status: 'excluded_or_unknown',
    capability: null,
    reason:
      'Not on the real Marketplace/editor/renderer allowlist — treat as capability gap if recommended'
  };
}

module.exports = {
  CAPABILITIES,
  VIRTUAL_OR_COMPOSER_EXCLUSIONS,
  listCapabilities,
  getCapability,
  isExecutableCapability,
  isSupportedForRecommendation,
  listExclusions,
  classifyComposerCandidate
};
