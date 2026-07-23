'use strict';

/**
 * Provider gateway — routes ops, applies budget hooks, prefers mock when unconfigured.
 * See docs/search-intelligence/04-PROVIDER-GATEWAY.md
 */

const mock = require('./mock');
const dataforseo = require('./dataforseo');

const ADAPTERS = Object.freeze({
  mock: mock,
  dataforseo: dataforseo
});

const OPS = Object.freeze(['keywordIdeas', 'serp', 'domainOverview', 'rankCheck']);

/**
 * @param {{ provider?: string, budgetRemaining?: number|null }} [opts]
 */
function createGateway(opts) {
  const o = opts || {};
  const preferred = o.provider || process.env.SI_PROVIDER || 'mock';
  const budgetRemaining = o.budgetRemaining == null ? null : Number(o.budgetRemaining);

  function resolveAdapter(name) {
    const id = name || preferred;
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

  return {
    preferred: preferred,
    adapters: Object.keys(ADAPTERS),
    ops: OPS.slice(),
    run: run,
    keywordIdeas: function (input, runOpts) { return run('keywordIdeas', input, runOpts); },
    serp: function (input, runOpts) { return run('serp', input, runOpts); },
    domainOverview: function (input, runOpts) { return run('domainOverview', input, runOpts); },
    rankCheck: function (input, runOpts) { return run('rankCheck', input, runOpts); }
  };
}

module.exports = {
  ADAPTERS: ADAPTERS,
  OPS: OPS,
  createGateway: createGateway
};
