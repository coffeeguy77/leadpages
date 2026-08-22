'use strict';

/**
 * Display helpers for customer names on the order storefront.
 * Butcher CSV imports often use ALL-CAPS surnames ("Shaun MATTHEWS" or "MATTHEWS Shaun").
 */

function titleCaseWord(word) {
  var w = String(word || '').trim();
  if (!w) return '';
  // Keep hyphenated / apostrophe parts tidy: O'BRIEN → O'Brien, MARY-JANE → Mary-Jane
  return w
    .toLowerCase()
    .split(/([-'])/)
    .map(function (part) {
      if (part === '-' || part === "'") return part;
      if (!part) return '';
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

function isAllCapsWord(word) {
  var w = String(word || '');
  return w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w);
}

/**
 * Full display name: given name first, each word title-cased.
 * "MATTHEWS Shaun" / "MATTHEWS, Shaun" / "SHAUN MATTHEWS" → "Shaun Matthews"
 */
function displayFullName(fullName) {
  var raw = String(fullName || '').trim();
  if (!raw) return '';

  if (raw.indexOf(',') >= 0) {
    var commaBits = raw
      .split(',')
      .map(function (p) {
        return p.trim();
      })
      .filter(Boolean);
    if (commaBits.length >= 2) {
      // "MATTHEWS, Shaun" → Shaun Matthews
      if (isAllCapsWord(commaBits[0]) && !isAllCapsWord(commaBits[1])) {
        return titleCaseWord(commaBits[1].split(/\s+/)[0]) + ' ' + titleCaseWord(commaBits[0]);
      }
      return commaBits
        .map(function (b) {
          return b
            .split(/\s+/)
            .map(titleCaseWord)
            .join(' ');
        })
        .join(' ');
    }
  }

  var parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return titleCaseWord(parts[0]);

  // "MATTHEWS Shaun" — surname first (all caps), given last → reverse
  if (isAllCapsWord(parts[0]) && !isAllCapsWord(parts[parts.length - 1])) {
    var given = parts[parts.length - 1];
    var surnameParts = parts.slice(0, -1);
    return (
      titleCaseWord(given) +
      ' ' +
      surnameParts
        .map(titleCaseWord)
        .join(' ')
    );
  }

  // "Shaun MATTHEWS" / "SHAUN MATTHEWS" — keep order, title-case each
  return parts.map(titleCaseWord).join(' ');
}

/**
 * Best given name for greetings: "Welcome, Shaun".
 */
function displayGivenName(fullName) {
  var full = displayFullName(fullName);
  if (!full) return '';
  return full.split(/\s+/)[0] || '';
}

module.exports = {
  titleCaseWord,
  displayFullName,
  displayGivenName,
  isAllCapsWord
};
