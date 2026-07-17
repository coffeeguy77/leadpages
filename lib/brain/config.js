'use strict';

const { BrainError, CODES } = require('./errors');

/**
 * @typedef {object} BrainModelConfig
 * @property {string} provider
 * @property {string} model
 * @property {string[]} [capabilities]
 * @property {number} [maxTokens]
 * @property {number} [timeoutMs]
 */

/**
 * @typedef {object} BrainRouteConfig
 * @property {string} taskId
 * @property {{ provider: string, model: string }} primary
 * @property {Array<{ provider: string, model: string }>} [fallback]
 * @property {boolean} [structured]
 * @property {number} [maxTokens]
 * @property {number} [timeoutMs]
 */

/**
 * @typedef {object} BrainConfig
 * @property {Record<string, BrainModelConfig>} models
 * @property {Record<string, BrainRouteConfig>} routes
 * @property {string} [defaultProvider]
 */

/**
 * Default Brain config. Routes use mock unless BRAIN_PROVIDER=anthropic.
 * @returns {BrainConfig}
 */
function defaultBrainConfig() {
  const anthropicSonnet = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  const anthropicHaiku = process.env.ASSIST_MODEL || 'claude-haiku-4-5-20251001';
  const tradeModel = process.env.TRADE_PACK_MODEL || anthropicSonnet;
  // CI-safe default: mock. Set BRAIN_PROVIDER=anthropic to route tasks to Claude.
  const useAnthropic = String(process.env.BRAIN_PROVIDER || '').toLowerCase() === 'anthropic';

  /** @type {import('./config').BrainConfig} */
  const cfg = {
    defaultProvider: useAnthropic ? 'anthropic' : 'mock',
    models: {
      'mock:default': {
        provider: 'mock',
        model: 'mock-default',
        capabilities: ['text', 'structured_json'],
        maxTokens: 4096,
        timeoutMs: 5000
      },
      'mock:fast': {
        provider: 'mock',
        model: 'mock-fast',
        capabilities: ['text'],
        maxTokens: 1024,
        timeoutMs: 2000
      },
      'anthropic:sonnet': {
        provider: 'anthropic',
        model: anthropicSonnet,
        capabilities: ['text', 'structured_json'],
        maxTokens: 8192,
        timeoutMs: 60000
      },
      'anthropic:haiku': {
        provider: 'anthropic',
        model: anthropicHaiku,
        capabilities: ['text'],
        maxTokens: 1024,
        timeoutMs: 30000
      },
      'anthropic:trade': {
        provider: 'anthropic',
        model: tradeModel,
        capabilities: ['text', 'structured_json'],
        maxTokens: 12288,
        timeoutMs: 120000
      }
    },
    routes: {}
  };

  function route(taskId, mockModel, anthropicModel, extra) {
    const primary = useAnthropic
      ? { provider: 'anthropic', model: anthropicModel }
      : { provider: 'mock', model: mockModel };
    const fallback = useAnthropic
      ? [{ provider: 'mock', model: mockModel }]
      : [];
    cfg.routes[taskId] = Object.assign({
      taskId,
      primary,
      fallback
    }, extra || {});
  }

  route('generic.fast', 'mock-fast', anthropicHaiku, { structured: false, maxTokens: 1024, timeoutMs: 2000 });
  route('generic.reason', 'mock-default', anthropicSonnet, { structured: false });
  route('content.landing_draft', 'mock-default', anthropicSonnet, { structured: true });
  route('ig.caption_enrich', 'mock-default', anthropicSonnet, { structured: true });
  route('seo.suburb_intro', 'mock-default', anthropicSonnet, { structured: false, maxTokens: 220 });
  route('help.answer', 'mock-fast', anthropicHaiku, { structured: false, maxTokens: 700 });
  route('pack.trade_generate', 'mock-default', tradeModel, {
    structured: true,
    maxTokens: 12288,
    timeoutMs: 120000
  });

  return cfg;
}

/**
 * @param {unknown} raw
 * @returns {BrainConfig}
 */
function validateBrainConfig(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new BrainError(CODES.config_invalid, 'Brain config must be an object');
  }
  const cfg = /** @type {BrainConfig} */ (raw);
  if (!cfg.models || typeof cfg.models !== 'object') {
    throw new BrainError(CODES.config_invalid, 'Brain config.models is required');
  }
  if (!cfg.routes || typeof cfg.routes !== 'object') {
    throw new BrainError(CODES.config_invalid, 'Brain config.routes is required');
  }
  for (const [key, model] of Object.entries(cfg.models)) {
    if (!model || typeof model !== 'object') {
      throw new BrainError(CODES.config_invalid, 'Invalid model entry: ' + key);
    }
    if (!model.provider || !model.model) {
      throw new BrainError(CODES.config_invalid, 'Model ' + key + ' needs provider and model');
    }
  }
  for (const [taskId, route] of Object.entries(cfg.routes)) {
    if (!route || typeof route !== 'object') {
      throw new BrainError(CODES.config_invalid, 'Invalid route: ' + taskId);
    }
    if (!route.primary || !route.primary.provider || !route.primary.model) {
      throw new BrainError(CODES.config_invalid, 'Route ' + taskId + ' needs primary.provider/model');
    }
    const known = Object.values(cfg.models).some(
      (m) => m.provider === route.primary.provider && m.model === route.primary.model
    );
    if (!known) {
      throw new BrainError(
        CODES.config_invalid,
        'Route ' + taskId + ' primary model not in registry: ' +
          route.primary.provider + '/' + route.primary.model
      );
    }
    for (const fb of route.fallback || []) {
      const fbOk = Object.values(cfg.models).some(
        (m) => m.provider === fb.provider && m.model === fb.model
      );
      if (!fbOk) {
        throw new BrainError(
          CODES.config_invalid,
          'Route ' + taskId + ' fallback model not in registry: ' +
            fb.provider + '/' + fb.model
        );
      }
    }
  }
  return cfg;
}

module.exports = { defaultBrainConfig, validateBrainConfig };
