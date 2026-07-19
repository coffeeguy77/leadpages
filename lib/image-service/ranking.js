'use strict';

/**
 * Deterministic candidate filtering + ranking from provider metadata only.
 */

function filterCandidates(candidates, brief, opts) {
  const options = opts || {};
  const usedIds = new Set(options.usedProviderAssetIds || []);
  const avoid = (brief.avoidTerms || []).map((t) => String(t).toLowerCase());
  const minW = brief.minimumWidth || 800;
  const minH = brief.minimumHeight || 600;
  const wantOrient = brief.orientation || 'landscape';
  const rejected = [];

  const kept = [];
  for (const c of candidates || []) {
    const id = String(c.providerAssetId || '');
    if (usedIds.has(c.provider + ':' + id)) {
      rejected.push({ id, reason: 'duplicate' });
      continue;
    }
    if (c.originalWidth && c.originalWidth < minW) {
      rejected.push({ id, reason: 'undersized_width' });
      continue;
    }
    if (c.originalHeight && c.originalHeight < minH) {
      rejected.push({ id, reason: 'undersized_height' });
      continue;
    }
    if (c.orientation && wantOrient && c.orientation !== 'unknown' && c.orientation !== wantOrient) {
      // Allow mild mismatch with penalty later; hard-reject strong opposite for hero
      if (brief.purpose === 'hero' && wantOrient === 'landscape' && c.orientation === 'portrait') {
        rejected.push({ id, reason: 'wrong_orientation' });
        continue;
      }
    }
    const hay = [c.alt, c.sourcePageUrl, c.photographerName].join(' ').toLowerCase();
    if (avoid.some((t) => t && hay.includes(t))) {
      rejected.push({ id, reason: 'avoid_term' });
      continue;
    }
    if (!c.sourceImageUrl && !(c.urls && (c.urls.large || c.urls.original))) {
      rejected.push({ id, reason: 'missing_url' });
      continue;
    }
    kept.push(c);
  }
  return { kept, rejected };
}

function rankCandidates(candidates, brief) {
  const subjectTokens = String((brief && brief.subject) || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  const wantOrient = (brief && brief.orientation) || 'landscape';

  return (candidates || [])
    .map((c) => {
      let score = 0;
      const hay = String(c.alt || '').toLowerCase();
      for (const t of subjectTokens) {
        if (hay.includes(t)) score += 8;
      }
      if (c.orientation === wantOrient) score += 15;
      if (c.originalWidth >= ((brief && brief.minimumWidth) || 800)) score += 5;
      if (c.originalHeight >= ((brief && brief.minimumHeight) || 600)) score += 5;
      if (brief && brief.purpose === 'hero' && c.originalWidth >= 1600) score += 10;
      // Prefer larger images
      score += Math.min(20, Math.floor((c.originalWidth || 0) / 400));
      return { candidate: c, score };
    })
    .sort((a, b) => b.score - a.score || String(a.candidate.providerAssetId).localeCompare(String(b.candidate.providerAssetId)));
}

function safePlaceholder(brief) {
  const subject = (brief && brief.subject) || brief.purpose || 'image';
  const label = String((brief && brief.altTextIntent) || subject).slice(0, 48);
  // Inline SVG — never point at a dead host (keeps preview iframes loading forever).
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">' +
    '<defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0f172a"/>' +
    '</linearGradient></defs>' +
    '<rect width="100%" height="100%" fill="url(#p)"/>' +
    '<text x="48" y="820" fill="rgba(255,255,255,.75)" font-family="system-ui,sans-serif" font-size="32">' +
    String(label).replace(/[<>&]/g, '') +
    '</text></svg>';
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return {
    provider: 'placeholder',
    providerAssetId: 'placeholder-' + String((brief && brief.imageBriefId) || 'x'),
    photographerName: '',
    photographerProfileUrl: '',
    sourcePageUrl: '',
    sourceImageUrl: url,
    selectedVariantUrl: url,
    originalWidth: 1600,
    originalHeight: 900,
    orientation: (brief && brief.orientation) || 'landscape',
    alt: (brief && brief.altTextIntent) || subject,
    placeholder: true,
    placeholderLabel: subject,
    approvalStatus: 'placeholder',
    importStatus: 'none'
  };
}

module.exports = {
  filterCandidates,
  rankCandidates,
  safePlaceholder
};
