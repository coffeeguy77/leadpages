'use strict';

const { BrainError, CODES } = require('../errors');
const { DEFAULT_PROMPTS } = require('./defaults');
const { renderTemplate, listTemplateVariables } = require('./render');

/**
 * @typedef {object} PromptDefinition
 * @property {string} promptId
 * @property {number} version
 * @property {string} taskId
 * @property {'draft'|'active'|'deprecated'} status
 * @property {string} system
 * @property {string} user
 * @property {string[]} variables
 * @property {string|null} [outputSchemaRef]
 * @property {string} [changelog]
 * @property {string} [owner]
 */

/**
 * @param {PromptDefinition[]} [definitions]
 */
function createPromptRegistry(definitions) {
  /** @type {Map<string, PromptDefinition[]>} */
  const byId = new Map();

  function ingest(list) {
    for (const def of list || []) {
      validateDefinition(def);
      const arr = byId.get(def.promptId) || [];
      const idx = arr.findIndex((d) => d.version === def.version);
      if (idx >= 0) arr[idx] = Object.freeze({ ...def });
      else arr.push(Object.freeze({ ...def }));
      arr.sort((a, b) => a.version - b.version);
      byId.set(def.promptId, arr);
    }
  }

  ingest(definitions != null ? definitions : DEFAULT_PROMPTS);

  /**
   * @param {string} promptId
   * @param {number} [version]
   * @returns {PromptDefinition}
   */
  function get(promptId, version) {
    const versions = byId.get(promptId);
    if (!versions || !versions.length) {
      throw new BrainError(CODES.bad_request, 'Unknown promptId: ' + promptId);
    }
    if (version != null) {
      const found = versions.find((d) => d.version === version);
      if (!found) {
        throw new BrainError(
          CODES.bad_request,
          'Unknown prompt version: ' + promptId + '@' + version
        );
      }
      return found;
    }
    const active = versions.filter((d) => d.status === 'active');
    if (!active.length) {
      throw new BrainError(CODES.bad_request, 'No active version for promptId: ' + promptId);
    }
    return active[active.length - 1];
  }

  /**
   * @param {string} [promptId]
   */
  function list(promptId) {
    if (promptId) return [...(byId.get(promptId) || [])];
    /** @type {PromptDefinition[]} */
    const all = [];
    for (const versions of byId.values()) all.push(...versions);
    return all;
  }

  /**
   * @param {string} promptId
   * @param {Record<string, unknown>} variables
   * @param {{ version?: number }} [opts]
   */
  function render(promptId, variables, opts) {
    const def = get(promptId, opts && opts.version);
    const declared = def.variables || [];
    // Fail if template references undeclared vars.
    for (const name of [
      ...listTemplateVariables(def.system),
      ...listTemplateVariables(def.user)
    ]) {
      if (!declared.includes(name)) {
        throw new BrainError(
          CODES.config_invalid,
          'Prompt ' + promptId + '@' + def.version + ' uses undeclared variable: ' + name
        );
      }
    }
    return {
      promptId: def.promptId,
      version: def.version,
      taskId: def.taskId,
      status: def.status,
      outputSchemaRef: def.outputSchemaRef || null,
      system: renderTemplate(def.system, variables, declared),
      user: renderTemplate(def.user, variables, declared),
      variables: { ...variables }
    };
  }

  /**
   * @param {PromptDefinition} def
   */
  function register(def) {
    ingest([def]);
    return get(def.promptId, def.version);
  }

  return { get, list, render, register };
}

/**
 * @param {PromptDefinition} def
 */
function validateDefinition(def) {
  if (!def || typeof def !== 'object') {
    throw new BrainError(CODES.config_invalid, 'Prompt definition must be an object');
  }
  if (!def.promptId || typeof def.promptId !== 'string') {
    throw new BrainError(CODES.config_invalid, 'promptId is required');
  }
  if (typeof def.version !== 'number' || !Number.isFinite(def.version)) {
    throw new BrainError(CODES.config_invalid, 'version must be a number');
  }
  if (!def.taskId || typeof def.taskId !== 'string') {
    throw new BrainError(CODES.config_invalid, 'taskId is required');
  }
  if (!['draft', 'active', 'deprecated'].includes(def.status)) {
    throw new BrainError(CODES.config_invalid, 'status must be draft|active|deprecated');
  }
  if (typeof def.system !== 'string' || typeof def.user !== 'string') {
    throw new BrainError(CODES.config_invalid, 'system and user templates are required');
  }
  if (!Array.isArray(def.variables)) {
    throw new BrainError(CODES.config_invalid, 'variables must be an array');
  }
}

module.exports = { createPromptRegistry, validateDefinition };
