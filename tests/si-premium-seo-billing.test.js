'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  SECTION_KEY,
  APP_SLUG,
  PREMIUM_COMPETITION_ACTIONS,
  FREE_COMPETITION_ACTIONS,
  isPremiumCompetitionAction,
  isFreeCompetitionAction,
  assertPremiumSeoEntitled,
  subscriptionIsActive
} = require('../lib/search-intelligence/billing');

assert.equal(SECTION_KEY, 'premiumSeo');
assert.equal(APP_SLUG, 'premium-seo');
assert.ok(PREMIUM_COMPETITION_ACTIONS.indexOf('discover_competitors') >= 0);
assert.ok(PREMIUM_COMPETITION_ACTIONS.indexOf('discover_from_serp') >= 0);
assert.ok(PREMIUM_COMPETITION_ACTIONS.indexOf('serp_competitors') >= 0);
assert.ok(PREMIUM_COMPETITION_ACTIONS.indexOf('lookup_keyword') >= 0);
assert.ok(PREMIUM_COMPETITION_ACTIONS.indexOf('competitor_keywords') >= 0);
assert.ok(PREMIUM_COMPETITION_ACTIONS.indexOf('keyword_gap') >= 0);
assert.ok(PREMIUM_COMPETITION_ACTIONS.indexOf('domain_intersection') >= 0);
assert.ok(FREE_COMPETITION_ACTIONS.indexOf('save_competitors') >= 0);
assert.ok(isPremiumCompetitionAction('paid_research'));
assert.ok(isPremiumCompetitionAction('serp_competitors'));
assert.ok(isPremiumCompetitionAction('domain_intersection'));
assert.ok(isFreeCompetitionAction('clear_competitors'));
assert.ok(!isPremiumCompetitionAction('save_competitors'));

assert.equal(subscriptionIsActive({ status: 'active' }), true);
assert.equal(subscriptionIsActive({ status: 'trialing' }), true);
assert.equal(subscriptionIsActive({ status: 'cancelled' }), false);
assert.equal(
  subscriptionIsActive({
    status: 'cancelled',
    access_until: new Date(Date.now() + 86400000).toISOString()
  }),
  true
);

async function run() {
  const prevUnlock = process.env.SI_PREMIUM_SEO_UNLOCK;
  delete process.env.SI_PREMIUM_SEO_UNLOCK;

  const locked = await assertPremiumSeoEntitled('00000000-0000-0000-0000-000000000001', {
    role: 'owner'
  });
  assert.equal(locked.ok, false);
  assert.equal(locked.error, 'subscription_required');
  assert.equal(locked.product, 'premium-seo');
  assert.ok(locked.app);
  assert.equal(locked.app.priceMonthlyAud, 49);

  const superOk = await assertPremiumSeoEntitled('00000000-0000-0000-0000-000000000001', {
    role: 'super'
  });
  assert.equal(superOk.ok, true);
  assert.equal(superOk.exempt, true);

  process.env.SI_PREMIUM_SEO_UNLOCK = '1';
  const envOk = await assertPremiumSeoEntitled('00000000-0000-0000-0000-000000000001', {
    role: 'owner'
  });
  assert.equal(envOk.ok, true);
  assert.equal(envOk.exempt, true);

  if (prevUnlock == null) delete process.env.SI_PREMIUM_SEO_UNLOCK;
  else process.env.SI_PREMIUM_SEO_UNLOCK = prevUnlock;

  const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
  assert.ok(manage.indexOf('si-premium-box') >= 0);
  assert.ok(manage.indexOf('si-free-box') >= 0);
  assert.ok(manage.indexOf('si-comp-buy') >= 0);
  assert.ok(manage.indexOf('Get Premium SEO') >= 0);
  assert.ok(manage.indexOf('Included · free') >= 0);

  const api = fs.readFileSync(
    path.join(__dirname, '..', 'api/search-intelligence/competition.js'),
    'utf8'
  );
  assert.ok(api.indexOf('assertPremiumSeoEntitled') >= 0);
  assert.ok(api.indexOf('subscription_required') >= 0);
  assert.ok(api.indexOf('402') >= 0);

  assert.ok(fs.existsSync(path.join(__dirname, '..', 'scripts/register-premium-seo-app.js')));
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/search-intelligence/billing.js')));

  console.log('si-premium-seo-billing.test.js: ok');
}

run().catch(function (e) {
  console.error(e);
  process.exit(1);
});
