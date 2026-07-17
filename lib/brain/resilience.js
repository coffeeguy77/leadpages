'use strict';

const { BrainError, CODES, isBrainError } = require('./errors');

/**
 * @typedef {object} ResiliencePolicy
 * @property {number} [maxRetries]
 * @property {number} [retryBackoffMs]
 */

/**
 * @typedef {object} BrainBudgets
 * @property {number} [maxOutputTokensPerCall]
 * @property {number} [maxEstimatedCostUsdPerCall]
 */

/**
 * @param {import('./config').BrainConfig} config
 * @returns {ResiliencePolicy}
 */
function resolveResilience(config) {
  const r = (config && config.resilience) || {};
  return {
    maxRetries: clampInt(r.maxRetries, 0, 3, 1),
    retryBackoffMs: clampInt(r.retryBackoffMs, 0, 5000, 25)
  };
}

/**
 * @param {import('./config').BrainConfig} config
 * @param {string} taskId
 */
function isTaskDisabled(config, taskId) {
  const flags = (config && config.flags) || {};
  const disabled = new Set([
    ...(Array.isArray(flags.disabledTasks) ? flags.disabledTasks : []),
    ...parseCsvEnv(process.env.BRAIN_DISABLE_TASKS)
  ]);
  if (disabled.has(taskId)) return true;
  const route = config.routes && config.routes[taskId];
  if (route && route.enabled === false) return true;
  return false;
}

/**
 * Soft budget gate before provider call.
 * @param {object} args
 * @param {import('./config').BrainConfig} args.config
 * @param {string} args.taskId
 * @param {number} [args.maxTokens]
 * @param {(info: object) => ({ allow: boolean, reason?: string }|boolean|void)|null} [args.onBudgetCheck]
 */
function assertWithinBudget(args) {
  const budgets = (args.config && args.config.budgets) || {};
  const maxTokens = args.maxTokens != null ? args.maxTokens : 0;

  if (
    typeof budgets.maxOutputTokensPerCall === 'number' &&
    maxTokens > budgets.maxOutputTokensPerCall
  ) {
    throw new BrainError(CODES.rate_limited, 'Output token budget exceeded for call', {
      details: {
        taskId: args.taskId,
        maxTokens,
        maxOutputTokensPerCall: budgets.maxOutputTokensPerCall
      }
    });
  }

  const estimateUsd = estimateCostUsd(maxTokens, budgets);
  if (
    typeof budgets.maxEstimatedCostUsdPerCall === 'number' &&
    estimateUsd > budgets.maxEstimatedCostUsdPerCall
  ) {
    throw new BrainError(CODES.rate_limited, 'Estimated cost budget exceeded for call', {
      details: {
        taskId: args.taskId,
        estimateUsd,
        maxEstimatedCostUsdPerCall: budgets.maxEstimatedCostUsdPerCall
      }
    });
  }

  if (typeof args.onBudgetCheck === 'function') {
    const verdict = args.onBudgetCheck({
      taskId: args.taskId,
      maxTokens,
      estimateUsd
    });
    if (verdict && typeof verdict === 'object' && verdict.allow === false) {
      throw new BrainError(
        CODES.rate_limited,
        verdict.reason || 'Budget check rejected call',
        { details: { taskId: args.taskId } }
      );
    }
    if (verdict === false) {
      throw new BrainError(CODES.rate_limited, 'Budget check rejected call', {
        details: { taskId: args.taskId }
      });
    }
  }

  return { estimateUsd };
}

/**
 * Rough pre-call estimate (not billing-grade).
 * @param {number} maxTokens
 * @param {BrainBudgets} budgets
 */
function estimateCostUsd(maxTokens, budgets) {
  const per1k = typeof budgets.usdPer1kOutputTokens === 'number'
    ? budgets.usdPer1kOutputTokens
    : 0.015;
  return (Math.max(0, maxTokens) / 1000) * per1k;
}

/**
 * Retry retryable BrainErrors, then rethrow.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {ResiliencePolicy} policy
 * @returns {Promise<{ value: T, attempts: number }>}
 */
async function withRetries(fn, policy) {
  const maxRetries = policy.maxRetries != null ? policy.maxRetries : 0;
  const backoffMs = policy.retryBackoffMs != null ? policy.retryBackoffMs : 0;
  let attempts = 0;
  let lastErr;
  for (let i = 0; i <= maxRetries; i++) {
    attempts = i + 1;
    try {
      const value = await fn();
      return { value, attempts };
    } catch (err) {
      lastErr = err;
      const retryable = isBrainError(err) && err.retryable;
      if (!retryable || i === maxRetries) throw err;
      if (backoffMs > 0) await sleep(backoffMs * (i + 1));
    }
  }
  throw lastErr;
}

/**
 * @param {string|undefined} raw
 * @returns {string[]}
 */
function parseCsvEnv(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 */
function clampInt(value, min, max, fallback) {
  const n = typeof value === 'number' ? value : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  resolveResilience,
  isTaskDisabled,
  assertWithinBudget,
  withRetries,
  estimateCostUsd,
  parseCsvEnv
};
