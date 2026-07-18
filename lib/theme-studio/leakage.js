'use strict';

/**
 * Cross-industry content leakage detectors for Theme Studio fixtures.
 * Fail loudly when trade copy appears in jewellery concepts (and vice versa).
 */

/** @type {ReadonlyArray<{ id: string, pattern: RegExp, industries?: string[] }>} */
const TRADE_LEAKAGE_TERMS = Object.freeze([
  { id: 'drains', pattern: /\bdrains?\b/i },
  { id: 'plumbing', pattern: /\bplumb(ing|er|ers)?\b/i },
  { id: 'hedge_trimming', pattern: /\bhedge\s*trimm/i },
  { id: 'security_services', pattern: /\b(security\s+(services?|patrol|guards?)|alarm\s+response)\b/i },
  { id: 'emergency_callouts', pattern: /\b(emergency\s+call[- ]?outs?|24\/7\s+emergency|same[- ]day\s+emergency)\b/i },
  { id: 'hi_vis', pattern: /\b(hi[- ]?vis|high[- ]visibility)\b/i },
  { id: 'trade_certifications', pattern: /\b(trade\s+certificat|licensed\s+tradie|master\s+plumber|electrical\s+licence)\b/i },
  { id: 'tradie_trust', pattern: /\b(fully\s+insured\s+tradie|no\s+call[- ]out\s+fee|blocked\s+drain)\b/i },
  { id: 'suburb_service_lang', pattern: /\b(servicing\s+all\s+canberra\s+suburbs|we\s+cover\s+your\s+suburb)\b/i }
]);

/** @type {ReadonlyArray<{ id: string, pattern: RegExp }>} */
const JEWELLERY_LEAKAGE_TERMS = Object.freeze([
  { id: 'pink_diamond', pattern: /\bpink\s+diamonds?\b/i },
  { id: 'engagement_rings', pattern: /\bengagement\s+rings?\b/i },
  { id: 'jewellery_vault', pattern: /\b(jewellery|jewelry)\s+vault\b/i },
  { id: 'carat', pattern: /\bcarat\b/i }
]);

/**
 * Flatten concept / config-like objects into searchable text.
 * @param {unknown} value
 * @returns {string}
 */
function flattenText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(flattenText).join('\n');
  if (typeof value === 'object') {
    return Object.entries(/** @type {Record<string, unknown>} */ (value))
      .filter(([k]) => {
        const key = String(k);
        // Skip metadata that may list forbidden terms as exclusions, not content.
        if (
          [
            'schemaVersion',
            'conceptId',
            'foundationId',
            'layoutId',
            'recipeId',
            'rendererShellId',
            'sourceAppIds',
            'imageDirectionProfile',
            'incompatibilities',
            'excludedIndustries',
            'avoid',
            'avoidTerms',
            'rejected',
            'rejectionReasons',
            'diagnostics',
            'supportedIndustries',
            'unsuitableIndustries',
            'aliases',
            'rendererWarnings',
            'notes',
            'pipeline',
            'queriesUsed',
            'searchQuery'
          ].includes(key)
        ) {
          return false;
        }
        return true;
      })
      .map(([, v]) => flattenText(v))
      .join('\n');
  }
  return '';
}

/**
 * @param {unknown} conceptOrConfig
 * @param {{ industry?: string, forbidTrade?: boolean, forbidJewellery?: boolean }} [opts]
 * @returns {{ ok: boolean, errors: Array<{ code: string, termId: string, message: string, path: string }> }}
 */
function detectIndustryLeakage(conceptOrConfig, opts) {
  const options = opts || {};
  const industry = String(options.industry || '').toLowerCase();
  const text = flattenText(conceptOrConfig);
  const errors = [];

  const forbidTrade =
    options.forbidTrade === true ||
    /jewellery|jewelry|retail|boutique|cafe|hospitality|agency|wellness|health/.test(industry);

  const forbidJewellery =
    options.forbidJewellery === true ||
    /security|plumbing|electrical|trade|property-maintenance|hvac/.test(industry);

  if (forbidTrade) {
    for (const term of TRADE_LEAKAGE_TERMS) {
      if (term.pattern.test(text)) {
        errors.push({
          code: 'industry_leakage_trade',
          termId: term.id,
          message: 'Trade/field-service leakage detected: ' + term.id,
          path: 'content'
        });
      }
    }
  }

  if (forbidJewellery) {
    for (const term of JEWELLERY_LEAKAGE_TERMS) {
      if (term.pattern.test(text)) {
        errors.push({
          code: 'industry_leakage_jewellery',
          termId: term.id,
          message: 'Jewellery/retail leakage detected: ' + term.id,
          path: 'content'
        });
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  TRADE_LEAKAGE_TERMS,
  JEWELLERY_LEAKAGE_TERMS,
  flattenText,
  detectIndustryLeakage
};
