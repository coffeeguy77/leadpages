'use strict';

/**
 * Domain + ownership safety for Smart Campaign Builder.
 * Never mix final-URL hosts in one ad group; protect external campaigns.
 */

function hostNorm(input) {
  let s = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
  s = s.split('/')[0].split('?')[0].split('#')[0];
  return s;
}

function sameRegistrableHost(a, b) {
  const ha = hostNorm(a);
  const hb = hostNorm(b);
  if (!ha || !hb) return false;
  return ha === hb;
}

/**
 * Reject ad-group final URLs that span multiple domains.
 * @param {string[]} urls
 * @returns {{ ok: boolean, domain?: string, error?: string, hosts?: string[] }}
 */
function assertSingleFinalUrlDomain(urls) {
  const list = Array.isArray(urls) ? urls : [];
  const hosts = [];
  list.forEach((u) => {
    const h = hostNorm(u);
    if (h && hosts.indexOf(h) < 0) hosts.push(h);
  });
  if (!hosts.length) return { ok: false, error: 'final_url_required', hosts };
  if (hosts.length > 1) {
    return {
      ok: false,
      error: 'mixed_final_url_domains',
      hosts,
      message:
        'Every ad group must use one final URL domain. Do not mix ' +
        hosts.join(' and ') +
        ' in the same ad group.'
    };
  }
  return { ok: true, domain: hosts[0], hosts };
}

/**
 * Bean Culture / external campaign protection.
 * @param {{ ownership?: string, site_id?: string, primary_domain?: string }} map
 * @param {{ siteId: string, confirmExternal?: boolean }} opts
 */
function assertCampaignMutable(map, opts) {
  const o = opts || {};
  if (!map) return { ok: false, error: 'campaign_map_missing' };
  if (String(map.site_id) !== String(o.siteId)) {
    return {
      ok: false,
      error: 'wrong_site',
      message: 'This campaign is mapped to a different LeadPages site.'
    };
  }
  const ownership = String(map.ownership || 'imported');
  if (ownership === 'imported' || ownership === 'externally_modified') {
    if (!o.confirmExternal) {
      return {
        ok: false,
        error: 'external_campaign_confirm_required',
        ownership,
        message:
          'This campaign was not created by LeadPages (or was changed in Google Ads). Confirm explicitly before modifying it.'
      };
    }
  }
  return { ok: true, ownership };
}

function microsToCurrency(micros, currencyCode) {
  const n = Number(micros || 0) / 1e6;
  return {
    amount: Math.round(n * 100) / 100,
    currencyCode: currencyCode || null,
    micros: Number(micros || 0)
  };
}

function dailyToImpliedMonthly(dailyAmount) {
  const d = Number(dailyAmount || 0);
  return {
    avgDays30: Math.round(d * 30 * 100) / 100,
    googleAvgMonthlyMax: Math.round(d * 30.4 * 100) / 100,
    note: 'Google may spend up to ~2× daily on some days; monthly tends toward ~30.4 × daily.'
  };
}

module.exports = {
  hostNorm,
  sameRegistrableHost,
  assertSingleFinalUrlDomain,
  assertCampaignMutable,
  microsToCurrency,
  dailyToImpliedMonthly
};
