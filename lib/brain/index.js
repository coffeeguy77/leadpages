'use strict';

/**
 * LeadPages Brain — Phase 1–2 foundation.
 *
 * Feature → Brain → adapter (mock + Anthropic).
 * No provider SDKs. Default routes use mock (CI-safe).
 * Set BRAIN_PROVIDER=anthropic to route tasks to Claude.
 *
 * @see docs/AI/README.md
 * @see docs/AI/17-IMPLEMENTATION-ROADMAP.md
 */

const { BrainError, CODES, isBrainError } = require('./errors');
const { newCorrelationId, ensureCorrelationId } = require('./ids');
const { defaultBrainConfig, validateBrainConfig } = require('./config');
const { createModelRegistry } = require('./registry');
const { createTaskRouter } = require('./router');
const { createAdapters, createMockAdapter, createAnthropicAdapter } = require('./adapters');
const { createGateway } = require('./gateway');
const { validateAgainstSchema, assertSchema } = require('./schema');

/**
 * @param {object} [opts]
 * @param {import('./config').BrainConfig} [opts.config]
 * @param {Record<string, import('./types').ProviderAdapter>} [opts.adapters]
 * @param {(event: object) => void} [opts.onUsage]
 * @param {object} [opts.mock]
 * @param {object} [opts.anthropic] — apiKey, fetchImpl, baseUrl
 * @param {typeof fetch} [opts.fetchImpl] — injected fetch for Anthropic (tests)
 */
function createBrain(opts) {
  const options = opts || {};
  const config = validateBrainConfig(options.config || defaultBrainConfig());
  const registry = createModelRegistry(config);
  const router = createTaskRouter(config, registry);
  const anthropicOpts = Object.assign({}, options.anthropic);
  if (options.fetchImpl && !anthropicOpts.fetchImpl) {
    anthropicOpts.fetchImpl = options.fetchImpl;
  }
  const adapters = options.adapters || createAdapters({
    mock: options.mock,
    anthropic: anthropicOpts
  });
  return createGateway({ config, router, adapters, onUsage: options.onUsage });
}

/** Default singleton for convenience in tests / early callers. */
let _default = null;
function getDefaultBrain() {
  if (!_default) _default = createBrain();
  return _default;
}

function resetDefaultBrain() {
  _default = null;
}

module.exports = {
  createBrain,
  getDefaultBrain,
  resetDefaultBrain,
  defaultBrainConfig,
  validateBrainConfig,
  createMockAdapter,
  createAnthropicAdapter,
  createAdapters,
  validateAgainstSchema,
  assertSchema,
  BrainError,
  CODES,
  isBrainError,
  newCorrelationId,
  ensureCorrelationId
};
