'use strict';

/** Industry partner pages (Nov 2026): ten designs, live example experiences, ?industry= pages. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPartnerLandingHtml } = require('../lib/partner-templates');
const { NICHE_IDS } = require('../lib/partner-templates/niche-family');
const { PARTNER_TEMPLATES, normalizeTemplateKey } = require('../lib/partner-templates/registry');
const { SLOTS } = require('../lib/partner-templates/studio-family');
const { validateWebsiteProfile } = require('../lib/partner-website/validate');
const { buildLocalWebsiteCoWebsiteProfile } = require('../lib/partner-website/local-website-co-profile');
const { libraryCard } = require('../lib/partner-website/showcase-library');

function page(id, opts) {
  const wp = validateWebsiteProfile(buildLocalWebsiteCoWebsiteProfile());
  const prof = { partner_id: 'p1', showcase_slug: 'x', support_email: 'a@b.c', showcase_config: { templateKey: 'webculture', websiteProfile: wp } };
  return buildPartnerLandingHtml(prof, { id: 'p1', display_name: 'Pat Partner' }, [], 'leadpages.com.au', Object.assign({ templateOverride: id, showTemplateSwitcher: false }, opts || {}));
}

test('ten industry designs are registered and selectable', () => {
  assert.equal(NICHE_IDS.length, 10);
  NICHE_IDS.forEach(function(id) {
    assert.equal(normalizeTemplateKey(id), id);
    const t = PARTNER_TEMPLATES.find(function(x) { return x.id === id; });
    assert.ok(t && t.industry && t.thumb, id);
    assert.ok(SLOTS[id].length > 30, id);
  });
});

test('each industry page renders its layout, example experience and enquiry form', () => {
  NICHE_IDS.forEach(function(id) {
    const html = page(id);
    assert.match(html, new RegExp('data-pt-template="' + id + '"'), id);
    assert.match(html, /niche\.css/, id);
    assert.match(html, /niche\.js/, id);
    assert.match(html, /data-nz-send/, id);
    assert.match(html, /data-nz-q=/, id);
    assert.match(html, /name="mainGoal"/, id);
    assert.match(html, /data-pl-lead-form/, id);
    assert.match(html, /id="st-contact"/, id);
    assert.doesNotMatch(html, /\{(firstName|region|brand|state)\}/, id);
    assert.doesNotMatch(html, /[-]/, id);
    assert.doesNotMatch(html, /pt-tpl-bar/, id);
  });
});

test('Show more lists real LeadPages sites in that industry only', () => {
  const lib = [
    libraryCard({ id: '00000001-0000-4000-8000-000000000000', slug: 'pam-connor', business_name: 'Pam Connor', trade: 'Psychology' }, 'leadpages.com.au'),
    libraryCard({ id: '00000002-0000-4000-8000-000000000000', slug: 'griffith', business_name: 'Griffith Butchery', trade: 'Butcher' }, 'leadpages.com.au')
  ];
  const allied = page('allied-health', { library: lib });
  assert.match(allied, /data-nz-more/);
  assert.match(allied, /Pam Connor/);
  assert.doesNotMatch(allied, /Griffith Butchery/);
  assert.doesNotMatch(page('automotive', { library: lib }), /data-nz-more/);
});

test('industry pages are editable on the page', () => {
  const html = page('fitness', { editMode: true, industryPage: true });
  assert.match(html, /data-lpe="hero\.title"/);
  assert.match(html, /"industryPage":true/);
});
