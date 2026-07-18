'use strict';

/**
 * Deterministic pre-application validation for Website Studio Phase 5.
 */

const { runQualityGate } = require('../website-composer/quality-gate');
const { isAppSupported, getCatalogueApp } = require('../website-composer/marketplace/catalogue');
const { hasAdapter } = require('../website-composer/adapters/registry');
const { detectIndustryLeakage } = require('../theme-studio/leakage');
const { renderDraftPreviewHtml } = require('../theme-studio/render-preview');
const { MODES } = require('./permissions');

const TEMP_URL_RE = /images\.pexels\.com|placeholder|via\.placeholder|tmp\/|blob:/i;

/**
 * @param {object} input
 */
function validateForApplication(input) {
  const {
    actor,
    draft,
    version,
    mode,
    contactConfirmation,
    acknowledgeWarnings,
    overrideReason,
    targetSite,
    imagePolicy
  } = input;

  /** @type {Array<{ severity: 'critical'|'warning', code: string, message: string, path?: string }>} */
  const issues = [];

  if (!actor || !actor.userId) {
    issues.push({ severity: 'critical', code: 'unauthenticated', message: 'User must be authenticated' });
  }
  if (!draft) {
    issues.push({ severity: 'critical', code: 'draft_missing', message: 'Source draft missing' });
  }
  if (!version) {
    issues.push({ severity: 'critical', code: 'version_missing', message: 'Source version missing' });
  }

  const concept = (version && version.concept_json) || {};
  const draftConfig = (version && version.draft_config_json) || {};
  const meta = (draft && draft.meta) || {};
  const approvalState =
    meta.approvalState ||
    concept.approvalState ||
    (draftConfig.__websiteComposer && draftConfig.__websiteComposer.approvalState);

  if (approvalState !== 'approved-for-application') {
    issues.push({
      severity: 'critical',
      code: 'not_approved',
      message: 'Concept must be approved-for-application before application',
      path: 'approvalState'
    });
  }

  if (meta.approvedVersionId && version && meta.approvedVersionId !== version.id) {
    issues.push({
      severity: 'warning',
      code: 'version_not_approved_snapshot',
      message: 'Selected version differs from the recorded approvedVersionId — re-check before apply'
    });
  }

  const gate = runQualityGate(concept, draftConfig);
  if (gate.status === 'blocked') {
    for (const issue of gate.issues.filter((i) => i.severity === 'critical')) {
      issues.push({
        severity: 'critical',
        code: 'quality_' + issue.code,
        message: issue.message,
        path: issue.path
      });
    }
  } else if (gate.status === 'needs-attention') {
    for (const issue of gate.issues.filter((i) => i.severity === 'warning').slice(0, 12)) {
      issues.push({
        severity: 'warning',
        code: 'quality_' + issue.code,
        message: issue.message,
        path: issue.path
      });
    }
  }

  // Marketplace apps
  const order = draftConfig.sectionOrder || concept.sectionOrder || [];
  const sections = draftConfig.sections || {};
  for (const key of order) {
    if (key === 'footer') continue;
    const cat = getCatalogueApp(key);
    if (!isAppSupported(key) && (!cat || cat.websiteStudioSupport !== 'supported')) {
      if (cat && cat.websiteStudioSupport === 'supported-with-limitations') {
        issues.push({
          severity: 'warning',
          code: 'app_limited',
          message: 'Limited app included: ' + key + ' — ' + (cat.finalDecisionReason || 'constraints apply'),
          path: 'sections.' + key
        });
      } else {
        issues.push({
          severity: 'critical',
          code: 'app_unsupported',
          message: 'Active app is not supported: ' + key,
          path: 'sections.' + key
        });
      }
    }
    if (!hasAdapter(key) && key !== 'footer') {
      issues.push({
        severity: 'critical',
        code: 'adapter_missing',
        message: 'No adapter for app: ' + key,
        path: 'sections.' + key
      });
    }
    const sec = sections[key];
    if (sec && sec.on !== false) {
      const blob = JSON.stringify(sec);
      if (/TODO|TBD|\[\[|lorem ipsum|placeholder text/i.test(blob)) {
        issues.push({
          severity: 'critical',
          code: 'placeholder_content',
          message: 'Unresolved placeholder in section ' + key,
          path: 'sections.' + key
        });
      }
    }
  }

  // Leakage
  const leak = detectIndustryLeakage(draftConfig, {
    industry: (concept.businessProfile && concept.businessProfile.industry) || ''
  });
  if (leak && !leak.ok) {
    for (const err of (leak.errors || []).slice(0, 8)) {
      issues.push({
        severity: 'critical',
        code: err.code || 'industry_leakage',
        message: err.message || 'Cross-industry leakage detected',
        path: err.path
      });
    }
  }

  // Contact / forms confirmation
  const contact = contactConfirmation || {};
  if (mode === MODES.CREATE_SITE || mode === MODES.REPLACEMENT_DRAFT) {
    if (!contact.leadRecipientEmail || !String(contact.leadRecipientEmail).includes('@')) {
      issues.push({
        severity: 'critical',
        code: 'lead_recipient_required',
        message: 'Confirm lead recipient email before application',
        path: 'contact.leadRecipientEmail'
      });
    }
    if (!contact.businessEmail || !String(contact.businessEmail).includes('@')) {
      issues.push({
        severity: 'critical',
        code: 'business_email_required',
        message: 'Confirm business email before application',
        path: 'contact.businessEmail'
      });
    }
    if (contact.confirmed !== true) {
      issues.push({
        severity: 'critical',
        code: 'contact_not_confirmed',
        message: 'Contact and form details must be explicitly confirmed',
        path: 'contact.confirmed'
      });
    }
    // Partner must not silently become recipient
    if (
      actor &&
      actor.isPartner &&
      contact.leadRecipientEmail &&
      contact.partnerEmail &&
      String(contact.leadRecipientEmail).toLowerCase() === String(contact.partnerEmail).toLowerCase() &&
      contact.allowPartnerAsRecipient !== true
    ) {
      issues.push({
        severity: 'critical',
        code: 'partner_recipient_not_explicit',
        message: 'Partner email as lead recipient requires allowPartnerAsRecipient:true'
      });
    }
  }

  // Images
  const selections =
    (draftConfig.__websiteComposer && draftConfig.__websiteComposer.imageSelections) ||
    concept.imageSelections ||
    [];
  const requireApproved = !(imagePolicy && imagePolicy.allowUnapproved === true);
  for (const sel of selections) {
    if (!sel || sel.optional) continue;
    const status = sel.approvalStatus || sel.status;
    if (requireApproved && status !== 'approved' && status !== 'imported') {
      issues.push({
        severity: 'critical',
        code: 'image_not_approved',
        message: 'Required image not approved: ' + (sel.briefId || sel.id || 'unknown'),
        path: 'images'
      });
    }
    const url = sel.url || (sel.selectedAsset && sel.selectedAsset.url) || '';
    if (url && TEMP_URL_RE.test(url) && status !== 'imported' && mode !== MODES.PRIVATE_TEMPLATE) {
      const severity = imagePolicy && imagePolicy.allowTempUrls === true ? 'warning' : 'critical';
      issues.push({
        severity,
        code: 'temp_image_url',
        message: 'Temporary provider URL must be imported to Cloudinary before application: ' + (sel.briefId || ''),
        path: 'images'
      });
    }
  }

  // SEO
  const seo = draftConfig.seo || {};
  if (!seo.title && !(concept.businessProfile && concept.businessProfile.businessName)) {
    issues.push({
      severity: 'warning',
      code: 'seo_title_missing',
      message: 'SEO title missing'
    });
  }

  // Renderer smoke (desktop + mobile)
  try {
    const desktop = renderDraftPreviewHtml(draftConfig, { mode: 'desktop' });
    const mobile = renderDraftPreviewHtml(draftConfig, { mode: 'mobile' });
    if (!desktop || desktop.length < 200) {
      issues.push({ severity: 'critical', code: 'render_desktop_failed', message: 'Desktop render incomplete' });
    }
    if (!mobile || mobile.length < 200) {
      issues.push({ severity: 'critical', code: 'render_mobile_failed', message: 'Mobile render incomplete' });
    }
    if (/plumber|emergency\s+call\s+out/i.test(desktop) && !/electrical|trade|plumb/i.test(String((concept.businessProfile || {}).industry || ''))) {
      // soft check — quality gate usually catches; keep warning
      issues.push({
        severity: 'warning',
        code: 'render_trade_copy_suspected',
        message: 'Rendered HTML may contain trade fallback copy'
      });
    }
  } catch (err) {
    issues.push({
      severity: 'critical',
      code: 'render_error',
      message: 'Renderer failed: ' + (err && err.message ? err.message : String(err))
    });
  }

  if (mode === MODES.REPLACEMENT_DRAFT && !targetSite) {
    issues.push({
      severity: 'critical',
      code: 'replacement_target_missing',
      message: 'Replacement draft requires a target site'
    });
  }

  const critical = issues.filter((i) => i.severity === 'critical');
  const warnings = issues.filter((i) => i.severity === 'warning');

  let overrideAccepted = false;
  if (critical.length === 0 && warnings.length && !acknowledgeWarnings) {
    // warnings require acknowledgement
  }
  if (critical.length && actor && actor.isSuperuser && overrideReason) {
    // Superusers still cannot bypass critical failures
    issues.push({
      severity: 'critical',
      code: 'override_rejected',
      message: 'Critical validation failures cannot be overridden'
    });
  }
  if (!critical.length && warnings.length && actor && actor.isSuperuser && overrideReason) {
    overrideAccepted = true;
  }

  const warningsBlock = warnings.length > 0 && !acknowledgeWarnings && !overrideAccepted;
  const ok = critical.length === 0 && !warningsBlock;

  return {
    ok,
    issues,
    critical,
    warnings,
    qualityGate: gate,
    approvalState,
    warningsRequireAck: warnings.length > 0,
    overrideAccepted,
    blocked: !ok
  };
}

module.exports = {
  validateForApplication,
  TEMP_URL_RE
};
