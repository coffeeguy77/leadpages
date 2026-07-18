'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveImageBrief,
  resolveImageBriefs,
  createImageBrief,
  buildSearchQueries,
  clearCache,
  cacheSize,
  canUseAiImages,
  assertAiImageAccess,
  assertPexelsAccess,
  buildCloudinaryImportPlan,
  pexels
} = require('../lib/image-service');

const ranking = require('../lib/image-service/ranking');

describe('Image Service — permissions', () => {
  it('allows superuser AI access and denies partner/client', () => {
    assert.equal(canUseAiImages({ isSuperuser: true }), true);
    assert.equal(canUseAiImages({ isPartner: true }), false);
    assert.equal(canUseAiImages({ isClient: true }), false);
    assert.equal(assertAiImageAccess({ isPartner: true }).ok, false);
    assert.equal(assertAiImageAccess({ isClient: true }).ok, false);
    assert.equal(assertAiImageAccess({ isSuperuser: true }).ok, true);
  });

  it('allows partners and clients to use Pexels', () => {
    assert.equal(assertPexelsAccess({ isPartner: true }).ok, true);
    assert.equal(assertPexelsAccess({ isClient: true }).ok, true);
  });
});

describe('Image Service — structured briefs and queries', () => {
  it('builds focused multi-term queries (not single broad nouns)', () => {
    const brief = createImageBrief({
      purpose: 'hero',
      subject: 'mobile coffee cart serving guests',
      setting: 'stylish outdoor corporate event',
      industry: 'coffee-event',
      photographyStyle: 'warm editorial hospitality photography',
      humanPresence: 'professional barista and guests'
    });
    const queries = buildSearchQueries(brief);
    assert.ok(queries.length >= 2);
    assert.ok(queries[0].split(/\s+/).length >= 4);
    assert.ok(!queries.every((q) => q === 'coffee'));
  });
});

describe('Image Service — ranking and quality filters', () => {
  it('filters wrong orientation, undersized, and duplicates', () => {
    const brief = createImageBrief({
      purpose: 'hero',
      subject: 'coffee cart event',
      orientation: 'landscape',
      minimumWidth: 1600,
      minimumHeight: 900
    });
    const candidates = [
      {
        provider: 'pexels',
        providerAssetId: '1',
        orientation: 'portrait',
        originalWidth: 2000,
        originalHeight: 3000,
        sourceImageUrl: 'https://example.com/1.jpg'
      },
      {
        provider: 'pexels',
        providerAssetId: '2',
        orientation: 'landscape',
        originalWidth: 800,
        originalHeight: 500,
        sourceImageUrl: 'https://example.com/2.jpg'
      },
      {
        provider: 'pexels',
        providerAssetId: '3',
        orientation: 'landscape',
        originalWidth: 2000,
        originalHeight: 1200,
        sourceImageUrl: 'https://example.com/3.jpg',
        alt: 'coffee cart event barista'
      },
      {
        provider: 'pexels',
        providerAssetId: '3',
        orientation: 'landscape',
        originalWidth: 2000,
        originalHeight: 1200,
        sourceImageUrl: 'https://example.com/3b.jpg'
      }
    ];
    const filtered = ranking.filterCandidates(candidates, brief, {
      usedProviderAssetIds: ['pexels:3']
    });
    assert.ok(filtered.rejected.some((r) => r.reason === 'wrong_orientation'));
    assert.ok(filtered.rejected.some((r) => r.reason === 'undersized_width' || r.reason === 'undersized_height'));
    assert.ok(filtered.rejected.some((r) => r.reason === 'duplicate'));
    assert.equal(filtered.kept.length, 0);

    const open = ranking.filterCandidates(
      [
        {
          provider: 'pexels',
          providerAssetId: '9',
          orientation: 'landscape',
          originalWidth: 2000,
          originalHeight: 1200,
          sourceImageUrl: 'https://example.com/9.jpg',
          alt: 'mobile coffee cart corporate event'
        }
      ],
      brief,
      {}
    );
    assert.equal(open.kept.length, 1);
    const ranked = ranking.rankCandidates(open.kept, brief);
    assert.ok(ranked[0].score > 0);
  });
});

