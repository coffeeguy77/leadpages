'use strict';

/**
 * Website Composer constants.
 * Reuses verified section/layout IDs from theme-studio constants — never invent IDs.
 */

const ts = require('../theme-studio/constants');

/** Content provenance values (diagnostics + section ownership). */
const PROVENANCE = Object.freeze({
  FOUNDATION: 'Foundation',
  RECIPE: 'Marketplace Recipe',
  AI_GENERATED: 'AI Generated',
  BUSINESS_PROFILE: 'Business Profile',
  MANUAL_EDIT: 'Manual Edit',
  IMPORTED: 'Imported',
  LEGACY: 'Legacy'
});

/**
 * Legacy technical landing HTML shell (trade.template.json).
 * Kept for live trade sites — NOT used for Website Studio Composer drafts.
 */
const RENDERER_SHELL_LANDING_V1 = 'landing-shell-v1';

/** Content-neutral Website Studio preview / draft shell. */
const RENDERER_SHELL_NEUTRAL_V1 = 'landing-shell-neutral-v1';

/** Map shell → HTML asset (legacy technical identifiers preserved). */
const RENDERER_SHELL_ASSETS = Object.freeze({
  [RENDERER_SHELL_LANDING_V1]: 'trade.template.json',
  [RENDERER_SHELL_NEUTRAL_V1]: 'landing-shell-neutral-v1.template.json'
});

/** Phase 4 Marketplace apps added for multi-industry composition. */
const PHASE4_SECTION_KEYS = Object.freeze([
  'productCollection',
  'clientLogos',
  'bookingCta',
  'brandStory',
  'packageCompare'
]);

const KNOWN_SECTION_KEYS = Object.freeze([
  ...ts.KNOWN_SECTION_KEYS,
  ...PHASE4_SECTION_KEYS.filter((k) => !ts.KNOWN_SECTION_KEYS.includes(k))
]);

module.exports = {
  LAYOUT_IDS: ts.LAYOUT_IDS,
  HERO_VARIANTS: ts.HERO_VARIANTS,
  HEADER_VARIANTS: ts.HEADER_VARIANTS,
  FONT_NAMES: ts.FONT_NAMES,
  KNOWN_SECTION_KEYS,
  MARKETPLACE_SECTION_KEYS: Object.freeze({
    ...ts.MARKETPLACE_SECTION_KEYS,
    PRODUCT_COLLECTION: 'productCollection',
    CLIENT_LOGOS: 'clientLogos',
    BOOKING_CTA: 'bookingCta',
    BRAND_STORY: 'brandStory',
    PACKAGE_COMPARE: 'packageCompare'
  }),
  TRADE_ONLY_SECTION_KEYS: ts.TRADE_ONLY_SECTION_KEYS,
  WRITABLE_CONFIG_PATHS: ts.WRITABLE_CONFIG_PATHS,
  PROTECTED_FIELDS: ts.PROTECTED_FIELDS,
  CONCEPT_SCHEMA_VERSION: ts.CONCEPT_SCHEMA_VERSION,
  CONCEPT_SCHEMA_ID: ts.CONCEPT_SCHEMA_ID,
  PROVENANCE,
  RENDERER_SHELL_LANDING_V1,
  RENDERER_SHELL_NEUTRAL_V1,
  RENDERER_SHELL_ASSETS,
  PHASE4_SECTION_KEYS
};
