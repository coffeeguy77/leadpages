'use strict';

/**
 * Provider gateway — routes ops, applies budget hooks.
 * Market data: mock (tests) + DataForSEO (live).
 * See docs/search-intelligence/04-PROVIDER-GATEWAY.md
 */

const mock = require('./mock');
const dataforseo = require('./dataforseo');

const ADAPTERS = Object.freeze({
  mock: mock,
  dataforseo: dataforseo
});

const OPS = Object.freeze([
  'keywordIdeas',
  'serp',
  'mapsGrid',
  'domainOverview',
  'rankCheck',
  'backlinkSummary',
  'competitorsDomain',
  'rankedKeywords',
  'domainIntersection',
  'referringDomains',
  'domainPages'
]);

/**
 * @param {{ provider?: string, budgetRemaining?: number|null }} [opts]
 */
function createGateway(opts) {
  const o = opts || {};
  let preferred = o.provider || process.env.SI_PROVIDER || process.env.SI_KEYWORD_PROVIDER || 'mock';
  if (String(preferred).toLowerCase() === 'semrush') {
    preferred = dataforseo.configured && dataforseo.configured() ? 'dataforseo' : 'mock';
  }
  // Auto-prefer DataForSEO when credentials exist and no explicit provider was set.
  if (!o.provider && !process.env.SI_PROVIDER && !process.env.SI_KEYWORD_PROVIDER) {
    if (dataforseo.configured && dataforseo.configured()) preferred = 'dataforseo';
  }
  const budgetRemaining = o.budgetRemaining == null ? null : Number(o.budgetRemaining);

  function resolveAdapter(name) {
    const id = name || preferred;
    if (id === 'semrush') return ADAPTERS.dataforseo.configured() ? ADAPTERS.dataforseo : ADAPTERS.mock;
    return ADAPTERS[id] || ADAPTERS.mock;
  }

  async function run(op, input, runOpts) {
    if (OPS.indexOf(op) < 0) {
      return { ok: false, error: 'unknown_operation', operation: op };
    }
    if (budgetRemaining != null && budgetRemaining <= 0) {
      return { ok: false, error: 'budget_exceeded', operation: op };
    }
    const adapter = resolveAdapter(runOpts && runOpts.provider);
    if (typeof adapter[op] !== 'function') {
      return { ok: false, error: 'unsupported_operation', provider: adapter.id, operation: op };
    }
    try {
      const result = await adapter[op](input || {});
      return result;
    } catch (e) {
      return {
        ok: false,
        error: 'provider_error',
        provider: adapter.id,
        operation: op,
        message: String(e && e.message || e)
      };
    }
  }

  const api = {
    preferred: preferred,
    adapters: Object.keys(ADAPTERS),
    ops: OPS.slice(),
    run: run
  };
  OPS.forEach(function (op) {
    api[op] = function (input, runOpts) {
      return run(op, input, runOpts);
    };
  });
  return api;
}

module.exports = {
  ADAPTERS: ADAPTERS,
  OPS: OPS,
  createGateway: createGateway
};
