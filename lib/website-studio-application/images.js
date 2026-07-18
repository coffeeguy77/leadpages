'use strict';

/**
 * Image finalisation for application — Cloudinary import + replace temp URLs.
 * Pilot (Phase 6): executeImport performs server-side upload (no browser secrets).
 */

const { TEMP_URL_RE } = require('./validate');
const { buildCloudinaryImportPlan, importRemoteAssetToCloudinary } = require('../image-service');

/**
 * @param {object} draftConfig
 * @param {{
 *   siteId?: string,
 *   draftId?: string,
 *   mockImport?: boolean,
 *   importedMap?: Record<string, string>,
 *   executeImport?: boolean,
 *   acceptImportPlanAsFinal?: boolean,
 *   fetchImpl?: Function
 * }} opts
 */
async function finaliseImagesForApplication(draftConfig, opts) {
  const options = opts || {};
  const selections =
    (draftConfig &&
      draftConfig.__websiteComposer &&
      draftConfig.__websiteComposer.imageSelections) ||
    [];

  const imports = [];
  const replacements = [];
  const failures = [];
  const warnings = [];

  for (const sel of selections) {
    if (!sel) continue;
    const status = sel.approvalStatus || sel.status;
    const url = sel.url || (sel.selectedAsset && sel.selectedAsset.url) || '';
    const briefId = sel.briefId || sel.id || 'image';
    const required = sel.optional !== true;

    if (status === 'imported' && url && !TEMP_URL_RE.test(url) && /res\.cloudinary\.com/i.test(url)) {
      continue;
    }

    if (!url) {
      if (required) failures.push({ briefId, error: 'missing_url' });
      continue;
    }

    if (status !== 'approved' && status !== 'imported' && status !== 'import-planned') {
      if (required) {
        failures.push({ briefId, error: 'not_approved' });
      }
      continue;
    }

    if (TEMP_URL_RE.test(url) || status === 'approved' || status === 'import-planned') {
      let finalUrl = url;
      let attribution = sel.attribution || (sel.selectedAsset && sel.selectedAsset.attribution) || null;
      let transformations = null;

      if (options.importedMap && options.importedMap[briefId]) {
        finalUrl = options.importedMap[briefId];
      } else if (options.mockImport) {
        finalUrl =
          'https://res.cloudinary.com/leadpages/image/upload/q_auto,f_auto/leadpages/' +
          (options.siteId || 'pending') +
          '/website-studio/' +
          briefId +
          '.jpg';
      } else if (options.executeImport) {
        const selection = Object.assign({}, sel.selectedAsset || {}, {
          imageBriefId: briefId,
          provider: sel.source || sel.provider || (sel.selectedAsset && sel.selectedAsset.provider) || 'pexels',
          sourceImageUrl: url,
          providerAssetId: sel.providerAssetId || (sel.selectedAsset && sel.selectedAsset.providerAssetId),
          photographerName:
            sel.photographerName || (sel.selectedAsset && sel.selectedAsset.photographerName) || '',
          sourcePageUrl: sel.sourcePageUrl || (sel.selectedAsset && sel.selectedAsset.sourcePageUrl) || ''
        });
        const imported = await importRemoteAssetToCloudinary(selection, {
          siteId: options.siteId || 'pending',
          draftId: options.draftId || 'draft',
          fetchImpl: options.fetchImpl,
          dryRun: options.dryRun === true
        });
        if (!imported.ok) {
          if (required) {
            failures.push({
              briefId,
              error: imported.error || 'import_failed',
              message: imported.message,
              recovery: 'Replace the image or retry Cloudinary import'
            });
            continue;
          }
          warnings.push({ briefId, error: imported.error || 'import_failed_optional' });
          continue;
        }
        finalUrl = imported.secureUrl || imported.url;
        attribution = imported.attribution || attribution;
        transformations = imported.transformations || null;
        imports.push({
          briefId,
          plan: imported.plan,
          from: url,
          to: finalUrl,
          attribution,
          deduped: !!imported.deduped,
          transformations
        });
      } else {
        try {
          const selection = Object.assign({}, sel.selectedAsset || {}, {
            imageBriefId: briefId,
            provider: sel.source || sel.provider || (sel.selectedAsset && sel.selectedAsset.provider),
            sourceImageUrl: url,
            providerAssetId: sel.providerAssetId || (sel.selectedAsset && sel.selectedAsset.providerAssetId)
          });
          const plan = buildCloudinaryImportPlan(selection, {
            siteId: options.siteId || 'pending',
            draftId: options.draftId || 'draft'
          });
          imports.push({ briefId, plan, sourceUrl: url });
          if (plan && plan.publicId && options.acceptImportPlanAsFinal) {
            finalUrl = 'https://res.cloudinary.com/leadpages/image/upload/q_auto,f_auto/' + plan.publicId;
          }
        } catch (err) {
          if (required) {
            failures.push({
              briefId,
              error: 'import_plan_failed',
              message: err && err.message ? err.message : String(err)
            });
            continue;
          }
          warnings.push({ briefId, error: 'import_plan_failed_optional' });
          continue;
        }
      }

      if (
        TEMP_URL_RE.test(finalUrl) &&
        !options.mockImport &&
        !(options.importedMap && options.importedMap[briefId])
      ) {
        if (required) {
          failures.push({
            briefId,
            error: 'temp_url_unresolved',
            message: 'Import required before application',
            recovery: 'Approve image and run Cloudinary import (execute:true)'
          });
          continue;
        }
      }

      const path = sel.configPath || sel.path || guessImagePath(sel);
      if (path) {
        replacements.push({
          path,
          url: finalUrl,
          attributionPath: sel.attributionPath || null,
          attribution,
          briefId,
          transformations
        });
      }
      if (!imports.some((i) => i.briefId === briefId && i.to === finalUrl)) {
        imports.push({
          briefId,
          from: url,
          to: finalUrl,
          attribution
        });
      }
    }
  }

  return {
    ok: failures.length === 0,
    imports,
    replacements,
    failures,
    warnings
  };
}

function guessImagePath(sel) {
  const section = sel.sectionKey || sel.sectionId;
  if (!section) return null;
  if (sel.field) return 'sections.' + section + '.' + sel.field;
  return 'sections.' + section + '.image';
}

/** Assert applied site config has no temporary provider delivery URLs. */
function assertNoProviderPreviewUrls(config) {
  const blob = JSON.stringify(config || {});
  const bad = [];
  if (/images\.pexels\.com/i.test(blob)) bad.push('pexels_delivery_url');
  if (/via\.placeholder/i.test(blob)) bad.push('placeholder_url');
  return { ok: bad.length === 0, issues: bad };
}

module.exports = {
  finaliseImagesForApplication,
  assertNoProviderPreviewUrls
};
