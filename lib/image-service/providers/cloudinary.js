'use strict';

/**
 * Cloudinary provider — reuses existing platform env vars and folder scope.
 * Does not expose secrets to browsers. Server-side import uses API secret only here.
 */

const crypto = require('crypto');
const {
  ENV_CLOUDINARY_CLOUD_NAME,
  ENV_CLOUDINARY_API_KEY,
  ENV_CLOUDINARY_API_SECRET,
  ENV_CLOUDINARY_URL
} = require('../constants');

/** Dedupe registry for imported provider assets within a process + optional durable map. */
const importedByProviderAsset = new Map();

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
    apiKey,
    // secret stays server-side only — never serialize this object to clients
    _apiSecret: apiSecret,
    configured: !!(apiKey && apiSecret && cloudName),
    hasSecret: !!apiSecret
  };
}

function publicDeliveryUrl(cloudName, publicId, transform) {
  const t = transform ? transform.replace(/^\/+|\/+$/g, '') + '/' : '';
  return 'https://res.cloudinary.com/' + cloudName + '/image/upload/' + t + publicId;
}

function transformationRefs(cloudName, publicId) {
  return {
    desktop: publicDeliveryUrl(cloudName, publicId, 'c_fill,w_1600,h_900,q_auto,f_auto'),
    mobile: publicDeliveryUrl(cloudName, publicId, 'c_fill,w_800,h_1200,q_auto,f_auto'),
    original: publicDeliveryUrl(cloudName, publicId, 'q_auto,f_auto')
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
    signEndpoint: '/api/cloudinary/sign'
  };
}

function dedupeKey(selection, publicId) {
  const provider = (selection && selection.provider) || 'unknown';
  const assetId = (selection && selection.providerAssetId) || publicId;
  return provider + ':' + assetId;
}

/**
 * Server-side import: fetch remote image → signed Cloudinary upload under leadpages/.
 * Secrets never leave this module. Dedupes by provider asset id.
 *
 * @param {object} selection
 * @param {{ siteId?: string, draftId?: string, fetchImpl?: Function, dryRun?: boolean }} [opts]
 */
async function importRemoteAsset(selection, opts) {
  const options = opts || {};
  const cfg = cloudConfig();
  const plan = buildImportPlan(selection, options);
  const key = dedupeKey(selection, plan.publicId);
  if (importedByProviderAsset.has(key)) {
    const prior = importedByProviderAsset.get(key);
    return { ok: true, deduped: true, ...prior };
  }

  const sourceUrl =
    (selection && (selection.sourceImageUrl || selection.selectedVariantUrl || selection.url)) || '';
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
    return { ok: false, error: 'invalid_source_url', message: 'Remote image URL required' };
  }

  // Reject cross-tenant Cloudinary sources outside leadpages/{siteId}
  if (options.siteId && /res\.cloudinary\.com/i.test(sourceUrl)) {
    const prefix = 'leadpages/' + options.siteId;
    if (sourceUrl.includes('leadpages/') && !sourceUrl.includes(prefix)) {
      return {
        ok: false,
        error: 'cross_tenant_asset',
        message: 'Source asset is outside the destination tenant Cloudinary folder'
      };
    }
  }

  if (options.dryRun) {
    const cloudName = cfg.cloudName || 'leadpages';
    const transforms = transformationRefs(cloudName, plan.publicId);
    const dry = {
      publicId: plan.publicId,
      url: transforms.original,
      secureUrl: transforms.original,
      transformations: transforms,
      attribution: {
        provider: plan.sourceProvider || 'pexels',
        photographerName: plan.photographerName || '',
        sourcePageUrl: plan.sourcePageUrl || '',
        providerAssetId: plan.sourceProviderAssetId || null
      },
      importStatus: 'dry_run',
      plan
    };
    return { ok: true, dryRun: true, ...dry };
  }

  if (!cfg.configured) {
    return {
      ok: false,
      error: 'cloudinary_not_configured',
      message: 'CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET required for pilot import'
    };
  }

  const fetchImpl = options.fetchImpl || fetch;
  let bytes;
  let contentType = 'image/jpeg';
  try {
    const resp = await fetchImpl(sourceUrl);
    if (!resp.ok) {
      return {
        ok: false,
        error: 'source_fetch_failed',
        message: 'Failed to fetch source image (' + resp.status + ')'
      };
    }
    contentType = resp.headers.get('content-type') || contentType;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (!buf.length) {
      return { ok: false, error: 'empty_source_image', message: 'Source image had no bytes' };
    }
    bytes = buf;
  } catch (err) {
    return {
      ok: false,
      error: 'source_fetch_error',
      message: err && err.message ? err.message : String(err)
    };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const overwrite = 'false';
  const publicId = plan.publicId;
  const assetFolder = plan.assetFolder;
  const params = {
    asset_folder: assetFolder,
    overwrite,
    public_id: publicId,
    timestamp
  };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => k + '=' + params[k])
    .join('&');
  const signature = crypto.createHash('sha1').update(toSign + cfg._apiSecret).digest('hex');

  const ext = /png/i.test(contentType) ? 'png' : /webp/i.test(contentType) ? 'webp' : 'jpg';
  const dataUri = 'data:image/' + (ext === 'jpg' ? 'jpeg' : ext) + ';base64,' + bytes.toString('base64');

  try {
    const fd = new URLSearchParams();
    fd.append('file', dataUri);
    fd.append('api_key', cfg.apiKey);
    fd.append('timestamp', String(timestamp));
    fd.append('public_id', publicId);
    fd.append('asset_folder', assetFolder);
    fd.append('overwrite', overwrite);
    fd.append('signature', signature);

    const ur = await fetchImpl(
      'https://api.cloudinary.com/v1_1/' + cfg.cloudName + '/image/upload',
      { method: 'POST', body: fd }
    );
    const uj = await ur.json().catch(() => ({}));
    if (!ur.ok || !uj.secure_url) {
      return {
        ok: false,
        error: 'cloudinary_upload_failed',
        message: (uj.error && uj.error.message) || 'Upload failed (' + ur.status + ')'
      };
    }

    const transforms = transformationRefs(cfg.cloudName, uj.public_id || publicId);
    const result = {
      publicId: uj.public_id || publicId,
      url: uj.secure_url,
      secureUrl: uj.secure_url,
      transformations: transforms,
      width: uj.width || null,
      height: uj.height || null,
      attribution: {
        provider: plan.sourceProvider || selection.provider || 'pexels',
        photographerName: plan.photographerName || selection.photographerName || '',
        sourcePageUrl: plan.sourcePageUrl || selection.sourcePageUrl || '',
        providerAssetId: plan.sourceProviderAssetId || selection.providerAssetId || null
      },
      importStatus: 'imported',
      plan: {
        publicId: uj.public_id || publicId,
        assetFolder,
        sourceProvider: plan.sourceProvider,
        importStatus: 'imported'
      }
    };
    importedByProviderAsset.set(key, result);
    return { ok: true, deduped: false, ...result };
  } catch (err) {
    return {
      ok: false,
      error: 'cloudinary_upload_error',
      message: err && err.message ? err.message : String(err)
    };
  }
}

function clearImportDedupeCache() {
  importedByProviderAsset.clear();
}

module.exports = {
  cloudConfig,
  isConfigured,
  rankOwnedAssets,
  buildImportPlan,
  importRemoteAsset,
  transformationRefs,
  publicDeliveryUrl,
  clearImportDedupeCache
};
