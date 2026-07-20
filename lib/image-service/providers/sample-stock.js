'use strict';

/**
 * Curated, publicly reachable stock photos used when PEXELS_API_KEY is unset.
 * Prefer real CDN JPEGs over abstract SVG mocks so Studio previews look populated.
 * Only use hosts that resolve quickly (images.pexels.com / images.unsplash.com) —
 * never invent hosts like images.example.com (Safari tab spinner hang).
 */

const crypto = require('crypto');

function pexels(id, w) {
  const width = w || 1600;
  return (
    'https://images.pexels.com/photos/' +
    id +
    '/pexels-photo-' +
    id +
    '.jpeg?auto=compress&cs=tinysrgb&w=' +
    width
  );
}

function unsplash(id, w, h) {
  return (
    'https://images.unsplash.com/' +
    id +
    '?w=' +
    (w || 1600) +
    '&h=' +
    (h || 900) +
    '&fit=crop&auto=format'
  );
}

/** @type {Array<{ keys: string[], urls: string[] }>} */
const BUCKETS = [
  {
    keys: ['rc', 'remote control', 'buggy', 'hobby', 'track', 'nitro', 'scale model'],
    urls: [
      pexels(8986141),
      pexels(1637859),
      pexels(3802510),
      unsplash('photo-1581235720704-06d3acfcb36f'),
      unsplash('photo-1566576912321-d58ddd7a6088'),
      pexels(4489732)
    ]
  },
  {
    keys: ['toy', 'toys', 'parts', 'shelf', 'retail', 'shop', 'brand photography'],
    urls: [
      unsplash('photo-1566576912321-d58ddd7a6088'),
      pexels(4489732),
      pexels(4489734),
      pexels(1231643),
      unsplash('photo-1581235720704-06d3acfcb36f'),
      pexels(3802510)
    ]
  },
  {
    keys: ['car', 'racing', 'vehicle', 'workshop', 'tuning'],
    urls: [
      unsplash('photo-1533473359331-0135ef1b58bf'),
      pexels(3593922),
      pexels(2116475),
      pexels(3802510),
      unsplash('photo-1492144534655-ae79c964c9d7')
    ]
  },
  {
    keys: ['coffee', 'cafe', 'barista', 'cart'],
    urls: [pexels(302899), pexels(312418), unsplash('photo-1495474472287-4d71bcdd2085')]
  },
  {
    keys: ['jewellery', 'jewelry', 'diamond', 'ring'],
    urls: [
      unsplash('photo-1515562141207-7a88fb7ce338'),
      unsplash('photo-1605100804763-247f67b3557e')
    ]
  },
  {
    keys: ['electric', 'trade', 'plumber', 'landscap'],
    urls: [
      unsplash('photo-1621905251189-08b45d6a269e'),
      unsplash('photo-1503387762-592deb58ef4e')
    ]
  }
];

const FALLBACK = [
  unsplash('photo-1492144534655-ae79c964c9d7'),
  unsplash('photo-1503387762-592deb58ef4e'),
  pexels(3802510),
  pexels(3593922),
  unsplash('photo-1566576912321-d58ddd7a6088'),
  unsplash('photo-1581235720704-06d3acfcb36f'),
  pexels(8986141),
  pexels(1637859),
  pexels(4489732),
  pexels(4489734),
  pexels(1231643),
  pexels(2116475)
];

function pickBucket(query) {
  const q = String(query || '').toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const bucket of BUCKETS) {
    let score = 0;
    for (const key of bucket.keys) {
      if (q.includes(key)) score += key.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = bucket;
    }
  }
  return best;
}

function assetId(query, idx) {
  // Full-hash ids — slicing hex(query) collided across similar gallery queries.
  return (
    'sample-' +
    crypto.createHash('sha1').update(String(query || '') + '|' + String(idx)).digest('hex').slice(0, 16)
  );
}

function searchSampleStock(opts) {
  const query = String((opts && opts.query) || 'stock');
  const orientation = (opts && opts.orientation) || 'landscape';
  const perPage = Math.min(12, (opts && opts.perPage) || 6);
  const usedUrls = new Set(opts && opts.usedUrls ? opts.usedUrls : []);
  const bucket = pickBucket(query);
  const pool = (bucket && bucket.urls.length ? bucket.urls : FALLBACK).slice();
  // Rotate pool by query hash so similar subjects still get distinct starting URLs.
  const rot = crypto.createHash('sha1').update(query).digest().readUInt8(0) % Math.max(1, pool.length);
  const rotated = pool.slice(rot).concat(pool.slice(0, rot)).concat(FALLBACK);
  const results = [];
  const seenLocal = new Set();
  for (let i = 0; i < rotated.length && results.length < perPage; i++) {
    const url = rotated[i];
    if (!url || seenLocal.has(url) || usedUrls.has(url)) continue;
    seenLocal.add(url);
    const w = orientation === 'portrait' ? 1200 : 1600;
    const h = orientation === 'portrait' ? 1800 : 900;
    results.push({
      provider: 'sample-stock',
      providerAssetId: assetId(query, results.length),
      photographerName: 'Sample stock',
      photographerProfileUrl: '',
      sourcePageUrl: url.split('?')[0],
      sourceImageUrl: url,
      selectedVariantUrl: url,
      originalWidth: w,
      originalHeight: h,
      orientation,
      alt: query,
      urls: { original: url, large: url, medium: url }
    });
  }
  // If uniqueness exhausted the pool, still return unused-by-id variants.
  for (let i = 0; results.length < perPage && i < FALLBACK.length * 2; i++) {
    const url = FALLBACK[i % FALLBACK.length];
    const w = orientation === 'portrait' ? 1200 : 1600;
    const h = orientation === 'portrait' ? 1800 : 900;
    results.push({
      provider: 'sample-stock',
      providerAssetId: assetId(query + '#pad', results.length),
      photographerName: 'Sample stock',
      photographerProfileUrl: '',
      sourcePageUrl: url.split('?')[0],
      sourceImageUrl: url,
      selectedVariantUrl: url,
      originalWidth: w,
      originalHeight: h,
      orientation,
      alt: query,
      urls: { original: url, large: url, medium: url }
    });
  }
  return {
    ok: true,
    results,
    page: 1,
    perPage,
    totalResults: results.length,
    sampleStockFallback: true
  };
}

module.exports = { searchSampleStock, BUCKETS, FALLBACK, pexels, unsplash, assetId };
