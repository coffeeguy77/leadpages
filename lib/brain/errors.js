'use strict';

/** @typedef {'bad_request'|'unauthorized'|'forbidden'|'rate_limited'|'provider_auth'|'provider_rate_limit'|'provider_unavailable'|'provider_timeout'|'provider_content_filter'|'invalid_output'|'schema_mismatch'|'config_invalid'|'not_implemented'|'internal'} BrainErrorCode */

const CODES = Object.freeze({
  bad_request: 'bad_request',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  rate_limited: 'rate_limited',
  provider_auth: 'provider_auth',
  provider_rate_limit: 'provider_rate_limit',
  provider_unavailable: 'provider_unavailable',
  provider_timeout: 'provider_timeout',
  provider_content_filter: 'provider_content_filter',
  invalid_output: 'invalid_output',
  schema_mismatch: 'schema_mismatch',
  config_invalid: 'config_invalid',
  not_implemented: 'not_implemented',
  internal: 'internal'
});

class BrainError extends Error {
  /**
   * @param {BrainErrorCode} code
   * @param {string} message
   * @param {{ cause?: unknown, details?: unknown, retryable?: boolean }} [opts]
   */
  constructor(code, message, opts) {
    super(message);
    this.name = 'BrainError';
    this.code = code;
    this.retryable = !!(opts && opts.retryable);
    this.details = opts && opts.details;
    if (opts && opts.cause !== undefined) this.cause = opts.cause;
  }

  toJSON() {
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        details: this.details
      }
    };
  }
}

function isBrainError(err) {
  return err instanceof BrainError;
}

module.exports = { BrainError, CODES, isBrainError };
