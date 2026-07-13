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

module.exports = {
  allowPublicSurname,
  publicFirstName,
  publicPartnerIntro,
  publicPartnerLabel,
  publicPhotoAlt,
  placeholderInitial
};
