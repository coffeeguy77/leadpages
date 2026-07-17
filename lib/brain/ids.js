'use strict';

const crypto = require('crypto');

/** @returns {string} */
function newCorrelationId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

/**
 * @param {string|undefined|null} value
 * @returns {string}
 */
function ensureCorrelationId(value) {
  const s = String(value || '').trim();
  if (s && s.length <= 128) return s;
  return newCorrelationId();
}

module.exports = { newCorrelationId, ensureCorrelationId };
