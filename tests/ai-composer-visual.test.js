'use strict';

/** AI Composer visual check (lib/ai-composer/visual.js) and screenshot guards (snapshot.js). */

const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeClientPlan } = require('../lib/ai-composer/plan');
const { pairSections, reviewItems, normalizeVerdicts, applyVerdicts } = require('../lib/ai-composer/visual');
const { isPrivateIp, checkExternalUrl, checkSiteUrl } = require('../lib/ai-composer/snapshot');
const { visualMessages, VISUAL_SCHEMA } = require('../lib/ai-composer/prompts');

const DESIGN = { url: 'https://res.cloudinary.com/dzx6x1hou/image/upload/v1/leadpages/ai-composer/202610/d.png', width: 1440, height: 3000 };
const SNAP = { imageUrl: 'https://res.cloudinary.com/dzx6x1hou/image/upload/v2/leadpages/ai-composer/snap/202610/x.jpg', width: 1440, height: 4000,
  sections: [{ sec: 'heroSlider', y: 70, h: 700 }, { sec: 'services', y: 800, h: 600 }, { sec: 'faq', y: 1500, h: 10 }] };
function plan() {
  return sanitizeClientPlan({ design: DESIGN, businessName: 'Co', sections: [
    { id: 's1', appKey: 'heroSlider', layout: 'slider', rows: { y0: 0, y1: 700 } },
    { id: 's2', appKey: 'services', layout: 'grid', rows: { y0: 700, y1: 1400 } },
    { id: 's3', appKey: 'faq', layout: 'standard', rows: { y0: 1400, y1: 2000 } },
    { id: 's4', appKey: 'quote', rows: { y0: 2000, y1: 2600 } }
  ] });
}

test.describe('AI Composer — visual check', () => {
  test('sections pair with their built position; tiny or missing ones are skipped', () => {
    const pairs = pairSections(plan(), SNAP.sections);
    assert.deepEqual(pairs.map((p) => p.section.id), ['s1', 's2']);
  });

  test('review items carry design and built crops plus the other layouts', () => {
    const items = reviewItems(plan(), SNAP, ['s2']);
    assert.equal(items.length, 1);
    assert.match(items[0].designUrls[0], /c_crop,x_0,y_700/);
    assert.match(items[0].builtUrls[0], /snap\/202610\/x\.jpg$/);
    assert.match(items[0].builtUrls[0], /c_crop,x_0,y_800/);
    assert.ok(items[0].layouts.some((l) => l.id === 'numbered'));
    const msgs = visualMessages({ items });
    assert.equal(msgs[1].content.filter((b) => b.type === 'image').length, 2);
    assert.ok(VISUAL_SCHEMA.properties.sections);
  });

  test('verdicts only allow real layouts / tones / sides of the same app', () => {
    const p = plan();
    const v = normalizeVerdicts({ sections: [
      { id: 's1', verdict: 'wrong', issues: ['text should be beside the photo'], layout: 'split', tone: 'soft', photoSide: 'left' },
      { id: 's2', verdict: 'close', layout: 'zigzag', tone: 'dark', refill: true },
      { id: 's3', verdict: 'good', layout: 'split' },
      { id: 's9', verdict: 'wrong' },
      { id: 's1', verdict: 'good' }
    ] }, p);
    assert.equal(v.length, 3);
    assert.deepEqual(v[0].fix, { layout: 'split', tone: 'soft', photoSide: 'left' });
    assert.deepEqual(v[1].fix, {}, 'unknown layout and a tone grid does not support are dropped');
    assert.equal(v[1].refill, true);
    const applied = applyVerdicts(p, v);
    const s1 = applied.plan.sections.find((s) => s.id === 's1');
    assert.deepEqual([s1.layout, s1.tone, s1.photoSide], ['split', 'soft', 'left']);
    assert.deepEqual(applied.refill.sort(), ['s1', 's2']);
    assert.equal(applied.plan.sections.find((s) => s.id === 's3').layout, 'standard', '"good" sections are never changed');
    assert.equal(p.sections[0].layout, 'slider', 'the original plan is not mutated');
    // A photo layout is refused for a section without a photo.
    const noPhoto = normalizeVerdicts({ sections: [{ id: 's2', verdict: 'wrong', layout: 'feature' }] }, p);
    assert.deepEqual(noPhoto[0].fix, {}, 'feature needs a photo and s2 has none');
  });
});

test.describe('AI Composer — screenshot address guard', () => {
  test('private, loopback, link-local and odd addresses are refused', async () => {
    ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', '::ffff:10.0.0.1'].forEach((ip) => assert.equal(isPrivateIp(ip), true, ip));
    ['8.8.8.8', '76.76.21.21', '2606:4700::1111'].forEach((ip) => assert.equal(isPrivateIp(ip), false, ip));
    for (const u of ['http://127.0.0.1/', 'http://localhost/', 'https://a.local/', 'http://169.254.169.254/x', 'ftp://example.com/', 'https://example.com:8443/', 'https://u:p@example.com/', 'not a url']) {
      await assert.rejects(() => checkExternalUrl(u), undefined, u);
    }
    assert.throws(() => checkSiteUrl('https://evil.example/x'));
    assert.equal(checkSiteUrl('https://www.leadpages.com.au/abc?preview=1').hostname, 'www.leadpages.com.au');
  });
});
