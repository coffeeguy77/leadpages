const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  publicFirstName,
  publicPartnerIntro,
  publicPartnerLabel,
  publicPhotoAlt,
  placeholderInitial,
  publicPartnerBio
} = require('../../lib/partner-website/public-identity');

test('publicPartnerIntro — agency first with first-name contact line', function() {
  const intro = publicPartnerIntro('Web Culture', 'Shaun Matthews', { displaySurnamePublicly: false });
  assert.equal(intro.agencyHeading, 'Web Culture');
  assert.equal(intro.contactLine, 'Work directly with Shaun');
});

test('publicPartnerIntro — no agency falls back to contact-only heading', function() {
  const intro = publicPartnerIntro('', 'Shaun Matthews', { displaySurnamePublicly: false });
  assert.equal(intro.agencyHeading, 'Work directly with Shaun');
  assert.equal(intro.contactLine, null);
});

test('publicPartnerIntro — no names uses partner fallback', function() {
  const intro = publicPartnerIntro('', '', { displaySurnamePublicly: false });
  assert.equal(intro.agencyHeading, 'Work directly with your local LeadPages Partner');
});

test('publicPartnerLabel — never returns surname by default', function() {
  assert.equal(publicPartnerLabel('Shaun Matthews', 'Web Culture', { displaySurnamePublicly: false }), 'Shaun');
  assert.equal(publicPhotoAlt('Shaun Matthews', 'Web Culture', { displaySurnamePublicly: false }), 'Shaun');
  assert.equal(placeholderInitial('Web Culture', 'Shaun Matthews', { displaySurnamePublicly: false }), 'W');
});

test('publicPartnerBio — strips duplicate work-directly opener when contact line is shown', function() {
  const intro = publicPartnerIntro('Web Culture', 'Shaun Matthews', { displaySurnamePublicly: false });
  const bio = publicPartnerBio(
    'Work directly with Shaun Matthews, your local website partner in Mitchell. Get a professionally built website.',
    intro,
    { agencyName: 'Web Culture', displayName: 'Shaun Matthews' }
  );
  assert.equal(intro.contactLine, 'Work directly with Shaun');
  assert.ok(!bio.toLowerCase().startsWith('work directly with'));
  assert.match(bio, /your local website partner/i);
});
