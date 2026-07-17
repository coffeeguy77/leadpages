'use strict';

const { BrainError, CODES } = require('../errors');

const VAR_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

/**
 * Render a template with explicit {{variables}}.
 * Unknown or missing variables fail closed.
 *
 * @param {string} template
 * @param {Record<string, unknown>} variables
 * @param {string[]} [declared] — if set, only these keys are allowed
 * @returns {string}
 */
function renderTemplate(template, variables, declared) {
  const vars = variables && typeof variables === 'object' ? variables : {};
  const allowed = Array.isArray(declared) ? new Set(declared) : null;
  const used = new Set();

  const out = String(template || '').replace(VAR_RE, (_m, name) => {
    const key = String(name);
    if (allowed && !allowed.has(key)) {
      throw new BrainError(CODES.bad_request, 'Unknown prompt variable: ' + key, {
        details: { variable: key, allowed: declared }
      });
    }
    if (!Object.prototype.hasOwnProperty.call(vars, key)) {
      throw new BrainError(CODES.bad_request, 'Missing prompt variable: ' + key, {
        details: { variable: key }
      });
    }
    used.add(key);
    const val = vars[key];
    if (val == null) return '';
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      return String(val);
    }
    return JSON.stringify(val);
  });

  return out;
}

/**
 * Collect variable names referenced in a template.
 * @param {string} template
 * @returns {string[]}
 */
function listTemplateVariables(template) {
  const found = new Set();
  String(template || '').replace(VAR_RE, (_m, name) => {
    found.add(String(name));
    return '';
  });
  return [...found];
}

module.exports = { renderTemplate, listTemplateVariables, VAR_RE };
