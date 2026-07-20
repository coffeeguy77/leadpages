/**
 * Site-owned lead inbox blocklist (email / domain / country).
 * Stored on sites.config.leadInbox and checked at ingest.
 */

const { resolveCountryCode } = require('./country-codes');

function cleanPattern(v, max) {
  return String(v == null ? '' : v).trim().toLowerCase().slice(0, max || 160);
}

function normalizeInbox(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  function list(key) {
    return (Array.isArray(src[key]) ? src[key] : [])
      .map(function (x) { return cleanPattern(x); })
      .filter(Boolean)
      .filter(function (x, i, a) { return a.indexOf(x) === i; });
  }
  return {
    blockedEmails: list('blockedEmails'),
    blockedDomains: list('blockedDomains'),
    blockedCountries: list('blockedCountries')
  };
}

function emailDomain(email) {
  const e = cleanPattern(email);
  const at = e.lastIndexOf('@');
  if (at < 0) return '';
  return e.slice(at + 1);
}

/**
 * @param {{ email?: string, country?: string, countryCode?: string }} lead
 * @param {object} inboxRaw — sites.config.leadInbox
 * @returns {{ blocked: boolean, reason?: string, match?: string }}
 */
function isLeadBlocked(lead, inboxRaw) {
  const inbox = normalizeInbox(inboxRaw);
  const email = cleanPattern(lead && lead.email);
  const domain = emailDomain(email);
  const country = cleanPattern((lead && (lead.countryCode || lead.country)) || '', 8);

  if (email && inbox.blockedEmails.indexOf(email) >= 0) {
    return { blocked: true, reason: 'email', match: email };
  }
  if (domain) {
    for (let i = 0; i < inbox.blockedDomains.length; i++) {
      const pat = inbox.blockedDomains[i];
      if (!pat) continue;
      // Exact domain or suffix wildcard: "*.bad.com" / "bad.com"
      const bare = pat.replace(/^\*\./, '');
      if (domain === bare || domain.endsWith('.' + bare) || pat === '*.' + domain) {
        return { blocked: true, reason: 'domain', match: pat };
      }
    }
  }
  if (country && inbox.blockedCountries.indexOf(country) >= 0) {
    return { blocked: true, reason: 'country', match: country };
  }
  return { blocked: false };
}

function addBlock(inboxRaw, type, value) {
  const inbox = normalizeInbox(inboxRaw);
  const v = cleanPattern(value, type === 'country' ? 8 : 160);
  if (!v) return inbox;
  if (type === 'email') {
    if (inbox.blockedEmails.indexOf(v) < 0) inbox.blockedEmails.push(v);
  } else if (type === 'domain') {
    const d = v.replace(/^@/, '').replace(/^\*\./, '');
    const store = d.includes('.') ? d : v;
    if (inbox.blockedDomains.indexOf(store) < 0) inbox.blockedDomains.push(store);
  } else if (type === 'country') {
    const code = resolveCountryCode(value) || cleanPattern(value, 8);
    if (code && inbox.blockedCountries.indexOf(code) < 0) inbox.blockedCountries.push(code);
  }
  return inbox;
}

function removeBlock(inboxRaw, type, value) {
  const inbox = normalizeInbox(inboxRaw);
  const v = cleanPattern(value, type === 'country' ? 8 : 160);
  function drop(arr) { return arr.filter(function (x) { return x !== v; }); }
  if (type === 'email') inbox.blockedEmails = drop(inbox.blockedEmails);
  else if (type === 'domain') inbox.blockedDomains = drop(inbox.blockedDomains);
  else if (type === 'country') inbox.blockedCountries = drop(inbox.blockedCountries);
  return inbox;
}

module.exports = {
  normalizeInbox,
  isLeadBlocked,
  addBlock,
  removeBlock,
  emailDomain,
  cleanPattern
};
