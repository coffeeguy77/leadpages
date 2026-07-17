'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createBrain,
  createMockAdapter,
  BrainError,
  CODES,
  withRetries,
  isTaskDisabled,
} = require('../lib/brain');

describe('LeadPages Brain Phase 4 — resilience', () => {
  it('retries retryable provider errors then succeeds', async () => {
    let calls = 0;
    const { value, attempts } = await withRetries(
      async () => {
        calls += 1;
        if (calls < 2) {
          throw new BrainError(CODES.provider_rate_limit, 'slow', { retryable: true });
        }
        return 'ok';
      },
      { maxRetries: 2, retryBackoffMs: 0 }
    );
    assert.equal(value, 'ok');
    assert.equal(attempts, 2);
    assert.equal(calls, 2);
  });

  it('does not retry non-retryable errors', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withRetries(
          async () => {
            calls += 1;
            throw new BrainError(CODES.bad_request, 'nope');
          },
          { maxRetries: 3, retryBackoffMs: 0 }
        ),
      (err) => err instanceof BrainError && err.code === CODES.bad_request
    );
    assert.equal(calls, 1);
  });

  it('gateway retries primary before fallback', async () => {
    let primaryCalls = 0;
    const flaky = {
      id: 'flaky',
      capabilities() {
        return new Set(['text']);
      },
      async healthCheck() {
        return { ok: true };
      },
      async generate() {
        primaryCalls += 1;
        throw new BrainError(CODES.provider_unavailable, 'boom', { retryable: true });
      },
    };

    const brain = createBrain({
      adapters: {
        flaky,
        mock: createMockAdapter(),
      },
      config: {
        resilience: { maxRetries: 1, retryBackoffMs: 0 },
        models: {
          'flaky:one': { provider: 'flaky', model: 'f1', maxTokens: 100 },
          'mock:default': { provider: 'mock', model: 'mock-default', maxTokens: 100 },
        },
        routes: {
          'generic.fast': {
            taskId: 'generic.fast',
            primary: { provider: 'flaky', model: 'f1' },
            fallback: [{ provider: 'mock', model: 'mock-default' }],
          },
        },
      },
    });

    const res = await brain.generate({
      taskId: 'generic.fast',
      messages: [{ role: 'user', content: 'hello' }],
    });
    assert.equal(res.ok, true);
    assert.equal(res.routing.fallbackUsed, true);
    assert.equal(primaryCalls, 2); // initial + 1 retry
    assert.equal(res.model.provider, 'mock');
  });
});

describe('LeadPages Brain Phase 4 — flags', () => {
  it('detects disabled tasks from config', () => {
    assert.equal(
      isTaskDisabled(
        {
          flags: { disabledTasks: ['help.answer'] },
          routes: {},
        },
        'help.answer'
      ),
      true
    );
  });

  it('rejects disabled tasks at the gateway', async () => {
    const brain = createBrain({
      config: {
        flags: { disabledTasks: ['help.answer'] },
        models: {
          'mock:fast': { provider: 'mock', model: 'mock-fast', maxTokens: 100 },
        },
        routes: {
          'help.answer': {
            taskId: 'help.answer',
            primary: { provider: 'mock', model: 'mock-fast' },
          },
        },
      },
    });
    const res = await brain.generate({
      taskId: 'help.answer',
      input: 'How do I publish?',
    });
    assert.equal(res.ok, false);
    assert.equal(res.error.code, CODES.forbidden);
    assert.match(res.error.message, /disabled/i);
  });

  it('honours route.enabled=false', async () => {
    const brain = createBrain({
      config: {
        models: {
          'mock:default': { provider: 'mock', model: 'mock-default', maxTokens: 100 },
        },
        routes: {
          'generic.reason': {
            taskId: 'generic.reason',
            primary: { provider: 'mock', model: 'mock-default' },
            enabled: false,
          },
        },
      },
    });
    const res = await brain.generate({
      taskId: 'generic.reason',
      input: 'x',
    });
    assert.equal(res.ok, false);
    assert.equal(res.error.code, CODES.forbidden);
  });
});

describe('LeadPages Brain Phase 4 — soft budgets', () => {
  it('blocks calls over maxOutputTokensPerCall', async () => {
    const brain = createBrain({
      config: {
        budgets: { maxOutputTokensPerCall: 50 },
        models: {
          'mock:default': { provider: 'mock', model: 'mock-default', maxTokens: 1000 },
        },
        routes: {
          'generic.reason': {
            taskId: 'generic.reason',
            primary: { provider: 'mock', model: 'mock-default' },
            maxTokens: 500,
          },
        },
      },
    });
    const res = await brain.generate({
      taskId: 'generic.reason',
      input: 'x',
    });
    assert.equal(res.ok, false);
    assert.equal(res.error.code, CODES.rate_limited);
    assert.match(res.error.message, /budget/i);
  });

  it('honours onBudgetCheck rejection', async () => {
    const brain = createBrain({
      onBudgetCheck: () => ({ allow: false, reason: 'daily cap' }),
      config: {
        budgets: { maxOutputTokensPerCall: 10000 },
        models: {
          'mock:default': { provider: 'mock', model: 'mock-default', maxTokens: 100 },
        },
        routes: {
          'generic.reason': {
            taskId: 'generic.reason',
            primary: { provider: 'mock', model: 'mock-default' },
            maxTokens: 100,
          },
        },
      },
    });
    const res = await brain.generate({
      taskId: 'generic.reason',
      input: 'x',
    });
    assert.equal(res.ok, false);
    assert.equal(res.error.code, CODES.rate_limited);
    assert.match(res.error.message, /daily cap/);
  });
});
