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
 * Minimal default config for Phase 1 — mock provider only.
 * @returns {BrainConfig}
 */
function defaultBrainConfig() {
  return {
    defaultProvider: 'mock',
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
      }
    },
    routes: {
      'generic.fast': {
        taskId: 'generic.fast',
        primary: { provider: 'mock', model: 'mock-fast' },
        structured: false,
        maxTokens: 1024,
        timeoutMs: 2000
      },
      'generic.reason': {
        taskId: 'generic.reason',
        primary: { provider: 'mock', model: 'mock-default' },
        structured: false
      },
      'content.landing_draft': {
        taskId: 'content.landing_draft',
        primary: { provider: 'mock', model: 'mock-default' },
        structured: true
      },
      'ig.caption_enrich': {
        taskId: 'ig.caption_enrich',
        primary: { provider: 'mock', model: 'mock-default' },
        structured: true
      },
      'seo.suburb_intro': {
        taskId: 'seo.suburb_intro',
        primary: { provider: 'mock', model: 'mock-default' },
        structured: false
      },
      'help.answer': {
        taskId: 'help.answer',
        primary: { provider: 'mock', model: 'mock-fast' },
        structured: false
      },
      'pack.trade_generate': {
        taskId: 'pack.trade_generate',
        primary: { provider: 'mock', model: 'mock-default' },
        structured: true,
        maxTokens: 12288,
        timeoutMs: 120000
      }
    }
  };
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
