'use strict';

/**
 * Image finalisation for application — plan Cloudinary imports and replace temp URLs.
 * Does not call external providers in unit tests when mockImport is supplied.
 */

const { TEMP_URL_RE } = require('./validate');
const { buildCloudinaryImportPlan } = require('../image-service');

/**
 * @param {object} draftConfig
 * @param {{ siteId?: string, draftId?: string, mockImport?: boolean, importedMap?: Record<string, string> }} opts
 */
function finaliseImagesForApplication(draftConfig, opts) {
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

    if (status === 'imported' && url && !TEMP_URL_RE.test(url)) {
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
      if (options.importedMap && options.importedMap[briefId]) {
        finalUrl = options.importedMap[briefId];
      } else if (options.mockImport) {
        finalUrl =
          'https://res.cloudinary.com/leadpages/image/upload/leadpages/' +
          (options.siteId || 'pending') +
          '/website-studio/' +
          briefId +
          '.jpg';
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
          if (plan && plan.publicId) {
            // Plan only — application still requires mockImport or importedMap for final URLs in tests.
            // Production upload happens via /api/cloudinary/sign before commit.
            if (options.acceptImportPlanAsFinal) {
              finalUrl = 'https://res.cloudinary.com/leadpages/image/upload/' + plan.publicId;
            }
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

      if (TEMP_URL_RE.test(finalUrl) && !options.mockImport && !(options.importedMap && options.importedMap[briefId])) {
        if (required) {
          failures.push({ briefId, error: 'temp_url_unresolved', message: 'Import required before application' });
          continue;
        }
      }

      const path = sel.configPath || sel.path || guessImagePath(sel);
      if (path) {
        replacements.push({
          path,
          url: finalUrl,
          attributionPath: sel.attributionPath || null,
          attribution: sel.attribution || (sel.selectedAsset && sel.selectedAsset.attribution) || null,
          briefId
        });
      }
      imports.push({
        briefId,
        from: url,
        to: finalUrl,
        attribution: sel.attribution || null
      });
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

module.exports = {
  finaliseImagesForApplication
};
