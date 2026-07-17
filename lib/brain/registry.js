'use strict';

const { BrainError, CODES } = require('./errors');

/**
 * @param {import('./config').BrainConfig} config
 */
function createModelRegistry(config) {
  /**
   * @param {string} provider
   * @param {string} model
   */
  function get(provider, model) {
    for (const entry of Object.values(config.models)) {
      if (entry.provider === provider && entry.model === model) return entry;
    }
    return null;
  }

  function list() {
    return Object.entries(config.models).map(([id, m]) => ({ id, ...m }));
  }

  /**
   * @param {string} provider
   * @param {string} model
   */
  function requireModel(provider, model) {
    const found = get(provider, model);
    if (!found) {
      throw new BrainError(
        CODES.config_invalid,
        'Unknown model: ' + provider + '/' + model
      );
    }
    return found;
  }

  return { get, list, requireModel };
}

module.exports = { createModelRegistry };
