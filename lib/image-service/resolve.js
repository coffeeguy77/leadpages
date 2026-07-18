'use strict';

const { IMAGE_PROVIDERS } = require('./constants');
const { assertAiImageAccess, assertPexelsAccess, canUseAiImages } = require('./permissions');
const { cacheKey, getCached, setCached } = require('./cache');
const { createImageBrief, validateImageBrief, buildSearchQueries } = require('./image-brief');
const { filterCandidates, rankCandidates, safePlaceholder } = require('./ranking');
const pexels = require('./providers/pexels');
const cloudinary = require('./providers/cloudinary');
const aiImages = require('./providers/ai-images');
const mock = require('./providers/mock');

function defaultProvider() {
  return String(process.env.IMAGE_PROVIDER_DEFAULT || 'pexels').toLowerCase();
}

/**
 * Resolve a structured image brief to a selection + alternates.
 * Searches during generation — results should be stored on the draft and reused.
 *
 * @param {object} briefInput
 * @param {{
 *   actor?: object,
 *   ownedCloudinaryAssets?: object[],
 *   usedProviderAssetIds?: string[],
 *   allowMock?: boolean,
 *   fetchImpl?: Function,
 *   preferProvider?: string
 * }} [opts]
 */
async function resolveImageBrief(briefInput, opts) {
  const options = opts || {};
  const brief = createImageBrief(briefInput);
  const validated = validateImageBrief(brief);
  if (!validated.ok) {
    return { ok: false, errors: validated.errors, selection: safePlaceholder(brief), alternates: [], diagnostics: {} };
  }

  const queries = buildSearchQueries(brief);
  const used = new Set(options.usedProviderAssetIds || []);
  const diagnostics = {
    imageBriefId: brief.imageBriefId,
    imageDirection: brief.visualStyle || brief.photographyStyle || null,
    queriesUsed: queries.slice(),
    selectedProvider: null,
    selectedAssetId: null,
    rejected: [],
    providerErrors: []
  };

  // 1) Owned Cloudinary assets (relevance-filtered)
  if (Array.isArray(options.ownedCloudinaryAssets) && options.ownedCloudinaryAssets.length) {
    const owned = cloudinary.rankOwnedAssets(options.ownedCloudinaryAssets, brief);
    if (owned.length) {
      const top = owned[0];
      used.add(top.provider + ':' + top.providerAssetId);
      diagnostics.selectedProvider = IMAGE_PROVIDERS.CLOUDINARY;
      diagnostics.selectedAssetId = top.providerAssetId;
      return {
        ok: true,
        brief,
        selection: attachMeta(top, brief, queries[0]),
        alternates: owned.slice(1, 6).map((a) => attachMeta(a, brief, queries[0])),
        diagnostics
      };
    }
  }

  // 2) Pexels (or mock)
  const prefer = options.preferProvider || defaultProvider();
  let stockResults = [];
  const pexelsGate = assertPexelsAccess(options.actor || { isSuperuser: true });
  if (!pexelsGate.ok && options.actor) {
    diagnostics.providerErrors.push(pexelsGate);
  } else {
    // Stop after the first successful query that yields enough candidates.
    // Extra queries multiply latency and were a common generate-concepts timeout cause.
    const enough = Math.max(4, Number(options.minStockResults || 8) || 8);
    for (const query of queries) {
      const key = cacheKey({ provider: 'pexels', query, orientation: brief.orientation });
      let search = getCached(key);
      if (!search) {
        if (pexels.isConfigured()) {
          search = await pexels.searchPexels({
            query,
            orientation: brief.orientation,
            perPage: 15,
            fetchImpl: options.fetchImpl,
            timeoutMs: options.pexelsTimeoutMs
          });
        } else if (options.allowMock !== false) {
          search = mock.searchMock({ query, orientation: brief.orientation, perPage: 8 });
          search.mockFallback = true;
        } else {
          search = {
            ok: false,
            error: 'pexels_not_configured',
            message: 'PEXELS_API_KEY is not set',
            results: []
          };
        }
        if (search && search.ok) setCached(key, search);
      }
      if (!search.ok) {
        diagnostics.providerErrors.push({ query, error: search.error, message: search.message });
        continue;
      }
      stockResults = stockResults.concat(search.results || []);
      if (stockResults.length >= enough) {
        diagnostics.queriesUsed = queries.slice(0, queries.indexOf(query) + 1);
        break;
      }
    }
  }

  const filtered = filterCandidates(stockResults, brief, { usedProviderAssetIds: [...used] });
  diagnostics.rejected.push(...filtered.rejected);
  const ranked = rankCandidates(filtered.kept, brief);

  if (ranked.length) {
    const top = ranked[0].candidate;
    used.add(top.provider + ':' + top.providerAssetId);
    diagnostics.selectedProvider = top.provider;
    diagnostics.selectedAssetId = top.providerAssetId;
    return {
      ok: true,
      brief,
      selection: attachMeta(top, brief, queries[0]),
      alternates: ranked.slice(1, 6).map((r) => attachMeta(r.candidate, brief, queries[0])),
      diagnostics
    };
  }

  // 3) AI — superuser only, and only if implemented
  if (canUseAiImages(options.actor) && prefer === IMAGE_PROVIDERS.AI) {
    const ai = await aiImages.generateAiImage(brief, options.actor, options);
    if (ai.ok && ai.results && ai.results[0]) {
      diagnostics.selectedProvider = IMAGE_PROVIDERS.AI;
      diagnostics.selectedAssetId = ai.results[0].providerAssetId;
      return {
        ok: true,
        brief,
        selection: attachMeta(ai.results[0], brief, queries[0]),
        alternates: [],
        diagnostics
      };
    }
    if (!ai.ok) diagnostics.providerErrors.push(ai);
  } else if (options.actor && options.forceAi) {
    const denied = assertAiImageAccess(options.actor);
    if (!denied.ok) {
      return { ok: false, ...denied, selection: safePlaceholder(brief), alternates: [], diagnostics };
    }
  }

  // 4) Safe placeholder
  const placeholder = safePlaceholder(brief);
  diagnostics.selectedProvider = IMAGE_PROVIDERS.PLACEHOLDER;
  diagnostics.selectedAssetId = placeholder.providerAssetId;
  return {
    ok: true,
    brief,
    selection: attachMeta(placeholder, brief, queries[0]),
    alternates: [],
    diagnostics,
    placeholder: true
  };
}

