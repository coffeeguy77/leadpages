'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const G = require('../assets/lp-gallery.js');

const ROOT = path.join(__dirname, '..');

test('normalize never mutates the config it is given', () => {
  const input = { on: true, smartPreset: 'dynamic', images: [{ src: 'https://x.test/a.jpg', tags: 'A, B', featured: 'true' }], categories: [], albums: [] };
  const snap = JSON.stringify(input);
  G.normalize(input);
  assert.equal(JSON.stringify(input), snap);
});

test('no stock photos are injected into a tenant gallery', () => {
  const out = G.normalize({ on: true, images: [] });
  assert.equal(out.images.length, 0);
  const demo = G.normalize({ on: true, images: [] }, { demo: true });
  assert.ok(demo.images.length > 0, 'demo flag still provides samples');
});

test('explicit settings beat the smart preset (old engine overwrote them)', () => {
  const out = G.normalize({ on: true, smartPreset: 'dynamic', layout: 'grid', gap: 30 });
  assert.equal(out.layout, 'grid');
  assert.equal(out.gap, 30);
  const filled = G.normalize({ on: true, smartPreset: 'clean' });
  assert.equal(filled.layout, 'grid');
  assert.equal(filled.ratio, 'square');
  assert.ok(!('_presetApplied' in filled));
});

test('density works again when gap is the untouched legacy 12', () => {
  assert.equal(G.normalize({ density: 'airy', gap: 12 }).gap, 22);
  assert.equal(G.normalize({ density: 'compact', gap: 12 }).gap, 8);
  assert.equal(G.normalize({ density: 'compact', gap: 14 }).gap, 14);
});

test('coerces legacy shapes: string tags, "true" featured, feature size', () => {
  const out = G.normalize({ images: [{ src: '/a.jpg', tags: 'Modern, Outdoor', featured: 'true', size: 'feature' }] });
  const im = out.images[0];
  assert.deepEqual(im.tags, ['Modern', 'Outdoor']);
  assert.equal(im.featured, true);
  assert.equal(im.size, 'large');
});

test('image ids are stable (derived from src, not random)', () => {
  const a = G.normalize({ images: [{ src: 'https://x.test/a.jpg' }] }).images[0].id;
  const b = G.normalize({ images: [{ src: 'https://x.test/a.jpg' }] }).images[0].id;
  assert.equal(a, b);
});

test('heals category/album links broken by the old list editor', () => {
  // The old editor dropped ids; the old renderer regenerated them from names,
  // so "cat-outdoor" images pointed at a category now called "Outdoor Living".
  const out = G.normalize({
    structureMode: 'categories-albums',
    categories: [{ name: 'Outdoor Living' }, { name: 'Kitchens' }],
    albums: [{ title: 'Red Hill Kitchen', categoryId: 'cat-kitchens' }],
    images: [
      { src: '/1.jpg', categoryId: 'cat-outdoor' },
      { src: '/2.jpg', albumId: 'alb-red-hill-kitchen' },
      { src: '/3.jpg', categoryId: 'Kitchens' }
    ]
  });
  const [c1, c2] = out.categories;
  assert.equal(out.images[0].categoryId, c1.id);
  assert.equal(out.images[1].albumId, out.albums[0].id);
  assert.equal(out.images[1].categoryId, c2.id, 'category comes from the album');
  assert.equal(out.images[2].categoryId, c2.id, 'name references resolve');
});

test('filename alt text is replaced with the title', () => {
  const im = G.normalize({ images: [{ src: '/x.jpg', alt: 'IMG_1234.jpg', title: 'Exposed aggregate driveway' }] }).images[0];
  assert.equal(im.alt, 'Exposed aggregate driveway');
});

test('unsafe URLs are dropped', () => {
  const out = G.normalize({ images: [{ src: 'javascript:alert(1)' }, { src: 'https://ok.test/a.jpg' }], coverImage: 'javascript:x' });
  assert.equal(out.images.length, 1);
  assert.equal(out.coverImage, '');
});

test('category filter compares ids (old engine compared names to ids)', () => {
  const cfg = G.normalize({ structureMode: 'filtered', filterSource: 'categories', categories: [{ id: 'c1', name: 'Driveways' }, { id: 'c2', name: 'Paths' }],
    images: [{ src: '/a.jpg', categoryId: 'c1' }, { src: '/b.jpg', categoryId: 'c2' }, { src: '/c.jpg', categoryId: 'c1' }] });
  const vm = G.viewModel(cfg, { view: 'root', filters: ['cat:c1'] });
  assert.equal(vm.chips.length, 2);
  assert.equal(vm.images.length, 2);
});

test('multi-select filters are OR-combined', () => {
  const cfg = G.normalize({ structureMode: 'filtered', filterMultiple: true,
    images: [{ src: '/a.jpg', tags: ['A'] }, { src: '/b.jpg', tags: ['B'] }, { src: '/c.jpg', tags: ['C'] }] });
  assert.equal(G.viewModel(cfg, { view: 'root', filters: ['tag:A', 'tag:B'] }).images.length, 2);
});

