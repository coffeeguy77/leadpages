'use strict';

/**
 * Premium SEO — marketplace subscription entitlement.
 * Locks DataForSEO-backed Competition Analysis (and related paid SI) behind
 * the paid app slug `premium-seo` / section_key `premiumSeo`.
 */

const { createClient } = require('@supabase/supabase-js');

const SECTION_KEY = 'premiumSeo';
const APP_SLUG = 'premium-seo';
const APP_NAME = 'Premium SEO';

/** Actions that spend live market data and require Premium SEO. */
const PREMIUM_COMPETITION_ACTIONS = Object.freeze([
  'discover_competitors',
  'discover_from_serp',
  'keyword_gap',
  'backlink_strategy',
  'paid_research'
]);

/** Free for every site — no subscription. */
const FREE_COMPETITION_ACTIONS = Object.freeze([
  'save_competitors',
  'clear_competitors',
  'purge_fixtures'
]);

let cachedApp = null;
let cachedAppAt = 0;
const APP_CACHE_MS = 60 * 1000;

function adminClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function subscriptionIsActive(sub) {
  if (!sub) return false;
  const now = new Date();
  if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') return true;
  if (sub.status === 'cancelled' && sub.access_until && new Date(sub.access_until) > now) return true;
  return false;
}

async function getPremiumSeoApp() {
  const now = Date.now();
  if (cachedApp && now - cachedAppAt < APP_CACHE_MS) return cachedApp;
  const admin = adminClient();
  if (!admin) {
    cachedApp = null;
    cachedAppAt = now;
    return null;
  }
  const { data } = await admin
    .from('app_registry')
    .select(
      'id,slug,name,tier,price_monthly_aud,price_annual_aud,section_key,tagline,description,marketplace_status'
    )
    .eq('section_key', SECTION_KEY)
    .maybeSingle();
  cachedApp = data || null;
  cachedAppAt = now;
  return cachedApp;
}

async function getPremiumSeoAppId() {
  const app = await getPremiumSeoApp();
  return app && app.id ? app.id : null;
}

async function hasActivePremiumSeoSubscription(siteId) {
  const appId = await getPremiumSeoAppId();
  if (!appId || !siteId) return false;
  const admin = adminClient();
  if (!admin) return false;
  const { data: sub } = await admin
    .from('site_app_subscriptions')
    .select('status, access_until')
    .eq('site_id', siteId)
    .eq('app_id', appId)
    .maybeSingle();
  return subscriptionIsActive(sub);
}

/**
 * Ops unlock without Stripe (staging / before product prices exist).
 * Set SI_PREMIUM_SEO_UNLOCK=1 only on trusted environments.
 */
function isEnvUnlocked() {
  return String(process.env.SI_PREMIUM_SEO_UNLOCK || '') === '1';
}

/**
 * @param {string} siteId
 * @param {{ role?: string, unlock?: boolean }} [opts]
 */
async function assertPremiumSeoEntitled(siteId, opts) {
  const o = opts || {};
  if (!siteId) return { ok: false, error: 'no_site' };
  if (o.unlock === true || isEnvUnlocked()) {
    return { ok: true, exempt: true, reason: 'env_unlock' };
  }
  // Platform supers may use Premium SEO for support / demos without a sub.
  if (o.role === 'super') {
    return { ok: true, exempt: true, reason: 'super' };
  }
  if (await hasActivePremiumSeoSubscription(siteId)) {
    return { ok: true };
  }
  const app = await getPremiumSeoApp();
  return {
    ok: false,
    error: 'subscription_required',
    product: APP_SLUG,
    message:
      'Premium SEO unlocks live competitor discovery, keyword gap, backlinks, and paid ads research. Add the Premium SEO app to this site to continue.',
    app: app
      ? {
          id: app.id,
          slug: app.slug,
          name: app.name,
          sectionKey: app.section_key,
          priceMonthlyAud: app.price_monthly_aud,
          priceAnnualAud: app.price_annual_aud,
          tagline: app.tagline
        }
      : {
          slug: APP_SLUG,
          name: APP_NAME,
          sectionKey: SECTION_KEY,
          priceMonthlyAud: 49,
          priceAnnualAud: 490
        }
  };
}

function isPremiumCompetitionAction(action) {
  return PREMIUM_COMPETITION_ACTIONS.indexOf(String(action || '')) >= 0;
}

function isFreeCompetitionAction(action) {
  return FREE_COMPETITION_ACTIONS.indexOf(String(action || '')) >= 0;
}

/**
 * Snapshot fields for Competition tab UI.
 */
async function premiumSeoEntitlementSnapshot(siteId, opts) {
  const entitled = await assertPremiumSeoEntitled(siteId, opts);
  const app = (entitled.app) || (await getPremiumSeoApp());
  const priceMonthly = (app && (app.priceMonthlyAud != null ? app.priceMonthlyAud : app.price_monthly_aud)) || 49;
  const priceAnnual = (app && (app.priceAnnualAud != null ? app.priceAnnualAud : app.price_annual_aud)) || 490;
  return {
    premiumSeo: {
      entitled: !!entitled.ok,
      exempt: !!entitled.exempt,
      error: entitled.ok ? null : entitled.error,
      appId: (app && app.id) || null,
      slug: APP_SLUG,
      name: APP_NAME,
      sectionKey: SECTION_KEY,
      priceMonthlyAud: priceMonthly,
      priceAnnualAud: priceAnnual,
      tagline:
        (app && (app.tagline || app.description)) ||
        'Live competitor research via DataForSEO — discovery, keyword gap, backlinks, and paid ads.',
      ctaLabel: 'Get Premium SEO',
      lockedMessage:
        'Live rival discovery and market research are part of Premium SEO. Your free tools below still work — save competitor domains manually anytime.'
    }
  };
}

module.exports = {
  SECTION_KEY,
  APP_SLUG,
  APP_NAME,
  PREMIUM_COMPETITION_ACTIONS,
  FREE_COMPETITION_ACTIONS,
  subscriptionIsActive,
  getPremiumSeoApp,
  getPremiumSeoAppId,
  hasActivePremiumSeoSubscription,
  assertPremiumSeoEntitled,
  isPremiumCompetitionAction,
  isFreeCompetitionAction,
  premiumSeoEntitlementSnapshot,
  isEnvUnlocked
};