function attachMeta(candidate, brief, searchQuery) {
  const url =
    candidate.selectedVariantUrl ||
    candidate.sourceImageUrl ||
    (candidate.urls && (candidate.urls.large2x || candidate.urls.large || candidate.urls.original)) ||
    '';
  return {
    provider: candidate.provider,
    providerAssetId: candidate.providerAssetId,
    photographerName: candidate.photographerName || '',
    photographerProfileUrl: candidate.photographerProfileUrl || '',
    sourcePageUrl: candidate.sourcePageUrl || '',
    sourceImageUrl: candidate.sourceImageUrl || url,
    selectedVariantUrl: url,
    originalWidth: candidate.originalWidth || 0,
    originalHeight: candidate.originalHeight || 0,
    orientation: candidate.orientation || brief.orientation,
    aspectRatio: brief.targetAspectRatio,
    altText: brief.altTextIntent || candidate.alt || brief.subject,
    searchQuery: searchQuery || '',
    imageBriefId: brief.imageBriefId,
    sectionId: brief.sectionId,
    appId: brief.appId,
    approvalStatus: candidate.placeholder ? 'placeholder' : 'selected',
    importStatus: candidate.importStatus || (candidate.provider === 'cloudinary' ? 'already_cloudinary' : 'not_imported'),
    selectedAt: new Date().toISOString(),
    selectedBy: 'image_service',
    placeholder: !!candidate.placeholder,
    placeholderLabel: candidate.placeholderLabel || null
  };
}

/**
 * Resolve many briefs with duplicate prevention across the concept.
 */
async function resolveImageBriefs(briefs, opts) {
  const used = new Set((opts && opts.usedProviderAssetIds) || []);
  const out = [];
  const diagnosticsList = [];
  for (const b of briefs || []) {
    const resolved = await resolveImageBrief(b, { ...(opts || {}), usedProviderAssetIds: [...used] });
    if (resolved.selection && resolved.selection.providerAssetId) {
      used.add(resolved.selection.provider + ':' + resolved.selection.providerAssetId);
    }
    out.push(resolved);
    diagnosticsList.push(resolved.diagnostics);
  }
  return { ok: true, results: out, diagnostics: diagnosticsList, usedProviderAssetIds: [...used] };
}

module.exports = {
  resolveImageBrief,
  resolveImageBriefs,
  defaultProvider
};
