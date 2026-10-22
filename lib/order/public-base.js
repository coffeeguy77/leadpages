'use strict';

/**
 * Base URL for customer-facing order links (SMS, email, QR, Stripe return).
 *
 * Uses the shop's own domain (sites.custom_domain) when it is attached to the LeadPages
 * Vercel project, verified, and its DNS points here — so customers see a link they trust,
 * e.g. https://www.griffithbutchery.com.au/order-portal?t=…  If the domain redirects
 * (apex → www) the redirect target is used, so the link lands with no extra hop.
 *
 * Anything uncertain (no domain, not attached, DNS not pointed yet, Vercel API slow or
 * unavailable) falls back to the platform address, so a link is never broken.
 * Results are cached per server instance for 10 minutes.
 */

const { getAdmin } = require('./supabase');

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://leadpages.com.au').replace(/\/+$/, '');
const TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 2500;
const cache = new Map();

function cleanHost(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
}

function withTimeout(p) {
  return Promise.race([
    p,
    new Promise(function (_r, rej) { setTimeout(function () { rej(new Error('timeout')); }, TIMEOUT_MS); })
  ]);
}

/** Default checker: Vercel project domain + DNS config. Returns the live host or null. */
async function vercelLiveHost(host) {
  const v = require('../../api/vercel/_client');
  if (!v.projectConfigured || !v.projectConfigured()) return null;
  const pd = await v.getProjectDomain(host);
  if (!pd || !pd.verified) return null;
  const target = cleanHost(pd.redirect) || host;
  const cfg = await v.getDomainConfig(target);
  if (!cfg || cfg.misconfigured) return null;
  if (target !== host) {
    // the redirect target must also be attached to this project
    const td = await v.getProjectDomain(target);
    if (!td || !td.verified) return null;
  }
  return target;
}

let checker = vercelLiveHost;

/**
 * @param {object|string} siteOrId  site row (with custom_domain) or site id
 * @returns {Promise<string>} e.g. "https://www.griffithbutchery.com.au" or PUBLIC_BASE
 */
async function orderLinkBase(siteOrId) {
  try {
    let domain = siteOrId && typeof siteOrId === 'object' ? siteOrId.custom_domain : undefined;
    if (domain === undefined) {
      const id = siteOrId && typeof siteOrId === 'object' ? siteOrId.id : siteOrId;
      if (!id) return PUBLIC_BASE;
      const { data } = await getAdmin().from('sites').select('custom_domain').eq('id', id).maybeSingle();
      domain = data && data.custom_domain;
    }
    const host = cleanHost(domain);
    if (!host || /(^|\.)leadpages\.(com\.au|webculture\.au)$/.test(host)) return PUBLIC_BASE;
    const hit = cache.get(host);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.base;
    let base = PUBLIC_BASE;
    try {
      const live = await withTimeout(checker(host));
      if (live) base = 'https://' + live;
    } catch (_e) {
      base = PUBLIC_BASE;
    }
    cache.set(host, { base: base, at: Date.now() });
    return base;
  } catch (_e) {
    return PUBLIC_BASE;
  }
}

module.exports = {
  PUBLIC_BASE,
  orderLinkBase,
  _setChecker: function (fn) { checker = fn || vercelLiveHost; cache.clear(); }
};
