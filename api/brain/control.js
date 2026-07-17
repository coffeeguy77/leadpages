'use strict';

/**
 * AI Control Centre API — super-admin only.
 * GET  /api/brain/control — status (providers, routes, usage, flags)
 * POST /api/brain/control — actions: health, disable_task, enable_task, test_generate
 *
 * Secrets: never echoed. Health returns configured yes/no only.
 */

const { requireSuper, readBody, json } = require('../billing/_admin-auth');
const { getPlatformBrain, resetPlatformBrain } = require('../../lib/brain/platform');
const { getDefaultUsageStore } = require('../../lib/brain/usage-store');

const PROVIDER_ENV = {
  mock: null,
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY'
};

function keyStatus(envName) {
  if (!envName) return { configured: true, hint: 'n/a' };
  const raw = process.env[envName] || '';
  if (!raw) return { configured: false, hint: 'missing' };
  const last4 = raw.length >= 4 ? raw.slice(-4) : '****';
  return { configured: true, hint: '••••' + last4 };
}

function providerSnapshot(brain) {
  const adapters = ['mock', 'anthropic', 'openai', 'gemini'];
  return adapters.map((id) => {
    const envName = PROVIDER_ENV[id];
    const keys = keyStatus(envName);
    return {
      id,
      env: envName,
      configured: keys.configured,
      keyHint: keys.hint,
      capabilities: brain && brain.config
        ? Object.values(brain.config.models || {})
          .filter((m) => m.provider === id)
          .map((m) => m.model)
        : []
    };
  });
}

function routesSnapshot(brain) {
  const routes = (brain && brain.config && brain.config.routes) || {};
  return Object.keys(routes).sort().map((taskId) => {
    const r = routes[taskId];
    return {
      taskId,
      enabled: r.enabled !== false,
      primary: r.primary,
      fallback: r.fallback || [],
      structured: !!r.structured,
      maxTokens: r.maxTokens || null
    };
  });
}

module.exports = async function brainControl(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const user = await requireSuper(req, res);
  if (!user) return;

  const brain = getPlatformBrain();
  const store = getDefaultUsageStore();

  if (req.method === 'GET') {
    const health = {};
    for (const id of ['mock', 'anthropic', 'openai', 'gemini']) {
      try {
        health[id] = await brain.testProviderConnection(id);
      } catch (err) {
        health[id] = { ok: false, detail: (err && err.message) || 'error' };
      }
    }

    return json(res, 200, {
      ok: true,
      defaultProvider: brain.config.defaultProvider || 'mock',
      brainProviderEnv: process.env.BRAIN_PROVIDER || 'mock',
      flags: Object.assign({}, brain.config.flags || {}, {
        landingDraftEnv: process.env.BRAIN_LANDING_DRAFT || '',
        disableTasksEnv: process.env.BRAIN_DISABLE_TASKS || ''
      }),
      budgets: brain.config.budgets || {},
      resilience: brain.config.resilience || {},
      providers: providerSnapshot(brain),
      health,
      routes: routesSnapshot(brain),
      models: brain.listModels(),
      usage: store.summary(),
      recent: store.recent(40),
      recentFailures: store.recentFailures(20),
      notice:
        'Usage is process-local (serverless). Durable ai_requests table is a later upgrade. ' +
        'API keys are never returned — only configured yes/no + last-four hint.'
    });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'GET or POST only' });
  }

  const body = await readBody(req);
  const action = String(body.action || '').toLowerCase();

  if (action === 'health') {
    const provider = String(body.provider || '').toLowerCase();
    if (!provider) return json(res, 400, { ok: false, error: 'provider required' });
    try {
      const result = await brain.testProviderConnection(provider);
      return json(res, 200, { ok: true, provider, health: result });
    } catch (err) {
      return json(res, 200, {
        ok: true,
        provider,
        health: { ok: false, detail: (err && err.message) || 'error' }
      });
    }
  }

  if (action === 'disable_task' || action === 'enable_task') {
    const taskId = String(body.taskId || '').trim();
    if (!taskId || !brain.config.routes[taskId]) {
      return json(res, 400, { ok: false, error: 'unknown taskId' });
    }
    // Runtime overlay on this isolate's config (not durable across cold starts).
    if (action === 'disable_task') {
      brain.config.routes[taskId].enabled = false;
      const flags = brain.config.flags || (brain.config.flags = {});
      const list = Array.isArray(flags.disabledTasks) ? flags.disabledTasks : [];
      if (!list.includes(taskId)) list.push(taskId);
      flags.disabledTasks = list;
    } else {
      brain.config.routes[taskId].enabled = true;
      const flags = brain.config.flags || (brain.config.flags = {});
      flags.disabledTasks = (flags.disabledTasks || []).filter((t) => t !== taskId);
    }
    return json(res, 200, {
      ok: true,
      taskId,
      enabled: brain.config.routes[taskId].enabled !== false,
      notice: 'Runtime-only in this serverless isolate. Persist via BRAIN_DISABLE_TASKS env for durability.'
    });
  }

  if (action === 'test_generate') {
    const taskId = String(body.taskId || 'generic.fast');
    const result = await brain.generate({
      taskId,
      actor: { userId: user.id, role: 'super' },
      input: body.input || 'Control Centre connectivity probe'
    });
    return json(res, result.ok ? 200 : 502, {
      ok: result.ok,
      result: {
        ok: result.ok,
        taskId: result.taskId,
        model: result.model,
        output: result.output,
        error: result.error || null,
        routing: result.routing || null,
        usage: result.usage || null
      }
    });
  }

  if (action === 'clear_usage') {
    store.clear();
    return json(res, 200, { ok: true });
  }

  if (action === 'reset_brain') {
    resetPlatformBrain();
    return json(res, 200, { ok: true, notice: 'Platform brain singleton reset' });
  }

  return json(res, 400, {
    ok: false,
    error: 'unknown action',
    allowed: ['health', 'disable_task', 'enable_task', 'test_generate', 'clear_usage', 'reset_brain']
  });
};
