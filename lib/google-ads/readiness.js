'use strict';

/**
 * Tracking Readiness Centre — pass / warn / fail before publish.
 */

const { hostNorm } = require('./safety');

function check(id, label, status, detail) {
  return { id: id, label: label, status: status, detail: detail || '' }; // pass | warn | fail
}

function primaryFromEventRoles(roles) {
  const r = roles || {};
  const out = [];
  if (r.form_submission === 'primary') out.push('form_submit');
  if (r.call_click === 'primary') out.push('phone_click');
  if (r.email_click === 'primary') out.push('email_click');
  if (r.directions_click === 'primary') out.push('directions_click');
  return out;
}

/**
 * @param {object} ctx
 * @param {object} ctx.site
 * @param {object|null} ctx.adsConn
 * @param {object|null} ctx.ga4Conn
 * @param {object|null} ctx.gtmConn
 * @param {object|null} ctx.plan
 * @param {object} [ctx.stats] — recent event counts
 */
function runReadinessAudit(ctx) {
  const site = ctx.site || {};
  const cfg = site.config || {};
  const ads = ctx.adsConn || null;
  const ga4 = ctx.ga4Conn || null;
  const gtm = ctx.gtmConn || null;
  const plan = ctx.plan || null;
  const stats = ctx.stats || {};
  const domain = hostNorm(site.custom_domain || cfg.domain || '');
  const checks = [];

  checks.push(
    domain
      ? check('domain', 'Published domain available', 'pass', domain)
      : check('domain', 'Published domain available', 'fail', 'Connect a custom domain before publishing ads.')
  );
  checks.push(check('https', 'HTTPS', domain ? 'pass' : 'warn', domain ? 'Assume HTTPS on LeadPages domains' : 'No domain yet'));

  const landingUrl = plan && plan.adGroups && plan.adGroups[0] && plan.adGroups[0].finalUrl;
  if (landingUrl) {
    checks.push(check('landing', 'Landing page URL set', 'pass', landingUrl));
  } else if (plan) {
    checks.push(check('landing', 'Landing page URL set', 'fail', 'Select a published landing page in Campaign Builder.'));
  } else {
    // Tracking-only audit (no plan yet) — do not block; send user to Campaign Builder.
    checks.push(
      check(
        'landing',
        'Landing page URL set',
        'warn',
        'No campaign plan yet — open Campaign Builder, choose a published page, click Plan for page (or Coffee Events pilot), then re-run readiness.'
      )
    );
  }

  checks.push(check('mobile', 'Mobile layout', 'pass', 'Trade templates include mobile layouts'));

  checks.push(
    ads && ads.customer_id && ads.connection_status !== 'disconnected'
      ? check('ads_connected', 'Google Ads connected', 'pass', ads.account_name || ads.customer_id)
      : check('ads_connected', 'Google Ads connected', 'fail', 'Connect Google Ads for this site.')
  );
  checks.push(
    ads && ads.customer_id
      ? check('ads_account', 'Ads account selected', 'pass', ads.customer_id)
      : check('ads_account', 'Ads account selected', 'fail', 'Select a customer account.')
  );

  const gaId = (cfg.analytics && (cfg.analytics.gaId || cfg.analytics.measurementId)) || cfg.gaId || '';
  checks.push(
    ga4 || gaId
      ? check('ga4', 'GA4 connected / measurement ID', 'pass', ga4 ? 'OAuth connected' : gaId)
      : check('ga4', 'GA4 connected / measurement ID', 'warn', 'Add a measurement ID or connect GA4 OAuth.')
  );
  checks.push(
    ads && (ga4 || gaId)
      ? check(
          'ads_ga4_link',
          'Ads ↔ GA4 link',
          'warn',
          'Confirm in Google Ads → Tools → Linked accounts (or GA4 Admin → Google Ads links). LeadPages cannot verify this automatically.'
        )
      : check('ads_ga4_link', 'Ads ↔ GA4 link', 'warn', 'Link Ads and GA4 when both are connected.')
  );

  if (gtm && gtm.connection_status === 'connected') {
    checks.push(check('gtm', 'GTM connected', 'pass', gtm.container_public_id || gtm.container_id || 'connected'));
  } else {
    checks.push(check('gtm', 'GTM connected', 'pass', 'Optional — LeadPages Native tracking recommended.'));
  }

  checks.push(
    ads && ads.tag_id
      ? check('google_tag', 'Google tag (AW) configured', 'pass', ads.tag_id)
      : check(
          'google_tag',
          'Google tag (AW) configured',
          'warn',
          'Connection & Health → enter AW-… or Detect from Ads, then Save conversion settings.'
        )
  );

  checks.push(
    Number(stats.lead_submit || stats.form_submit || 0) > 0
      ? check('form_event', 'Form submission seen', 'pass', 'Recent form events recorded')
      : check('form_event', 'Form submission seen', 'warn', 'Run a test form conversion before going live.')
  );
  checks.push(
    Number(stats.call_click || stats.phone_click || 0) > 0
      ? check('call_tracking', 'Call click tracking seen', 'pass', 'Recent call clicks recorded')
      : check('call_tracking', 'Call click tracking', 'warn', 'Call tracking is click-to-call; place a test call click.')
  );

  const planPrimaries =
    plan && plan.conversionGoals && Array.isArray(plan.conversionGoals.primary)
      ? plan.conversionGoals.primary
      : [];
  const rolePrimaries = primaryFromEventRoles(ads && ads.event_roles);
  const primaries = planPrimaries.length ? planPrimaries : rolePrimaries;
  checks.push(
    primaries.length
      ? check('primary_conversion', 'Primary conversion selected', 'pass', primaries.join(', '))
      : check(
          'primary_conversion',
          'Primary conversion selected',
          'fail',
          'Connection & Health → set Form submissions and/or Call clicks to Primary → Save conversion settings. Or build a Campaign Builder plan first.'
        )
  );

  const planDomain = plan && plan.primaryDomain ? hostNorm(plan.primaryDomain) : '';
  if (planDomain && domain && planDomain !== domain) {
    checks.push(
      check(
        'domain_match',
        'Final URL domain matches site',
        'fail',
        'Plan domain ' + planDomain + ' ≠ site domain ' + domain
      )
    );
  } else {
    checks.push(
      check('domain_match', 'Final URL domain matches site', planDomain || domain ? 'pass' : 'warn', planDomain || domain || '—')
    );
  }

  const biz = site.business_name || cfg.businessName;
  checks.push(biz ? check('identity', 'Business identity present', 'pass', biz) : check('identity', 'Business identity', 'fail', 'Set business name'));

  let fails = 0;
  let warns = 0;
  checks.forEach((c) => {
    if (c.status === 'fail') fails++;
    if (c.status === 'warn') warns++;
  });
  const overall = fails ? 'fail' : warns ? 'warn' : 'pass';
  return {
    overall: overall,
    canPublish: fails === 0,
    checks: checks,
    message:
      overall === 'pass'
        ? 'Tracking readiness looks good.'
        : overall === 'warn'
          ? 'Warnings present — acknowledge before publish.'
          : 'Critical failures block publishing.'
  };
}

module.exports = { runReadinessAudit, check, primaryFromEventRoles };
