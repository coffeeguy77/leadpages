'use strict';

const { BrainError, CODES } = require('./errors');

/**
 * Minimal JSON Schema subset validator for Phase 1 (no external deps).
 * Supports: type, properties, required, const, additionalProperties (ignored).
 *
 * @param {unknown} schema
 * @param {unknown} data
 * @param {string} [path]
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
function validateAgainstSchema(schema, data, path) {
  const p = path || '$';
  const errors = [];
  if (!schema || typeof schema !== 'object') {
    return { ok: false, errors: ['schema missing at ' + p] };
  }
  const s = /** @type {Record<string, unknown>} */ (schema);

  if (Object.prototype.hasOwnProperty.call(s, 'const')) {
    if (data !== s.const) errors.push(p + ' must equal const');
  }

  if (s.type) {
    const t = s.type;
    const actual = Array.isArray(data) ? 'array' : data === null ? 'null' : typeof data;
    if (t === 'object') {
      if (actual !== 'object' || data === null || Array.isArray(data)) {
        errors.push(p + ' must be object');
        return { ok: false, errors };
      }
    } else if (t === 'array') {
      if (!Array.isArray(data)) errors.push(p + ' must be array');
    } else if (t === 'string') {
      if (typeof data !== 'string') errors.push(p + ' must be string');
    } else if (t === 'number') {
      if (typeof data !== 'number' || Number.isNaN(data)) errors.push(p + ' must be number');
    } else if (t === 'boolean') {
      if (typeof data !== 'boolean') errors.push(p + ' must be boolean');
    } else if (t === 'null') {
      if (data !== null) errors.push(p + ' must be null');
    }
  }

  if (errors.length) return { ok: false, errors };

  if (s.type === 'object' && data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = /** @type {Record<string, unknown>} */ (data);
    const required = Array.isArray(s.required) ? s.required : [];
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(obj, String(key))) {
        errors.push(p + '.' + key + ' is required');
      }
    }
    const props = s.properties && typeof s.properties === 'object'
      ? /** @type {Record<string, unknown>} */ (s.properties)
      : null;
    if (props) {
      for (const [key, sub] of Object.entries(props)) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const nested = validateAgainstSchema(sub, obj[key], p + '.' + key);
          if (!nested.ok) errors.push(...nested.errors);
        }
      }
    }
  }

  if (s.type === 'array' && Array.isArray(data) && s.items) {
    data.forEach((item, i) => {
      const nested = validateAgainstSchema(s.items, item, p + '[' + i + ']');
      if (!nested.ok) errors.push(...nested.errors);
    });
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * @param {unknown} schema
 * @param {unknown} data
 */
function assertSchema(schema, data) {
  const result = validateAgainstSchema(schema, data);
  if (!result.ok) {
    throw new BrainError(CODES.schema_mismatch, 'Structured output failed schema validation', {
      details: { errors: result.errors },
      retryable: true
    });
  }
}

module.exports = { validateAgainstSchema, assertSchema };
