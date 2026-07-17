'use strict';

/**
 * LeadPages Brain — Phase 1–4 foundation.
 *
 * Feature → Brain → prompt/context → adapter (mock + Anthropic).
 * Retries, task flags, soft budgets. No provider SDKs.
 * Default routes use mock (CI-safe). Set BRAIN_PROVIDER=anthropic for Claude.
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
const {
  createPromptRegistry,
  DEFAULT_PROMPTS,
  renderTemplate,
  listTemplateVariables
} = require('./prompts');
const {
  createContextResolver,
  defaultAuthorize,
  V1_SLICES,
  extractSlice,
  redactSecrets
} = require('./context');
const {
  resolveResilience,
  isTaskDisabled,
  assertWithinBudget,
  withRetries
} = require('./resilience');

/**
 * @param {object} [opts]
 * @param {import('./config').BrainConfig} [opts.config]
 * @param {Record<string, import('./types').ProviderAdapter>} [opts.adapters]
 * @param {(event: object) => void} [opts.onUsage]
 * @param {(info: object) => ({ allow: boolean, reason?: string }|boolean|void)} [opts.onBudgetCheck]
 * @param {object} [opts.mock]
 * @param {object} [opts.anthropic] — apiKey, fetchImpl, baseUrl
 * @param {typeof fetch} [opts.fetchImpl] — injected fetch for Anthropic (tests)
 * @param {ReturnType<typeof createPromptRegistry>} [opts.prompts]
 * @param {import('./prompts').PromptDefinition[]} [opts.promptDefinitions]
 * @param {ReturnType<typeof createContextResolver>} [opts.contextResolver]
 * @param {object} [opts.context] — options for createContextResolver
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
  const prompts = options.prompts || createPromptRegistry(options.promptDefinitions);
  const contextResolver = options.contextResolver || createContextResolver(options.context);
  return createGateway({
    config,
    router,
    adapters,
    onUsage: options.onUsage,
    onBudgetCheck: options.onBudgetCheck,
    prompts,
    contextResolver
  });
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
  createPromptRegistry,
  DEFAULT_PROMPTS,
  renderTemplate,
  listTemplateVariables,
  createContextResolver,
  defaultAuthorize,
  V1_SLICES,
  extractSlice,
  redactSecrets,
  resolveResilience,
  isTaskDisabled,
  assertWithinBudget,
  withRetries,
  validateAgainstSchema,
  assertSchema,
  BrainError,
  CODES,
  isBrainError,
  newCorrelationId,
  ensureCorrelationId
};