describe('Image Service — resolve + cache', () => {
  beforeEach(() => {
    clearCache();
  });

  it('fails gracefully without PEXELS_API_KEY and uses mock/placeholder', async () => {
    const prev = process.env.PEXELS_API_KEY;
    delete process.env.PEXELS_API_KEY;
    assert.equal(pexels.isConfigured(), false);
    const resolved = await resolveImageBrief(
      {
        purpose: 'hero',
        subject: 'premium mobile coffee cart',
        setting: 'outdoor wedding',
        industry: 'coffee-event',
        orientation: 'landscape'
      },
      { actor: { isPartner: true }, allowMock: true }
    );
    assert.equal(resolved.ok, true);
    assert.ok(resolved.selection);
    assert.ok(['mock', 'placeholder'].includes(resolved.selection.provider));
    assert.ok(resolved.selection.photographerName !== undefined);
    assert.ok(resolved.selection.altText);
    if (prev) process.env.PEXELS_API_KEY = prev;
  });

  it('caches search results so repeated resolve does not grow unbounded provider calls', async () => {
    delete process.env.PEXELS_API_KEY;
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: 'unauthorized' })
      };
    };
    const brief = {
      purpose: 'gallery',
      subject: 'event coffee service',
      setting: 'festival',
      orientation: 'landscape'
    };
    // With no key, mock is used and cached
    await resolveImageBrief(brief, { allowMock: true, fetchImpl, actor: { isSuperuser: true } });
    const size1 = cacheSize();
    await resolveImageBrief(brief, { allowMock: true, fetchImpl, actor: { isSuperuser: true } });
    assert.ok(cacheSize() >= size1);
    assert.equal(calls, 0, 'mock path must not call fetch');
  });

  it('prevents duplicate asset IDs across a batch', async () => {
    delete process.env.PEXELS_API_KEY;
    const briefs = [
      { purpose: 'hero', subject: 'coffee cart', orientation: 'landscape', sectionId: 'hero' },
      { purpose: 'gallery', subject: 'coffee cart', orientation: 'landscape', sectionId: 'featuredProjects' },
      { purpose: 'gallery', subject: 'coffee cart', orientation: 'landscape', sectionId: 'featuredProjects' }
    ];
    const batch = await resolveImageBriefs(briefs, { allowMock: true, actor: { isSuperuser: true } });
    const ids = batch.results.map((r) => r.selection && r.selection.provider + ':' + r.selection.providerAssetId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('rejects unauthorised AI force even when manually requested', async () => {
    const denied = await resolveImageBrief(
      { purpose: 'hero', subject: 'ring', orientation: 'landscape' },
      { actor: { isPartner: true }, forceAi: true, preferProvider: 'ai-images', allowMock: false }
    );
    // Partner cannot use AI; falls through to placeholder when stock unavailable
    assert.ok(denied.selection);
    assert.notEqual(denied.selection.provider, 'ai-images');
    assert.equal(assertAiImageAccess({ isPartner: true }).ok, false);
  });

  it('preserves attribution metadata on selection', async () => {
    delete process.env.PEXELS_API_KEY;
    const resolved = await resolveImageBrief(
      {
        purpose: 'hero',
        subject: 'luxury pink diamond ring',
        orientation: 'landscape',
        altTextIntent: 'Pink diamond engagement ring on soft velvet'
      },
      { allowMock: true, actor: { isSuperuser: true } }
    );
    const s = resolved.selection;
    assert.ok(s.provider);
    assert.ok(s.providerAssetId);
    assert.ok('photographerName' in s);
    assert.ok('sourcePageUrl' in s);
    assert.ok('originalWidth' in s);
    assert.ok(s.altText);
    assert.ok(s.importStatus);
    assert.ok(s.approvalStatus);
  });

  it('times out hung Pexels fetches instead of hanging forever', async () => {
    const prev = process.env.PEXELS_API_KEY;
    process.env.PEXELS_API_KEY = 'test-key';
    clearCache();
    const fetchImpl = (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = init && init.signal;
        if (!signal) return; // hang only if no signal — race timeout still covers this
        if (signal.aborted) {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
          return;
        }
        signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    const started = Date.now();
    const result = await pexels.searchPexels({
      query: 'coffee cart event',
      orientation: 'landscape',
      fetchImpl,
      timeoutMs: 80
    });
    const elapsed = Date.now() - started;
    assert.equal(result.ok, false);
    assert.equal(result.error, 'pexels_timeout');
    assert.ok(elapsed < 2000, 'expected AbortSignal timeout, elapsed=' + elapsed);
    if (prev) process.env.PEXELS_API_KEY = prev;
    else delete process.env.PEXELS_API_KEY;
  });

  it('stops Pexels queries once enough stock results are available', async () => {
    const prev = process.env.PEXELS_API_KEY;
    process.env.PEXELS_API_KEY = 'test-key';
    clearCache();
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          page: 1,
          per_page: 15,
          total_results: 100,
          photos: Array.from({ length: 12 }, (_, i) => ({
            id: 1000 + i + calls * 100,
            width: 2400,
            height: 1600,
            url: 'https://www.pexels.com/photo/' + (1000 + i),
            photographer: 'Test',
            photographer_url: 'https://www.pexels.com/@test',
            alt: 'coffee',
            src: {
              original: 'https://images.pexels.com/photos/' + (1000 + i) + '/o.jpg',
              large2x: 'https://images.pexels.com/photos/' + (1000 + i) + '/l2.jpg',
              large: 'https://images.pexels.com/photos/' + (1000 + i) + '/l.jpg',
              medium: 'https://images.pexels.com/photos/' + (1000 + i) + '/m.jpg',
              small: 'https://images.pexels.com/photos/' + (1000 + i) + '/s.jpg',
              tiny: 'https://images.pexels.com/photos/' + (1000 + i) + '/t.jpg'
            }
          }))
        })
      };
    };
    const resolved = await resolveImageBrief(
      {
        purpose: 'hero',
        subject: 'mobile coffee cart serving guests',
        setting: 'stylish outdoor corporate event',
        industry: 'coffee-event',
        photographyStyle: 'warm editorial hospitality photography',
        humanPresence: 'professional barista and guests',
        orientation: 'landscape',
        minimumWidth: 1200,
        minimumHeight: 800
      },
      { allowMock: false, fetchImpl, actor: { isSuperuser: true }, minStockResults: 8 }
    );
    assert.equal(resolved.ok, true);
    assert.ok(calls >= 1);
    assert.ok(calls < 4, 'should not exhaust all query variants when first page is enough, calls=' + calls);
    if (prev) process.env.PEXELS_API_KEY = prev;
    else delete process.env.PEXELS_API_KEY;
  });

  it('builds Cloudinary import plan without exposing secrets', () => {
    const plan = buildCloudinaryImportPlan(
      {
        provider: 'pexels',
        providerAssetId: '123',
        sourceImageUrl: 'https://images.pexels.com/photos/123/a.jpg',
        photographerName: 'Ada',
        sourcePageUrl: 'https://www.pexels.com/photo/123/',
        imageBriefId: 'brief_test'
      },
      { siteId: 'site_abc', draftId: 'draft_1' }
    );
    assert.ok(plan.ok);
    assert.ok(plan.publicId.includes('leadpages/site_abc/website-studio'));
    assert.equal(plan.sourceProvider, 'pexels');
    assert.equal(plan.photographerName, 'Ada');
    assert.equal(plan.importStatus, 'pending_upload');
    const dumped = JSON.stringify(plan);
    assert.doesNotMatch(dumped, /CLOUDINARY_API_SECRET|api_secret/i);
  });
});
