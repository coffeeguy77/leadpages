'use strict';

const { createMockAdapter } = require('./mock');
const { createAnthropicAdapter } = require('./anthropic');
const { createOpenAIAdapter } = require('./openai');
const { createGeminiAdapter } = require('./gemini');

/**
 * Phase 5: mock + anthropic + openai + gemini.
 * @param {{ mock?: object, anthropic?: object, openai?: object, gemini?: object }} [opts]
 */
function createAdapters(opts) {
  const options = opts || {};
  return {
    mock: createMockAdapter(options.mock),
    anthropic: createAnthropicAdapter(options.anthropic),
    openai: createOpenAIAdapter(options.openai),
    gemini: createGeminiAdapter(options.gemini)
  };
}

module.exports = {
  createAdapters,
  createMockAdapter,
  createAnthropicAdapter,
  createOpenAIAdapter,
  createGeminiAdapter
};
