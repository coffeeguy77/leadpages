'use strict';

/**
 * Deterministic mock provider for tests / missing API keys.
 * Uses same-origin-safe SVG data URIs so preview iframes never hang on
 * unresolved hosts like images.example.com (keeps the browser tab spinning).
 */

function svgDataUri(label, orientation, idx) {
  const w = orientation === 'portrait' ? 1200 : 1600;
  const h = orientation === 'portrait' ? 1800 : 900;
  const hues = [210, 28, 160, 320, 45, 190];
  const hue = hues[idx % hues.length];
  const safe = String(label || 'Mock')
    .replace(/[<>&]/g, '')
    .slice(0, 48);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '" viewBox="0 0 ' +
    w +
    ' ' +
    h +
    '">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="hsl(' +
    hue +
    ' 42% 28%)"/>' +
    '<stop offset="100%" stop-color="hsl(' +
    ((hue + 40) % 360) +
    ' 38% 18%)"/>' +
    '</linearGradient></defs>' +
    '<rect width="100%" height="100%" fill="url(#g)"/>' +
    '<text x="48" y="' +
    Math.round(h * 0.9) +
    '" fill="rgba(255,255,255,.88)" font-family="system-ui,sans-serif" font-size="36" font-weight="600">' +
    safe +
    '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function searchMock(opts) {
  const query = String((opts && opts.query) || 'stock');
  const orientation = (opts && opts.orientation) || 'landscape';
  const perPage = Math.min(12, (opts && opts.perPage) || 6);
  const results = [];
  for (let i = 0; i < perPage; i++) {
    const w = orientation === 'portrait' ? 1200 : 2400;
    const h = orientation === 'portrait' ? 1800 : 1350;
    const url = svgDataUri(query, orientation, i);
    results.push({
      provider: 'mock',
      providerAssetId: 'mock-' + Buffer.from(query).toString('hex').slice(0, 8) + '-' + i,
      photographerName: 'Mock Photographer',
      photographerProfileUrl: '',
      sourcePageUrl: '',
      sourceImageUrl: url,
      selectedVariantUrl: url,
      originalWidth: w,
      originalHeight: h,
      orientation,
      alt: query,
      urls: { original: url, large: url, medium: url }
    });
  }
  return { ok: true, results, page: 1, perPage, totalResults: results.length };
}

module.exports = { searchMock, svgDataUri };
