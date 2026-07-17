'use strict';

/**
 * In-memory usage ring buffer for Control Centre (Phase 6).
 * Not durable across serverless isolates — upgrade to ai_requests later.
 */

/**
 * @param {object} [opts]
 * @param {number} [opts.capacity]
 */
function createUsageStore(opts) {
  const capacity = (opts && opts.capacity) || 200;
  /** @type {object[]} */
  const events = [];
  /** @type {Record<string, { calls: number, failures: number, inputTokens: number, outputTokens: number, estimateUsd: number }>} */
  const byTask = Object.create(null);

  /**
   * @param {object} event
   */
  function record(event) {
    if (!event || typeof event !== 'object') return;
    const row = Object.assign({ recordedAt: new Date().toISOString() }, event);
    events.push(row);
    while (events.length > capacity) events.shift();

    const taskId = String(row.taskId || 'unknown');
    if (!byTask[taskId]) {
      byTask[taskId] = {
        calls: 0,
        failures: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimateUsd: 0
      };
    }
    const agg = byTask[taskId];
    agg.calls += 1;
    if (row.success === false) agg.failures += 1;
    agg.inputTokens += Number(row.inputTokens) || 0;
    agg.outputTokens += Number(row.outputTokens) || 0;
    agg.estimateUsd += Number(row.estimateUsd) || 0;
  }

  /**
   * @param {number} [limit]
   */
  function recent(limit) {
    const n = typeof limit === 'number' ? limit : 50;
    return events.slice(-n).reverse();
  }

  /**
   * @param {number} [limit]
   */
  function recentFailures(limit) {
    const n = typeof limit === 'number' ? limit : 25;
    return events.filter((e) => e.success === false).slice(-n).reverse();
  }

  function summary() {
    return {
      totalEvents: events.length,
      byTask: { ...byTask },
      capacity
    };
  }

  function clear() {
    events.length = 0;
    for (const k of Object.keys(byTask)) delete byTask[k];
  }

  return { record, recent, recentFailures, summary, clear };
}

/** Process-local default store for Control Centre. */
let _defaultStore = null;
function getDefaultUsageStore() {
  if (!_defaultStore) _defaultStore = createUsageStore();
  return _defaultStore;
}

function resetDefaultUsageStore() {
  if (_defaultStore) _defaultStore.clear();
  _defaultStore = null;
}

module.exports = {
  createUsageStore,
  getDefaultUsageStore,
  resetDefaultUsageStore
};
