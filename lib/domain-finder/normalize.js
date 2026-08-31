'use strict';

/**
 * Domain root + full-domain normalisation for Domain Finder.
 */

function stripNoise(s) {
  return String(s == null ? '' : s)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .trim();
}

/** Display label — keep readable casing/spaces for UI. */
function displayName(name) {
  return String(name == null ? '' : name).trim().replace(/\s+/g, ' ');
}

/**
 * Domain root: lowercase, alnum + hyphen only, no leading/trailing hyphen.
 * Ampersand → "and". Spaces removed (ready home → readyhome).
 */
function toRoot(name) {
  let s = stripNoise(name).toLowerCase().normalize('NFKD');
  // Strip known multi-part / single TLDs so "Ready.com.au" → "ready"
  s = s.replace(/\.(com\.au|net\.au|org\.au|com|net|org|au)$/i, '');
  s = s.replace(/&/g, 'and');
  s = s.replace(/[^a-z0-9\s-]/g, '');
  s = s.replace(/\s+/g, '');
  s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s;
}

function isValidRoot(root, opts) {
  opts = opts || {};
  const min = opts.minRootLen != null ? opts.minRootLen : 3;
  const max = opts.maxRootLen != null ? opts.maxRootLen : 32;
  if (!root || typeof root !== 'string') return false;
  if (root.length < min || root.length > max) return false;
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(root)) return false;
  if (root.indexOf('--') >= 0) return false;
  return true;
}

function fullDomain(root, tld) {
  return String(root).toLowerCase() + '.' + String(tld).toLowerCase().replace(/^\./, '');
}

function parseDomain(input) {
  const raw = stripNoise(input).toLowerCase();
  const m = raw.match(/^([a-z0-9-]+)\.((?:com\.au|net\.au|org\.au|au|com|net|org))$/);
  if (m) return { root: m[1], tld: m[2], hadTld: true, domain: m[1] + '.' + m[2] };
  const root = toRoot(raw);
  return { root: root, tld: null, hadTld: false, domain: null };
}

/**
 * Expand roots × TLDs into unique full domains.
 * @returns {{ displayName, root, tld, domain, category, reason }[]}
 */
function expandCandidates(items, tlds, opts) {
  opts = opts || {};
  const out = [];
  const seen = new Set();
  (items || []).forEach(function (it) {
    const display = displayName(it.name || it.displayName || it.root);
    const root = toRoot(it.root || it.name || display);
    if (!isValidRoot(root, opts)) return;
    (tlds || []).forEach(function (tld) {
      const domain = fullDomain(root, tld);
      if (seen.has(domain)) return;
      seen.add(domain);
      out.push({
        displayName: display || root,
        root: root,
        tld: tld,
        domain: domain,
        category: it.category || 'brandable',
        reason: it.reason || ''
      });
    });
  });
  return out;
}

module.exports = {
  stripNoise,
  displayName,
  toRoot,
  isValidRoot,
  fullDomain,
  parseDomain,
  expandCandidates
};
