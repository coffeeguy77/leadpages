'use strict';

const { createMockAdapter } = require('./mock');

/**
 * Phase 1: mock only. Anthropic lands in Phase 2.
 * @param {{ mock?: object }} [opts]
 */
function createAdapters(opts) {
  const options = opts || {};
  return {
    mock: createMockAdapter(options.mock)
  };
}

module.exports = { createAdapters, createMockAdapter };
