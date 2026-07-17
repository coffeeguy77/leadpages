'use strict';

const { BrainError, CODES } = require('./errors');

/**
 * Simple Phase 1 task router — policy table only (no experiments yet).
 * @param {import('./config').BrainConfig} config
 * @param {ReturnType<import('./registry').createModelRegistry>} registry
 */
function createTaskRouter(config, registry) {
  /**
   * @param {string} taskId
   */
  function resolve(taskId) {
    const route = config.routes[taskId];
    if (!route) {
      throw new BrainError(CODES.bad_request, 'Unknown taskId: ' + taskId, {
        details: { knownTasks: Object.keys(config.routes) }
      });
    }
    const primary = registry.requireModel(route.primary.provider, route.primary.model);
    const fallback = (route.fallback || []).map((f) =>
      registry.requireModel(f.provider, f.model)
    );
    return {
      taskId: route.taskId || taskId,
      primary: { provider: primary.provider, model: primary.model },
      fallback: fallback.map((m) => ({ provider: m.provider, model: m.model })),
      structured: !!route.structured,
      maxTokens: route.maxTokens != null ? route.maxTokens : primary.maxTokens,
      timeoutMs: route.timeoutMs != null ? route.timeoutMs : primary.timeoutMs,
      reasonCodes: ['policy']
    };
  }

  return { resolve };
}

module.exports = { createTaskRouter };
