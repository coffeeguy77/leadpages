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
 * @property {boolean} [enabled]
 * @property {number} [maxTokens]
 * @property {number} [timeoutMs]
 */

/**
 * @typedef {object} BrainConfig
 * @property {Record<string, BrainModelConfig>} models
 * @property {Record<string, BrainRouteConfig>} routes
 * @property {string} [defaultProvider]
 * @property {{ maxRetries?: number, retryBackoffMs?: number }} [resilience]
 * @property {{ disabledTasks?: string[], landingDraft?: boolean }} [flags]
 * @property {{ maxOutputTokensPerCall?: number, maxEstimatedCostUsdPerCall?: number, usdPer1kOutputTokens?: number }} [budgets]
 */

/**
 * Default Brain config. Routes use mock unless BRAIN_PROVIDER is set.
 * Supported: mock | anthropic | openai | gemini
 * @returns {BrainConfig}
 */
function defaultBrainConfig() {
  const anthropicSonnet = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  const anthropicHaiku = process.env.ASSIST_MODEL || 'claude-haiku-4-5-20251001';
  const tradeModel = process.env.TRADE_PACK_MODEL || anthropicSonnet;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const provider = String(process.env.BRAIN_PROVIDER || 'mock').toLowerCase();
  const activeProvider = ['anthropic', 'openai', 'gemini'].includes(provider)
    ? provider
    : 'mock';

  /** Migration flags (env-driven; Control Centre can overlay disabledTasks). */
  /** @type {import('./config').BrainConfig} */
  const cfg = {
    defaultProvider: activeProvider,
    resilience: {
      maxRetries: Number(process.env.BRAIN_MAX_RETRIES || 1),
      retryBackoffMs: Number(process.env.BRAIN_RETRY_BACKOFF_MS || 25)
    },
    flags: {
      disabledTasks: [],
      /** Phase 7: set BRAIN_LANDING_DRAFT=1 to enable server-side landing drafts. */
      landingDraft: String(process.env.BRAIN_LANDING_DRAFT || '').toLowerCase() === '1'
    },
    budgets: {
      maxOutputTokensPerCall: Number(process.env.BRAIN_MAX_OUTPUT_TOKENS || 16000),
      maxEstimatedCostUsdPerCall: process.env.BRAIN_MAX_COST_USD != null
        ? Number(process.env.BRAIN_MAX_COST_USD)
        : undefined,
      usdPer1kOutputTokens: 0.015
    },
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
      },
      'openai:default': {
        provider: 'openai',
        model: openaiModel,
        capabilities: ['text', 'structured_json'],
        maxTokens: 8192,
        timeoutMs: 60000
      },
      'gemini:default': {
        provider: 'gemini',
        model: geminiModel,
        capabilities: ['text', 'structured_json'],
        maxTokens: 8192,
        timeoutMs: 60000
      }
    },
    routes: {}
  };

  /**
   * @param {string} taskId
   * @param {string} mockModel
   * @param {{ anthropic: string, openai: string, gemini: string }} modelsByProvider
   * @param {object} [extra]
   */
  function route(taskId, mockModel, modelsByProvider, extra) {
    let primary;
    if (activeProvider === 'anthropic') {
      primary = { provider: 'anthropic', model: modelsByProvider.anthropic };
    } else if (activeProvider === 'openai') {
      primary = { provider: 'openai', model: modelsByProvider.openai };
    } else if (activeProvider === 'gemini') {
      primary = { provider: 'gemini', model: modelsByProvider.gemini };
    } else {
      primary = { provider: 'mock', model: mockModel };
    }
    const fallback = activeProvider !== 'mock'
      ? [{ provider: 'mock', model: mockModel }]
      : [];
    cfg.routes[taskId] = Object.assign({
      taskId,
      primary,
      fallback
    }, extra || {});
  }

  const fast = {
    anthropic: anthropicHaiku,
    openai: openaiModel,
    gemini: geminiModel
  };
  const reason = {
    anthropic: anthropicSonnet,
    openai: openaiModel,
    gemini: geminiModel
  };
  const trade = {
    anthropic: tradeModel,
    openai: openaiModel,
    gemini: geminiModel
  };

  route('generic.fast', 'mock-fast', fast, { structured: false, maxTokens: 1024, timeoutMs: 2000 });
  route('generic.reason', 'mock-default', reason, { structured: false });
  route('content.landing_draft', 'mock-default', reason, { structured: true });
  route('ig.caption_enrich', 'mock-default', reason, { structured: true });
  route('seo.suburb_intro', 'mock-default', reason, { structured: false, maxTokens: 220 });
  route('help.answer', 'mock-fast', fast, { structured: false, maxTokens: 700 });
  route('pack.trade_generate', 'mock-default', trade, {
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
