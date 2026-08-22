'use strict';

/**
 * Display helpers for customer names on the order storefront.
 * Butcher CSV imports often use ALL-CAPS surnames ("Shaun MATTHEWS").
 */

function titleCaseWord(word) {
  var w = String(word || '').trim();
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function isAllCapsWord(word) {
  var w = String(word || '');
  return w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w);
}

/**
 * Best given name for greetings: "Welcome, Shaun".
 * Handles "Shaun MATTHEWS", "SHAUN MATTHEWS", "MATTHEWS Shaun", "MATTHEWS, Shaun".
 */
function displayGivenName(fullName) {
  var raw = String(fullName || '').trim();
  if (!raw) return '';

  if (raw.indexOf(',') >= 0) {
    var commaBits = raw.split(',').map(function (p) {
      return p.trim();
    }).filter(Boolean);
    // "MATTHEWS, Shaun" → Shaun; "Shaun, MATTHEWS" → Shaun
    if (commaBits.length >= 2) {
      if (isAllCapsWord(commaBits[0]) && !isAllCapsWord(commaBits[1])) {
        return titleCaseWord(commaBits[1].split(/\s+/)[0]);
      }
      return titleCaseWord(commaBits[0].split(/\s+/)[0]);
    }
  }

  var parts = raw.split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return titleCaseWord(parts[0]);

  // "MATTHEWS Shaun" — surname first (all caps), given last
  if (isAllCapsWord(parts[0]) && !isAllCapsWord(parts[parts.length - 1])) {
    return titleCaseWord(parts[parts.length - 1]);
  }

  // "Shaun MATTHEWS" / "SHAUN MATTHEWS" — given first (import order)
  return titleCaseWord(parts[0]);
}

module.exports = { titleCaseWord, displayGivenName, isAllCapsWord };
