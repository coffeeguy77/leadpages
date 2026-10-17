'use strict';

/** Publish merges with changes made elsewhere instead of overwriting them. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { lpMergeConfig, same } = require('../assets/lp-config-merge.js');

const clone = (x) => JSON.parse(JSON.stringify(x));
const base = {
  businessName: 'Griffith Butchery',
  sections: { header: { linkPage: 'order' }, mobileBar: { buttons: { directions: { address: '' } } } },
  pages: [
    { id: 'p1', slug: 'order', title: 'Order', pageSections: { orderStorefront: { heading: 'Place your order' } } },
    { id: 'p2', slug: 'turkey', title: 'Turkey', status: 'published' }
  ]
};

test('a page added elsewhere survives an editor edit to another page', () => {
  const mine = clone(base); mine.pages[1].title = 'Turkey farm';
  const theirs = clone(base); theirs.pages.push({ id: 'p3', slug: 'bakery', title: 'Bakery', status: 'draft' });
  const r = lpMergeConfig(base, base, mine, theirs);
  assert.equal(r.conflicts.length, 0);
  assert.deepEqual(r.config.pages.map((p) => p.id), ['p1', 'p2', 'p3']);
  assert.equal(r.config.pages[1].title, 'Turkey farm');
  assert.equal(r.config.pages[2].slug, 'bakery');
});

test('a nested field added elsewhere (info tabs) survives an editor edit in the same page', () => {
  const mine = clone(base); mine.pages[0].pageSections.orderStorefront.heading = 'Order now';
  const theirs = clone(base); theirs.pages[0].pageSections.orderStorefront.infoTabs = [{ label: 'Christmas Store Hours' }];
  const r = lpMergeConfig(base, base, mine, theirs);
  assert.equal(r.conflicts.length, 0);
  assert.equal(r.config.pages[0].pageSections.orderStorefront.heading, 'Order now');
  assert.equal(r.config.pages[0].pageSections.orderStorefront.infoTabs[0].label, 'Christmas Store Hours');
});

test('the same field changed in both places is a conflict; the decision picks the value', () => {
  const mine = clone(base); mine.sections.header.linkPage = 'turkey';
  const theirs = clone(base); theirs.sections.header.linkPage = 'christmas';
  const r = lpMergeConfig(base, base, mine, theirs);
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].key, 'sections/header/linkPage');
  assert.equal(r.config.sections.header.linkPage, 'turkey');
  const r2 = lpMergeConfig(base, base, mine, theirs, { 'sections/header/linkPage': 'theirs' });
  assert.equal(r2.config.sections.header.linkPage, 'christmas');
});

test('nothing changed elsewhere: the editor copy wins untouched (deletes included)', () => {
  const mine = clone(base); mine.pages.pop(); delete mine.businessName;
  const r = lpMergeConfig(base, base, mine, clone(base));
  assert.ok(same(r.config, mine));
  assert.equal(r.changedElsewhere, false);
});

test('a page deleted in the editor stays deleted when it was not touched elsewhere', () => {
  const mine = clone(base); mine.pages.splice(1, 1);
  const theirs = clone(base); theirs.businessName = 'Griffith Butchery Canberra';
  const r = lpMergeConfig(base, base, mine, theirs);
  assert.deepEqual(r.config.pages.map((p) => p.id), ['p1']);
  assert.equal(r.config.businessName, 'Griffith Butchery Canberra');
});

test('editor load-time defaults are not mistaken for edits, and key order is ignored', () => {
  const norm = clone(base); norm.sections.header.btnShape = 'pill';
  const mine = clone(norm); mine.pages[0].title = 'Shop';
  const theirs = JSON.parse(JSON.stringify(base, Object.keys(base).reverse()));
  theirs.pages = clone(base.pages); theirs.pages.push({ id: 'p9', title: 'New' });
  const r = lpMergeConfig(base, norm, mine, theirs);
  assert.equal(r.conflicts.length, 0);
  assert.equal(r.config.pages[0].title, 'Shop');
  assert.equal(r.config.pages.length, 3);
});

test('manage.html checks for outside changes before Publish and writes conditionally', () => {
  const m = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
  assert.match(m, /<script src="\/assets\/lp-config-merge\.js(\?v=[\w-]+)?"><\/script>/);
  assert.match(m, /async function lpSyncPrepare\(cfg, opts\)/);
  assert.match(m, /prep=await lpSyncPrepare\(payload\.config, \{ ask:true \}\);/);
  assert.match(m, /\.eq\('updated_at', prep\.at\)/);
  assert.match(m, /function lpSyncBanner\(/);
});

test('an editor tab on an older LeadPages release reloads before Publish (edits kept as a based draft)', () => {
  const m = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
  assert.match(m, /fetch\('\/manage\.html', \{ method:'HEAD', cache:'no-store' \}\)/);
  assert.match(m, /if\(await lpBuildIsStale\(\)\)\{/);
  assert.match(m, /sessionStorage\.setItem\('lpResumeDraft', String\(currentSiteId\)\)/);
  assert.match(m, /__lpDraftBase:\{ at:_ds\.__liveAt\|\|null, raw:_ds\.__liveRaw \}/);
  assert.match(m, /var dBase=cfg\.__lpDraftBase; delete cfg\.__lpDraftBase;/);
});

test('functions run in Sydney', () => {
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  assert.deepEqual(v.regions, ['syd1']);
});
