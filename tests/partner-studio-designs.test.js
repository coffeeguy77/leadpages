'use strict';

/**
 * Studio family partner designs (Nov 2026): Studio (localwebsiteco), Studio Plus, Presence.
 * Every word is an editable design-text slot, Try colours is on, and the design switcher only
 * shows on ?tpl= preview links.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPartnerLandingHtml } = require('../lib/partner-templates');
const { PARTNER_TEMPLATES, normalizeTemplateKey } = require('../lib/partner-templates/registry');
const { SLOTS, slotDefaults } = require('../lib/partner-templates/studio-family');
const { validateWebsiteProfile, mergeWebsiteProfilePatch } = require('../lib/partner-website/validate');
const { buildLocalWebsiteCoWebsiteProfile } = require('../lib/partner-website/local-website-co-profile');

const IDS = ['localwebsiteco', 'studioplus', 'presence'];

function render(id, wpPatch, opts) {
  const wp = validateWebsiteProfile(Object.assign(buildLocalWebsiteCoWebsiteProfile(), wpPatch || {}));
  wp.identity.agencyName = 'Web Culture';
  const prof = { partner_id: 'p1', showcase_slug: 'webculture', support_email: 'hello@example.com', support_phone: '0400 000 000', showcase_config: { templateKey: id, websiteProfile: wp } };
  const partner = { id: 'p1', display_name: 'Shaun Matthews' };
  return buildPartnerLandingHtml(prof, partner, [], 'leadpages.com.au', Object.assign({}, opts || {}));
}

test('registry lists Culture first plus the three new designs', () => {
  assert.deepEqual(PARTNER_TEMPLATES.map((t) => t.id), ['webculture', 'localwebsiteco', 'studioplus', 'presence']);
  IDS.forEach((id) => assert.equal(normalizeTemplateKey(id), id));
  assert.equal(normalizeTemplateKey('converge'), 'webculture');
});

test('each design renders its own layout with Try colours and no left-over tokens', () => {
  IDS.forEach((id) => {
    const html = render(id);
    assert.match(html, new RegExp('data-pt-template="' + id + '"'));
    assert.match(html, /\/assets\/partner-templates\/studio\.css/);
    assert.match(html, /\/assets\/lp-try-colours\.js/);
    assert.match(html, /window\.SITE_CONFIG=/);
    assert.match(html, /--hivis:/);
    assert.doesNotMatch(html, /\{(firstName|region|brand|state)\}/);
    assert.match(html, /data-pl-lead-form/);
    assert.match(html, /Powered by<\/span> <strong>LeadPages/);
  });
  assert.match(render('localwebsiteco'), /Impossible to ignore\./);
  assert.match(render('studioplus'), /A stronger business\./);
  assert.match(render('presence'), /Big presence\./);
});

test('design text from the profile replaces the defaults', () => {
  const html = render('presence', { designCopy: { presence: { 'hero.title2': 'Huge presence.', 'cta.button': 'Say hello' } } });
  assert.match(html, /Huge presence\./);
  assert.match(html, /Say hello/);
  assert.doesNotMatch(html, /Big presence\./);
});

test('every slot has a key, label, group and a default (images may be pictures)', () => {
  IDS.forEach((id) => {
    const keys = new Set();
    SLOTS[id].forEach((s) => {
      assert.ok(/^[a-z0-9_.-]+$/i.test(s.k), s.k);
      assert.ok(!keys.has(s.k), 'duplicate ' + s.k);
      keys.add(s.k);
      assert.ok(s.label && s.group, s.k);
      assert.ok(['text', 'area', 'image'].includes(s.type), s.k);
    });
    assert.ok(Object.keys(slotDefaults(id)).length === SLOTS[id].length);
  });
});

test('designCopy is kept, cleaned and merged per design', () => {
  const v = validateWebsiteProfile({ designCopy: { presence: { 'hero.title1': 'Hi', 'bad key!': 'x', blank: '   ' }, 'Bad Tpl': { a: 'b' } } });
  assert.deepEqual(v.designCopy, { presence: { 'hero.title1': 'Hi' } });
  const merged = mergeWebsiteProfilePatch({ designCopy: { presence: { a: '1' }, studioplus: { b: '2' } } }, { designCopy: { presence: { c: '3' } } });
  assert.deepEqual(merged.designCopy, { presence: { c: '3' }, studioplus: { b: '2' } });
});

test('design switcher only on ?tpl= previews', () => {
  assert.doesNotMatch(render('studioplus', null, { showTemplateSwitcher: true }), /pt-tpl-bar/);
  assert.match(render('studioplus', null, { templateOverride: 'studioplus', showTemplateSwitcher: true }), /pt-tpl-bar/);
});

test('template registry API sends each design’s editable fields', () => {
  const handler = require('../api/partner/template-registry');
  let body = null;
  const res = { setHeader() {}, status() { return this; }, json(j) { body = j; } };
  handler({ method: 'GET' }, res);
  const plus = body.templates.find((t) => t.id === 'studioplus');
  assert.ok(plus.slots.length > 40);
  assert.equal(body.templates.find((t) => t.id === 'webculture').slots.length, 0);
});
