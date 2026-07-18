'use strict';

/**
 * Deterministic mock provider for tests / missing API keys.
 */

function searchMock(opts) {
  const query = String((opts && opts.query) || 'stock');
  const orientation = (opts && opts.orientation) || 'landscape';
  const perPage = Math.min(12, (opts && opts.perPage) || 6);
  const results = [];
  for (let i = 0; i < perPage; i++) {
    const w = orientation === 'portrait' ? 1200 : 2400;
    const h = orientation === 'portrait' ? 1800 : 1350;
    results.push({
      provider: 'mock',
      providerAssetId: 'mock-' + Buffer.from(query).toString('hex').slice(0, 8) + '-' + i,
      photographerName: 'Mock Photographer',
      photographerProfileUrl: 'https://example.com/photographer',
      sourcePageUrl: 'https://example.com/photos/' + i,
      sourceImageUrl:
        'https://images.example.com/' +
        encodeURIComponent(query.replace(/\s+/g, '-')) +
        '/' +
        orientation +
        '-' +
        i +
        '.jpg',
      originalWidth: w,
      originalHeight: h,
      orientation,
      alt: query,
      urls: {}
    });
  }
  return { ok: true, results, page: 1, perPage, totalResults: results.length };
}

module.exports = { searchMock };
