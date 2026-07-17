'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { costFromUsage, resolveModelRate } = require('../lib/brain/pricing');
const { eventToRow } = require('../lib/brain/usage-persist');

describe('Brain pricing', () => {
  it('prices Claude Sonnet from actual tokens', () => {
    const rate = resolveModelRate('anthropic', 'claude-sonnet-4-6');
    assert.equal(rate.inputPerMTok, 3);
    assert.equal(rate.outputPerMTok, 15);

    // 1M in + 1M out = $3 + $15 = $18
    const big = costFromUsage({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000
    });
    assert.equal(big.usd, 18);

    // Typical landing draft-ish: 4k in / 3k out → $0.012 + $0.045 = $0.057
    const draft = costFromUsage({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      inputTokens: 4000,
      outputTokens: 3000
    });
    assert.ok(draft.usd > 0.05 && draft.usd < 0.06);
  });

  it('treats mock as free', () => {
    const c = costFromUsage({
      provider: 'mock',
      model: 'mock-default',
      inputTokens: 99999,
      outputTokens: 99999
    });
    assert.equal(c.usd, 0);
  });

  it('applies cached-input discount when cachedTokens present', () => {
    const full = costFromUsage({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      inputTokens: 100_000,
      outputTokens: 0,
      cachedTokens: 0
    });
    const cached = costFromUsage({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      inputTokens: 100_000,
      outputTokens: 0,
      cachedTokens: 100_000
    });
    assert.ok(cached.usd < full.usd);
  });

  it('maps usage events to ai_requests rows', () => {
    const row = eventToRow({
      correlationId: 'corr-1',
      taskId: 'content.landing_draft',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      inputTokens: 1000,
      outputTokens: 500,
      success: true,
      actor: { userId: 'not-a-uuid', partnerId: '11111111-1111-4111-8111-111111111111' },
      siteId: 'site-abc'
    });
    assert.equal(row.correlation_id, 'corr-1');
    assert.equal(row.task_id, 'content.landing_draft');
    assert.equal(row.actor_user_id, null);
    assert.equal(row.partner_id, '11111111-1111-4111-8111-111111111111');
    assert.ok(row.cost_usd > 0);
    assert.equal(row.site_id, 'site-abc');
  });
});

describe('Brain gateway records actual costUsd', () => {
  it('usage envelope uses token×price not maxTokens budget', async () => {
    const { createBrain } = require('../lib/brain');
    const events = [];
    const brain = createBrain({
      onUsage: (e) => events.push(e),
      mock: {
        structuredFixture: null
      }
    });
    const res = await brain.generate({
      taskId: 'generic.fast',
      input: 'hello billing'
    });
    assert.equal(res.ok, true);
    assert.equal(events.length, 1);
    assert.equal(events[0].provider, 'mock');
    assert.equal(events[0].costUsd, 0);
    assert.equal(res.usage.costUsdEstimate, 0);
  });

  it('awaits onUsage when it returns a Promise', async () => {
    const { createBrain } = require('../lib/brain');
    let settled = false;
    const brain = createBrain({
      onUsage: async () => {
        await new Promise((r) => setTimeout(r, 40));
        settled = true;
      }
    });
    const res = await brain.generate({
      taskId: 'generic.fast',
      input: 'await usage hook'
    });
    assert.equal(res.ok, true);
    assert.equal(settled, true);
  });
});
