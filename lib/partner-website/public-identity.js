/**
 * Public-facing partner identity — privacy-safe labels for premium themes.
 * Surnames are never shown unless identity.displaySurnamePublicly === true.
 */
const { firstName } = require('./defaults');

function allowPublicSurname(identity) {
  return !!(identity && identity.displaySurnamePublicly === true);
}

function publicFirstName(displayName, identity) {
  if (allowPublicSurname(identity)) {
    const full = String(displayName || '').trim();
    if (full) return full.split(/\s+/)[0];
  }
  const fn = firstName(displayName);
  if (!fn || fn === 'your partner') return '';
  return fn;
}

function publicPartnerIntro(agencyName, displayName, identity) {
  const agency = String(agencyName || '').trim();
  const fn = publicFirstName(displayName, identity);
  if (agency && fn) {
    return { agencyHeading: agency, contactLine: 'Work directly with ' + fn };
  }
  if (agency) {
    return { agencyHeading: agency, contactLine: null };
  }
  if (fn) {
    return { agencyHeading: 'Work directly with ' + fn, contactLine: null };
  }
  return {
    agencyHeading: 'Work directly with your local LeadPages Partner',
    contactLine: null
  };
}

function publicPartnerLabel(displayName, agencyName, identity) {
  if (allowPublicSurname(identity)) {
    return String(displayName || agencyName || '').trim() || 'your local LeadPages Partner';
  }
  const fn = publicFirstName(displayName, identity);
  if (fn) return fn;
  return String(agencyName || '').trim() || 'your local LeadPages Partner';
}

function publicPhotoAlt(displayName, agencyName, identity) {
  const fn = publicFirstName(displayName, identity);
  if (fn) return fn;
  return String(agencyName || 'Partner').trim();
}

function placeholderInitial(agencyName, displayName, identity) {
  const source = String(agencyName || '').trim()
    || publicFirstName(displayName, identity)
    || 'P';
  return source.charAt(0).toUpperCase();
}

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Biography blurb for partner sections — strip openers already shown as agency/contact lines.
 */
function publicPartnerBio(shortIntro, publicIntro, options) {
  options = options || {};
  const intro = publicIntro || {};
  const contact = String(intro.contactLine || '').trim();
  const agency = String(intro.agencyHeading || options.agencyName || '').trim();
  const displayName = String(options.displayName || '').trim();
  let text = String(shortIntro || '').trim();
  if (!text) return '';

  const prefixes = [];
  if (displayName) {
    prefixes.push('Work directly with ' + displayName);
    prefixes.push('Work directly with ' + displayName + ',');
  }
  if (contact) {
    prefixes.push(contact);
    prefixes.push(contact + ',');
  }
  if (agency) {
    prefixes.push('Work directly with ' + agency);
    prefixes.push('Work directly with ' + agency + ',');
  }
  if (contact && /^work directly with\s+/i.test(contact)) {
    const fn = contact.replace(/^work directly with\s+/i, '').trim();
    if (fn) {
      prefixes.push('Work directly with ' + fn);
      prefixes.push('Work directly with ' + fn + ',');
      const parts = fn.split(/\s+/);
      if (parts.length > 1) {
        prefixes.push('Work directly with ' + parts[0]);
        prefixes.push('Work directly with ' + parts[0] + ',');
      }
    }
  }

  prefixes
    .filter(Boolean)
    .sort(function(a, b) { return b.length - a.length; })
    .forEach(function(prefix) {
      const re = new RegExp('^' + escapeRegex(prefix) + '\\s*', 'i');
      text = text.replace(re, '').trim();
    });

  if (contact && /^work directly with\b/i.test(text)) {
    text = text.replace(/^work directly with\s+[^,.]+[,.\s]*/i, '').trim();
  }

  if (!text || (contact && text.toLowerCase() === contact.toLowerCase())) return '';
  return text;
}

module.exports = {
  allowPublicSurname,
  publicFirstName,
  publicPartnerIntro,
  publicPartnerLabel,
  publicPhotoAlt,
  placeholderInitial,
  publicPartnerBio
};
