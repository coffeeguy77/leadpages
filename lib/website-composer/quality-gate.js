'use strict';

/**
 * Deterministic Website Studio quality gate (Phase 4).
 * Statuses: blocked | needs-attention | ready-for-review
 */

const { isAppSupported, getCatalogueApp } = require('./marketplace/catalogue');
const { hasAdapter } = require('./adapters/registry');
const { detectIndustryLeakage } = require('../theme-studio/leakage');
const { HERO_APPS } = require('./install-apps');
const { RENDERER_SHELL_NEUTRAL_V1 } = require('./constants');

/**
 * @param {object} concept
 * @param {object} draftConfig
 * @param {{ renderedHtml?: string }} [opts]
 */
function runQualityGate(concept, draftConfig, opts) {
  const options = opts || {};
  /** @type {Array<{ severity: 'critical'|'warning'|'info', code: string, message: string, path?: string }>} */
  const issues = [];

  const draft = draftConfig || {};
  const order = (draft.sectionOrder || (concept && concept.sectionOrder) || []).slice();
  const sections = draft.sections || (concept && concept.sections) || {};
  const industry =
    (concept && concept.businessProfile && concept.businessProfile.industry) ||
    (draft.__websiteComposer && draft.__websiteComposer.industry) ||
    '';

  // Composition
  if (!order.length) {
    issues.push({ severity: 'critical', code: 'order_empty', message: 'sectionOrder is empty', path: 'sectionOrder' });
  }
  const heroes = order.filter((k) => HERO_APPS.has(k));
  if (heroes.length === 0) {
    issues.push({ severity: 'critical', code: 'hero_missing', message: 'No hero app installed', path: 'sectionOrder' });
  }
  if (heroes.length > 1) {
    issues.push({ severity: 'warning', code: 'hero_duplicate', message: 'Multiple hero apps in order', path: 'sectionOrder' });
  }
  if (!order.includes('footer')) {
    issues.push({ severity: 'critical', code: 'footer_missing', message: 'Footer required', path: 'sectionOrder' });
  }

  for (const key of order) {
    if (key === 'footer') continue;
    if (!isAppSupported(key) && key !== 'footer') {
      const cat = getCatalogueApp(key);
      if (!cat || cat.websiteStudioSupport !== 'supported') {
        issues.push({
          severity: 'critical',
          code: 'app_unsupported',
          message: 'Unsupported app in composition: ' + key,
          path: 'sections.' + key
        });
      }
    }
    if (!hasAdapter(key) && key !== 'footer') {
      issues.push({
        severity: 'critical',
        code: 'adapter_missing',
        message: 'No adapter for installed app: ' + key,
        path: 'sections.' + key
      });
    }
    const sec = sections[key];
    if (!sec || sec.on === false) {
      issues.push({
        severity: 'critical',
        code: 'section_inactive',
        message: 'Ordered section is not active: ' + key,
        path: 'sections.' + key
      });
      continue;
    }
    const hasContent =
      sec.title ||
      sec.heading ||
      sec.sub ||
      sec.subheading ||
      sec.text ||
      sec.body ||
      sec.intro ||
      sec.cta ||
      (Array.isArray(sec.items) && sec.items.length) ||
      (Array.isArray(sec.packages) && sec.packages.length) ||
      (Array.isArray(sec.projects) && sec.projects.length) ||
      (Array.isArray(sec.steps) && sec.steps.length) ||
      (Array.isArray(sec.slides) && sec.slides.length) ||
      (Array.isArray(sec.logos) && sec.logos.length) ||
      (Array.isArray(sec.areas) && sec.areas.length);
    if (!hasContent) {
      issues.push({
        severity: 'critical',
        code: 'content_empty',
        message: 'Required content missing for ' + key,
        path: 'sections.' + key
      });
    }
    // Placeholder tokens
    const blob = JSON.stringify(sec);
    if (/\{\{|\}\}|TODO_REPLACE|lorem ipsum|\[\[/i.test(blob)) {
      issues.push({
        severity: 'critical',
        code: 'placeholder_token',
        message: 'Unresolved placeholder in ' + key,
        path: 'sections.' + key
      });
    }
  }

  // Shell
  const shellId = draft.__websiteComposer && draft.__websiteComposer.rendererShellId;
  if (draft.__websiteComposer && draft.__websiteComposer.contentInheritance !== 'none') {
    issues.push({
      severity: 'critical',
      code: 'inheritance_not_none',
      message: 'Website Studio drafts must set contentInheritance none'
    });
  }
  if (shellId && shellId !== RENDERER_SHELL_NEUTRAL_V1) {
    issues.push({
      severity: 'warning',
      code: 'shell_not_neutral',
      message: 'Draft is not using landing-shell-neutral-v1',
      path: '__websiteComposer.rendererShellId'
    });
  }

  // Leakage (config)
  const leak = detectIndustryLeakage(
    {
      sections,
      services: draft.services,
      businessProfile: concept && concept.businessProfile,
      seoTitle: draft.seoTitle,
      seoDescription: draft.seoDescription
    },
    { industry }
  );
  for (const e of leak.errors || []) {
    issues.push({
      severity: 'critical',
      code: e.code,
      message: e.message,
      path: e.path || 'content'
    });
  }

  // Rendered HTML leakage (when provided)
  if (options.renderedHtml) {
    const html = String(options.renderedHtml);
    if (/plumber|blocked\s*drain|Gungahlin|master\s+plumber/i.test(html) && !/electrical|trade|plumb/i.test(industry)) {
      issues.push({
        severity: 'critical',
        code: 'render_trade_leakage',
        message: 'Rendered HTML contains trade fallback leakage'
      });
    }
    if (!/noindex/i.test(html)) {
      issues.push({
        severity: 'warning',
        code: 'preview_indexable',
        message: 'Preview HTML missing noindex'
      });
    }
  }

  // Images
  const selections =
    (draft.__websiteComposer && draft.__websiteComposer.imageSelections) ||
    (concept && concept.imagery) ||
    [];
  const needsHeroImage = heroes.length > 0;
  if (needsHeroImage && !selections.length) {
    issues.push({
      severity: 'warning',
      code: 'images_missing',
      message: 'No image selections stored on draft'
    });
  }
  for (const sel of selections) {
    if (!sel.altText) {
      issues.push({
        severity: 'warning',
        code: 'alt_missing',
        message: 'Image missing alt text',
        path: 'imageSelections.' + (sel.sectionId || sel.providerAssetId)
      });
    }
    if (sel.placeholder) {
      issues.push({
        severity: 'warning',
        code: 'image_placeholder',
        message: 'Placeholder image still in use for ' + (sel.sectionId || 'slot')
      });
    }
  }

  // SEO
  if (!String(draft.seoTitle || (concept && concept.businessProfile && concept.businessProfile.businessName) || '').trim()) {
    issues.push({ severity: 'warning', code: 'seo_title_missing', message: 'SEO title missing', path: 'seoTitle' });
  }

  // Business name consistency
  const name = concept && concept.businessProfile && concept.businessProfile.businessName;
  if (name && draft.name && draft.name !== name) {
    issues.push({
      severity: 'warning',
      code: 'name_mismatch',
      message: 'Draft name does not match businessProfile.businessName'
    });
  }

  // Page length
  if (order.length > 16) {
    issues.push({
      severity: 'warning',
      code: 'page_too_long',
      message: 'Section count is high (' + order.length + ') — consider shortening'
    });
  }
  if (order.length < 4) {
    issues.push({
      severity: 'critical',
      code: 'page_too_short',
      message: 'Too few sections for a credible website'
    });
  }

  const critical = issues.filter((i) => i.severity === 'critical');
  const warnings = issues.filter((i) => i.severity === 'warning');
  let status = 'ready-for-review';
  if (critical.length) status = 'blocked';
  else if (warnings.length) status = 'needs-attention';

  return {
    ok: status !== 'blocked',
    status,
    issues,
    criticalCount: critical.length,
    warningCount: warnings.length,
    summary:
      status === 'ready-for-review'
        ? 'Concept passes deterministic quality gate'
        : status === 'needs-attention'
          ? 'Concept has warnings to review'
          : 'Concept is blocked by critical issues'
  };
}

module.exports = { runQualityGate };
