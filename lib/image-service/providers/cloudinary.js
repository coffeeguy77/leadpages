'use strict';

/**
 * Cloudinary provider — reuses existing platform env vars and folder scope.
 * Does not expose secrets. Upload signing remains in api/cloudinary/sign.js.
 */

const {
  ENV_CLOUDINARY_CLOUD_NAME,
  ENV_CLOUDINARY_API_KEY,
  ENV_CLOUDINARY_API_SECRET,
  ENV_CLOUDINARY_URL
} = require('../constants');

function cloudConfig() {
  const url = String(process.env[ENV_CLOUDINARY_URL] || '');
  let cloudName = process.env[ENV_CLOUDINARY_CLOUD_NAME] || 'dzx6x1hou';
  let apiKey = process.env[ENV_CLOUDINARY_API_KEY] || '';
  let apiSecret = process.env[ENV_CLOUDINARY_API_SECRET] || '';
  const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (m) {
    apiKey = apiKey || m[1];
    apiSecret = apiSecret || m[2];
    cloudName = cloudName || m[3];
  }
  return {
    cloudName,
    configured: !!(apiKey && apiSecret && cloudName),
    // never return secrets from public helpers
    hasSecret: !!apiSecret
  };
}

function isConfigured() {
  return cloudConfig().configured;
}

/**
 * Filter owned Cloudinary assets for relevance to an image brief.
 * @param {Array<object>} assets - candidate library assets {publicId,url,tags,folder,width,height}
 * @param {object} brief
 */
function rankOwnedAssets(assets, brief) {
  const list = Array.isArray(assets) ? assets : [];
  const subject = String((brief && brief.subject) || '').toLowerCase();
  const industry = String((brief && brief.industry) || '').toLowerCase();
  const tokens = (subject + ' ' + industry)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);

  return list
    .map((a) => {
      const hay = [a.publicId, a.url, ...(a.tags || []), a.folder]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (hay.includes(t)) score += 10;
      }
      // Prefer assets under leadpages/
      if (String(a.publicId || a.folder || '').startsWith('leadpages/')) score += 5;
      // Tenant isolation: must match site folder when provided
      if (brief && brief.siteId) {
        const prefix = 'leadpages/' + brief.siteId;
        if (!String(a.publicId || '').startsWith(prefix) && !String(a.folder || '').startsWith(prefix)) {
          score = -1000;
        }
      }
      return { asset: a, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => ({
      provider: 'cloudinary',
      providerAssetId: r.asset.publicId,
      sourceImageUrl: r.asset.url,
      selectedVariantUrl: r.asset.url,
      originalWidth: r.asset.width || 0,
      originalHeight: r.asset.height || 0,
      photographerName: '',
      sourcePageUrl: r.asset.url,
      score: r.score,
      importStatus: 'already_cloudinary'
    }));
}

/**
 * Build a draft import record for a Pexels selection → Cloudinary path.
 * Actual binary upload uses existing signed upload flow; this stores the plan.
 */
function buildImportPlan(selection, opts) {
  const options = opts || {};
  const siteId = String(options.siteId || 'website-studio-drafts');
  const draftId = String(options.draftId || 'draft');
  const briefId = String((selection && selection.imageBriefId) || 'img');
  const publicId =
    'leadpages/' +
    siteId +
    '/website-studio/' +
    draftId +
    '/' +
    briefId +
    '-' +
    String((selection && selection.providerAssetId) || Date.now());

  return {
    ok: true,
    publicId,
    assetFolder: publicId.replace(/\/[^/]+$/, ''),
    sourceProvider: selection && selection.provider,
    sourceProviderAssetId: selection && selection.providerAssetId,
    sourcePageUrl: selection && selection.sourcePageUrl,
    photographerName: selection && selection.photographerName,
    sourceImageUrl: selection && selection.sourceImageUrl,
    importStatus: 'pending_upload',
    // Client/server should call /api/cloudinary/sign then upload sourceImageUrl bytes
    signEndpoint: '/api/cloudinary/sign'
  };
}

module.exports = {
  cloudConfig,
  isConfigured,
  rankOwnedAssets,
  buildImportPlan
};
