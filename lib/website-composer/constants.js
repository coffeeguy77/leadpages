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
 * Technical landing HTML shell used by draft preview / apply demo inserts.
 * This is NOT a content template and must never imply trade copy inheritance.
 */
const RENDERER_SHELL_LANDING_V1 = 'landing-shell-v1';

/** Map shell → current HTML asset (legacy technical identifier). */
const RENDERER_SHELL_ASSETS = Object.freeze({
  [RENDERER_SHELL_LANDING_V1]: 'trade.template.json'
});

module.exports = {
  LAYOUT_IDS: ts.LAYOUT_IDS,
  HERO_VARIANTS: ts.HERO_VARIANTS,
  HEADER_VARIANTS: ts.HEADER_VARIANTS,
  FONT_NAMES: ts.FONT_NAMES,
  KNOWN_SECTION_KEYS: ts.KNOWN_SECTION_KEYS,
  MARKETPLACE_SECTION_KEYS: ts.MARKETPLACE_SECTION_KEYS,
  TRADE_ONLY_SECTION_KEYS: ts.TRADE_ONLY_SECTION_KEYS,
  WRITABLE_CONFIG_PATHS: ts.WRITABLE_CONFIG_PATHS,
  PROTECTED_FIELDS: ts.PROTECTED_FIELDS,
  CONCEPT_SCHEMA_VERSION: ts.CONCEPT_SCHEMA_VERSION,
  CONCEPT_SCHEMA_ID: ts.CONCEPT_SCHEMA_ID,
  PROVENANCE,
  RENDERER_SHELL_LANDING_V1,
  RENDERER_SHELL_ASSETS
};
