'use strict';

/**
 * Helpers for structured SEO landing briefs (keyword, location, negatives).
 */

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
function parseNegatives(raw) {
  if (Array.isArray(raw)) {
    return raw.map((n) => String(n || '').trim()).filter(Boolean);
  }
  return String(raw || '')
    .split(/[,;\n]+/)
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 40);
}

/**
 * Drop homepage services that collide with negative keywords.
 * @param {string} summary
 * @param {string[]} negatives
 */
function filterServicesSummary(summary, negatives) {
  const negs = (negatives || []).map((n) => n.toLowerCase()).filter(Boolean);
  const parts = String(summary || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!negs.length) return parts.join(', ');
  const kept = parts.filter((s) => {
    const low = s.toLowerCase();
    return !negs.some((n) => low.includes(n) || n.includes(low));
  });
  if (!kept.length) {
    return 'None relevant — do NOT invent offerings from the homepage brand. Stay inside the brief only.';
  }
  return kept.join(', ');
}

/**
 * @param {object} draft
 * @param {string[]} negatives
 * @returns {string[]} matched negatives found in draft copy
 */
function findNegativeHits(draft, negatives) {
  const negs = (negatives || []).map((n) => String(n || '').trim()).filter(Boolean);
  if (!negs.length) return [];
  const blob = JSON.stringify(draft || {}).toLowerCase();
  return negs.filter((n) => blob.includes(n.toLowerCase()));
}

/**
 * Build the free-text brief + structured fields for the prompt.
 * @param {object} body — request body
 */
function buildLandingBriefInput(body) {
  const b = body || {};
  const mode = String(b.mode || b.briefMode || 'seo').toLowerCase();
  const primaryKeyword = String(b.primaryKeyword || b.keyword || '').trim();
  const location = String(b.location || '').trim();
  const negativeKeywords = parseNegatives(b.negativeKeywords || b.negatives || '');
  const extraInfo = String(b.extraInfo || b.extra || '').trim();
  const freeform = String(b.brief || '').trim();

  let brief = freeform;
  if (mode === 'seo' || primaryKeyword || location || negativeKeywords.length || extraInfo) {
    const parts = [];
    if (primaryKeyword) {
      parts.push(
        'Primary search term / service: ' +
          primaryKeyword +
          (location ? ' in ' + location : '')
      );
    } else if (freeform) {
      parts.push(freeform);
    }
    if (location) parts.push('Location focus: ' + location);
    if (extraInfo) parts.push('Extra requirements: ' + extraInfo);
    if (negativeKeywords.length) {
      parts.push(
        'NEGATIVE KEYWORDS (hard ban — never mention, never pivot into these topics): ' +
          negativeKeywords.join(', ')
      );
    }
    if (!primaryKeyword && freeform && !parts.includes(freeform)) {
      parts.unshift(freeform);
    }
    brief = parts.join('\n') || freeform;
  }

  if (!brief) {
    brief = 'Write an SEO landing page for our primary local service keyword.';
  }

  return {
    mode: mode === 'freeform' ? 'freeform' : 'seo',
    brief,
    primaryKeywordHint: primaryKeyword || '',
    location: location || '',
    negativeKeywords: negativeKeywords.join(', ') || 'none',
    negativeList: negativeKeywords,
    extraInfo: extraInfo || 'none',
    uniquenessSeed:
      String(b.uniquenessSeed || '').trim() ||
      Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
  };
}

module.exports = {
  parseNegatives,
  filterServicesSummary,
  findNegativeHits,
  buildLandingBriefInput
};
