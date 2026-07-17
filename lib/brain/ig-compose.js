'use strict';

const IG_ENRICH_SCHEMA = {
  type: 'object',
  required: ['title', 'service', 'location'],
  properties: {
    title: { type: 'string' },
    service: { type: 'string' },
    location: { type: 'string' }
  }
};

/**
 * @param {unknown} raw
 */
function normalizeIgEnrich(raw) {
  const o = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  return {
    title: String(o.title == null ? '' : o.title).trim().slice(0, 80),
    service: String(o.service == null ? '' : o.service).trim().slice(0, 80),
    location: String(o.location == null ? '' : o.location).trim().slice(0, 80)
  };
}

module.exports = { IG_ENRICH_SCHEMA, normalizeIgEnrich };