test('categories → albums → images view model', () => {
  const cfg = G.normalize({ structureMode: 'categories-albums',
    categories: [{ id: 'k', name: 'Kitchens' }],
    albums: [{ id: 'a1', title: 'Red Hill', categoryId: 'k' }],
    images: [{ src: '/1.jpg', albumId: 'a1' }, { src: '/2.jpg', categoryId: 'k' }, { src: '/3.jpg' }] });
  const root = G.viewModel(cfg, { view: 'root', filters: [] });
  assert.equal(root.kind, 'cards');
  assert.equal(root.cards[0].count, 2);
  assert.equal(root.cards[root.cards.length - 1].id, '__other', 'uncategorised photos still reachable');
  const cat = G.viewModel(cfg, { view: 'category', categoryId: 'k', filters: [] });
  assert.equal(cat.kind, 'cards');
  assert.equal(cat.loose.length, 1, 'photos in a category but no album are shown');
  const alb = G.viewModel(cfg, { view: 'album', categoryId: 'k', albumId: 'a1', filters: [] });
  assert.equal(alb.images.length, 1);
  assert.equal(alb.crumbs.length, 3);
});

test('justified rows fill the width and never stretch the last row', () => {
  const rows = G.justify([1.5, 1.5, 0.75, 1.33, 2, 1, 1.5], 1000, 250, 10);
  rows.forEach((r) => {
    if (!r.full) { assert.ok(r.height <= 250); return; }
    // width check
  });
  const full = rows.filter((r) => r.full);
  assert.ok(full.length >= 1);
  const ratios = [1.5, 1.5, 0.75, 1.33, 2, 1, 1.5];
  full.forEach((r) => {
    let w = 0; for (let k = 0; k < r.count; k++) w += ratios[r.start + k] * r.height;
    w += 10 * (r.count - 1);
    assert.ok(Math.abs(w - 1000) < 1 || r.height === 250 * 1.6, 'row width ' + w);
  });
});

test('Cloudinary URLs get responsive transforms after existing ones', () => {
  const u = 'https://res.cloudinary.com/dzx6x1hou/image/upload/v1782899714/leadpages/abc/photo.jpg';
  assert.equal(G.cdn(u, 800), 'https://res.cloudinary.com/dzx6x1hou/image/upload/f_auto,q_auto,c_limit,w_800/v1782899714/leadpages/abc/photo.jpg');
  const t = 'https://res.cloudinary.com/dzx6x1hou/image/upload/c_crop,x_470,w_730,h_457/v1/leadpages/b.jpg';
  assert.equal(G.cdn(t, 640), 'https://res.cloudinary.com/dzx6x1hou/image/upload/c_crop,x_470,w_730,h_457/f_auto,q_auto,c_limit,w_640/v1/leadpages/b.jpg');
  const folder = 'https://res.cloudinary.com/d/image/upload/my_folder/photo.jpg';
  assert.equal(G.cdn(folder, 400), 'https://res.cloudinary.com/d/image/upload/f_auto,q_auto,c_limit,w_400/my_folder/photo.jpg', 'folder names are not mistaken for transforms');
  assert.equal(G.cdn('https://example.com/a.jpg', 800), 'https://example.com/a.jpg');
  assert.equal(G.srcset('https://example.com/a.jpg'), '');
  assert.ok(G.srcset(u).split(',').length >= 6);
});

test('mosaic sizes honour locked layout, then explicit size, then shape', () => {
  const cfg = G.normalize({ mosaicLocked: true, mosaicLayout: [{ id: 'img-0', size: 'wide' }], images: [{ src: '/a.jpg' }, { src: '/b.jpg', size: 'tall' }, { src: '/c.jpg', ratio: 2.4 }] });
  assert.equal(G.sizeFor(cfg.images[0], 'smart-mosaic', 7, 0, cfg._mosaicMap), 'wide', 'legacy img-<index> keys map by position');
  assert.equal(G.sizeFor(cfg.images[1], 'smart-mosaic', 7, 1, cfg._mosaicMap), 'tall');
  assert.equal(G.sizeFor(cfg.images[2], 'smart-mosaic', 7, 2, cfg._mosaicMap), 'full');
});

test('escaping covers quotes (old esc() did not)', () => {
  assert.equal(G.esc('a"b\'c<d>'), 'a&quot;b&#39;c&lt;d&gt;');
});

test('every legacy renderer copy routes through the engine shim', () => {
  const shim = '/*LPG-SHIM*/';
  const demo = fs.readFileSync(path.join(ROOT, 'marketplace/demos/demo-shared.js'), 'utf8');
  assert.ok(demo.includes(shim) && demo.includes('_pgRenderPremiumGallery(PG, pgNode, C)'));
  for (const f of ['trade.template.json', 'landing-shell-neutral-v1.template.json']) {
    const html = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')).html;
    assert.ok(html.includes(shim), f + ' has the shim');
    assert.ok(html.includes('if(_pgUseEngine(PG, node, arguments[2])) return;'), f + ' delegates');
  }
});

test('engine CSS covers every layout and the lightbox', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets/lp-gallery.css'), 'utf8');
  ['.lpg-grid', '.lpg-mosaic', '.lpg-masonry', '.lpg-justified', '.lpg-stacked', '.lpg-collage', '.lpg-film', '.lpg-show', '.lpg-cards', '.lpg-lb', 'prefers-reduced-motion'].forEach((s) => assert.ok(css.includes(s), s));
});
