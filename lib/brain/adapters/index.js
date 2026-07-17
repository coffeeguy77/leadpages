'use strict';

const { createMockAdapter } = require('./mock');
const { createAnthropicAdapter } = require('./anthropic');

/**
 * Phase 2: mock + anthropic. OpenAI/Gemini later.
 * @param {{ mock?: object, anthropic?: object }} [opts]
 */
function createAdapters(opts) {
  const options = opts || {};
  return {
    mock: createMockAdapter(options.mock),
    anthropic: createAnthropicAdapter(options.anthropic)
  };
}

module.exports = { createAdapters, createMockAdapter, createAnthropicAdapter };
