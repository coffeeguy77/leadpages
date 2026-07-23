'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const themeDemos = require('../lib/theme-demos');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const demosHtml = fs.readFileSync(path.join(root, 'demos.html'), 'utf8');
const demoThemeHtml = fs.readFileSync(path.join(root, 'demo-theme.html'), 'utf8');
const home = fs.readFileSync(path.join(root, 'home.html'), 'utf8');
const vercel = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
const apiPos = fs.readFileSync(path.join(root, 'api/api-positioning-layouts.js'), 'utf8');
const publicApi = fs.readFileSync(path.join(root, 'api/public-demos.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'db/theme_demos_expansion.sql'), 'utf8');

describe('Themes expansion — Demos library + Update', () => {
  it('scrubs client identity and regenerates generic demo pack copy', () => {
    const layout = {
      name: 'Trade trust theme',
      slug: 'trade-trust',
      industry_tags: ['plumbing'],
      apps: [{ section_key: 'hero', enabled: true }, { section_key: 'services', enabled: true }],
      demo_packs: {
        hero: { heading: "Duncan's Plumbing", phone: '0412 345 678', email: 'bob@duncans.com.au' },
        services: { heading: 'Our services', intro: 'Call Bob on 0412 345 678' }
      }
    };
    const scrubbed = themeDemos.scrubDemoPacks(layout.demo_packs, layout);
    assert.equal(scrubbed.hero.phone, undefined);
    assert.equal(scrubbed.hero.email, undefined);
    const regen = themeDemos.regenPackCopy(layout.demo_packs, layout);
    assert.match(regen.hero.heading, /Harbour Plumbing|Demo/i);
    assert.doesNotMatch(JSON.stringify(regen), /duncan|0412 345 678|bob@duncans/i);
    const brand = themeDemos.demoBrandFor(layout);
    assert.equal(brand, 'Harbour Plumbing Co');
    const card = themeDemos.publicDemoCard(Object.assign({}, layout, { id: 'x', features: [], benefits: [] }));
    assert.ok(card.features.length);
    assert.ok(card.benefits.length);
    assert.ok(card.apps.length >= 2);
  });

  it('wires public /demos routes and nav', () => {
    assert.match(home, /href="\/demos">Demos</);
    assert.match(demosHtml, /\/api\/public-demos/);
    assert.match(demoThemeHtml, /Open live demo/);
    assert.match(demoThemeHtml, /Marketplace apps/);
    assert.match(vercel, /"\/demos"/);
    assert.match(vercel, /demo-theme\.html/);
    assert.match(vercel, /demos,demo-theme/);
    assert.match(publicApi, /visibility', 'public'/);
  });

  it('adds Update demo + publish_demo + Web Demo sync in Themes admin', () => {
    assert.match(sql, /demo_site_id/);
    assert.match(apiPos, /action === 'update_demo'/);
    assert.match(apiPos, /action === 'publish_demo'/);
    assert.match(apiPos, /syncLiveDemoSite/);
    assert.match(apiPos, /aiRegenDemoPacks/);
    assert.match(manage, /_ptUpdateDemo/);
    assert.match(manage, /_ptPublishDemo/);
    assert.match(manage, /Publish to Demos/);
    assert.match(manage, /Update demo/);
    assert.match(manage, /Create \/ sync Web Demo/);
    assert.match(manage, /pt-visibility/);
  });
});
