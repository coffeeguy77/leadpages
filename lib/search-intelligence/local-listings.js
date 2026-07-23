'use strict';

/**
 * Local listings / NAP consistency audit from first-party site config.
 * Phase 3 foundation — no GBP API required.
 */

function normPhone(p) {
  return String(p || '').replace(/\D+/g, '');
}

function auditListings(site) {
  const cfg = (site && site.config) || {};
  const findings = [];
  const name = (site && site.business_name) || cfg.business || cfg.name || '';
  const phone = cfg.phone || cfg.phoneText || '';
  const email = cfg.email || '';
  const region = cfg.region || '';
  const areas =
    (cfg.sections &&
      cfg.sections.serviceAreas &&
      Array.isArray(cfg.sections.serviceAreas.areas) &&
      cfg.sections.serviceAreas.areas) ||
    [];

  if (!name || String(name).trim().length < 2) {
    findings.push({
      code: 'listings_missing_name',
      recipeId: 'listings_nap_gap',
      title: 'Business name missing for local listings',
      severity: 'high',
      plainLanguage: 'Local listings and Maps need a clear business name matching your site.',
      status: 'open',
      actions: ['open_editor_seo', 'create_task']
    });
  }
  if (!normPhone(phone) || normPhone(phone).length < 8) {
    findings.push({
      code: 'listings_missing_phone',
      recipeId: 'listings_nap_gap',
      title: 'Phone number missing or incomplete',
      severity: 'high',
      plainLanguage: 'Call-clicks and Google Business listings need a consistent local phone number.',
      status: 'open',
      actions: ['open_editor_seo', 'create_task']
    });
  }
  if (!region && !areas.length) {
    findings.push({
      code: 'listings_missing_area',
      recipeId: 'location_service_gap',
      title: 'No service area or region set',
      severity: 'medium',
      plainLanguage: 'Add the suburbs or region you serve so local pages and Maps targeting stay consistent.',
      status: 'open',
      actions: ['open_editor_seo', 'create_task']
    });
  }
  if (cfg.phone && cfg.phoneText && normPhone(cfg.phone) !== normPhone(cfg.phoneText)) {
    findings.push({
      code: 'listings_phone_mismatch',
      recipeId: 'listings_nap_gap',
      title: 'Phone fields do not match',
      severity: 'medium',
      plainLanguage: 'Display phone and dial phone differ — align them for NAP consistency.',
      status: 'open',
      actions: ['open_editor_seo', 'create_task']
    });
  }

  const score =
    findings.length === 0 ? 0.85 : findings.some(function (f) { return f.severity === 'high'; }) ? 0.35 : 0.55;

  return {
    ok: true,
    available: true,
    labelClass: 'modelled',
    nap: {
      name: name || null,
      phone: phone || null,
      email: email || null,
      region: region || null,
      areaCount: areas.length
    },
    listingsScore: score,
    findings: findings,
    gbpStatus: 'not_connected',
    note: 'GBP OAuth scaffold is available at /settings/integrations/google-business. This audit uses first-party site facts only until live sync is enabled.'
  };
}

module.exports = {
  auditListings: auditListings,
  normPhone: normPhone
};
