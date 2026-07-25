'use strict';

/**
 * Hard-coded demo domains that must NEVER appear as a customer's competitors.
 * Historical mock leakage (plumber fixtures) polluted real sites like coffeeevents.com.au.
 */

const FORBIDDEN_COMPETITOR_DOMAINS = Object.freeze([
  'rival-plumb.com.au',
  'canberra-pipes.com.au',
  'act-drainmasters.com.au',
  'queanbeyan-plumbing.com.au',
  'example-plumber.com.au',
  'rival.example',
  'directory.example',
  'maps.google.com'
]);

const FORBIDDEN_SET = FORBIDDEN_COMPETITOR_DOMAINS.reduce(function (acc, d) {
  acc[d] = true;
  return acc;
}, {});

function cleanDomain(d) {
  return String(d || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

function isForbiddenCompetitorDomain(domain) {
  const d = cleanDomain(domain);
  if (!d) return true;
  if (FORBIDDEN_SET[d]) return true;
  // Synthetic mock hosts — never treat as real rivals for customers
  if (/\.example$/i.test(d)) return true;
  if (/^comp-\d+-/i.test(d) || /^rival-[a-z0-9-]+-[ab]\.example$/i.test(d)) return true;
  return false;
}

function domainFromItem(item) {
  if (item && typeof item === 'object' && item.domain != null) return cleanDomain(item.domain);
  return cleanDomain(item);
}

function filterCompetitorDomains(list) {
  return (list || [])
    .map(domainFromItem)
    .filter(function (d) {
      return d && !isForbiddenCompetitorDomain(d);
    });
}

/** Hard-coded demo plumber hosts only (not seed-derived *.example mocks). */
function isHardcodedFixtureDomain(domain) {
  const d = cleanDomain(domain);
  return !!(d && FORBIDDEN_SET[d]);
}

function slugFromDomain(domain) {
  const d = cleanDomain(domain);
  const bare = d
    .replace(/\.(com\.au|co\.uk|com|net|org|au|io)$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
  return bare || 'site';
}

/**
 * Tokens for keyword synthesis from a domain / business name — never defaults to plumber.
 */
function serviceTokensFromDomain(domain, businessName) {
  const LOCATION_STOP = {
    canberra: 1,
    sydney: 1,
    melbourne: 1,
    brisbane: 1,
    perth: 1,
    adelaide: 1,
    hobart: 1,
    darwin: 1,
    australia: 1,
    au: 1,
    act: 1,
    nsw: 1,
    vic: 1,
    qld: 1,
    www: 1,
    com: 1,
    net: 1,
    org: 1,
    the: 1,
    and: 1
  };
  const raw = [slugFromDomain(domain).replace(/-/g, ' '), String(businessName || '')]
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return raw
    .split(/\s+/)
    .filter(function (t) {
      return t.length >= 3 && !LOCATION_STOP[t];
    })
    .slice(0, 6);
}

module.exports = {
  FORBIDDEN_COMPETITOR_DOMAINS,
  cleanDomain,
  domainFromItem,
  isForbiddenCompetitorDomain,
  isHardcodedFixtureDomain,
  filterCompetitorDomains,
  slugFromDomain,
  serviceTokensFromDomain
};
