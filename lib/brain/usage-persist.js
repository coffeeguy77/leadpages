'use strict';

/**
 * Durable Brain usage ledger (Supabase ai_requests).
 * Fire-and-forget from platform onUsage — never block feature paths.
 */

const { costFromUsage } = require('./pricing');

let _admin = null;

function getAdmin() {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  let createClient;
  try {
    createClient = require('@supabase/supabase-js').createClient;
  } catch (_e) {
    return null;
  }
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

/** @param {unknown} v @returns {string|null} */
function strOrNull(v) {
  if (v == null || v === '') return null;
  return String(v);
}

/** @param {unknown} v @returns {string|null} */
function uuidOrNull(v) {
  const s = strOrNull(v);
  if (!s) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
    ? s
    : null;
}

/**
 * Map a gateway usage event → ai_requests row.
 * @param {object} event
 */
function eventToRow(event) {
  const e = event || {};
  const actor = e.actor && typeof e.actor === 'object' ? e.actor : {};
  const priced = costFromUsage({
    provider: e.provider,
    model: e.model,
    inputTokens: e.inputTokens,
    outputTokens: e.outputTokens,
    cachedTokens: e.cachedTokens
  });
  // Prefer gateway-computed costUsd when present (already priced).
  const costUsd =
    e.costUsd != null && !Number.isNaN(Number(e.costUsd))
      ? Number(e.costUsd)
      : priced.usd;

  return {
    correlation_id: strOrNull(e.correlationId),
    actor_user_id: uuidOrNull(actor.userId || actor.user_id),
    partner_id: uuidOrNull(actor.partnerId || actor.partner_id),
    site_id: strOrNull(e.siteId),
    task_id: String(e.taskId || 'unknown'),
    prompt_id: strOrNull(e.promptId),
    prompt_version:
      e.promptVersion != null && e.promptVersion !== ''
        ? Number(e.promptVersion)
        : null,
    provider: strOrNull(e.provider),
    model: strOrNull(e.model),
    input_tokens: Math.max(0, Number(e.inputTokens) || 0),
    output_tokens: Math.max(0, Number(e.outputTokens) || 0),
    cached_tokens: Math.max(0, Number(e.cachedTokens) || 0),
    cost_usd: costUsd,
    latency_ms: e.latencyMs != null ? Number(e.latencyMs) || null : null,
    success: e.success !== false,
    error_code: strOrNull(e.errorCode),
    fallback_used: !!e.fallbackUsed,
    meta: {
      pricingLabel: priced.rate.label,
      reasonCodes: e.reasonCodes || null,
      attempts: e.attempts != null ? e.attempts : null
    }
  };
}

/**
 * Persist one usage event. Safe to call without awaiting.
 * @param {object} event
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
 */
async function persistUsageEvent(event) {
  const admin = getAdmin();
  if (!admin) return { ok: false, skipped: true, error: 'no_supabase' };

  const row = eventToRow(event);
  try {
    if (row.correlation_id) {
      const { error } = await admin
        .from('ai_requests')
        .upsert(row, { onConflict: 'correlation_id', ignoreDuplicates: false });
      if (error) {
        // Unique partial index may not map to onConflict in all PG versions — fall back to insert.
        if (/no unique|on conflict/i.test(error.message || '')) {
          const ins = await admin.from('ai_requests').insert(row);
          if (ins.error) return { ok: false, error: ins.error.message };
          return { ok: true };
        }
        return { ok: false, error: error.message };
      }
      return { ok: true };
    }
    const { error } = await admin.from('ai_requests').insert(row);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err && err.message) || 'persist_failed' };
  }
}

/**
 * @param {object} [opts]
 * @param {number} [opts.limit]
 * @param {number} [opts.days]
 */
async function loadDurableUsage(opts) {
  const options = opts || {};
  const limit = typeof options.limit === 'number' ? options.limit : 40;
  const days = typeof options.days === 'number' ? options.days : 30;
  const admin = getAdmin();
  if (!admin) {
    return {
      ok: false,
      available: false,
      error: 'no_supabase',
      notice: 'SUPABASE_URL / SERVICE_ROLE not configured — durable usage unavailable.'
    };
  }

  const since = new Date(Date.now() - days * 864e5).toISOString();

  try {
    const { data, error } = await admin
      .from('ai_requests')
      .select(
        'id,correlation_id,created_at,task_id,provider,model,input_tokens,output_tokens,cached_tokens,cost_usd,latency_ms,success,error_code,fallback_used,site_id,prompt_id'
      )
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) {
      const missing = /relation .* does not exist|Could not find the table/i.test(
        error.message || ''
      );
      return {
        ok: false,
        available: false,
        error: error.message,
        notice: missing
          ? 'Run db/ai_requests.sql in Supabase to enable durable AI cost tracking.'
          : 'Could not load ai_requests: ' + error.message
      };
    }

    const rows = Array.isArray(data) ? data : [];
    /** @type {Record<string, { calls: number, failures: number, inputTokens: number, outputTokens: number, costUsd: number }>} */
    const byProvider = Object.create(null);
    /** @type {Record<string, { calls: number, failures: number, inputTokens: number, outputTokens: number, costUsd: number }>} */
    const byTask = Object.create(null);
    let totalCostUsd = 0;
    let failures = 0;

    for (const r of rows) {
      const cost = Number(r.cost_usd) || 0;
      totalCostUsd += cost;
      if (r.success === false) failures += 1;

      const prov = String(r.provider || 'unknown');
      if (!byProvider[prov]) {
        byProvider[prov] = {
          calls: 0,
          failures: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0
        };
      }
      byProvider[prov].calls += 1;
      if (r.success === false) byProvider[prov].failures += 1;
      byProvider[prov].inputTokens += Number(r.input_tokens) || 0;
      byProvider[prov].outputTokens += Number(r.output_tokens) || 0;
      byProvider[prov].costUsd += cost;

      const task = String(r.task_id || 'unknown');
      if (!byTask[task]) {
        byTask[task] = {
          calls: 0,
          failures: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0
        };
      }
      byTask[task].calls += 1;
      if (r.success === false) byTask[task].failures += 1;
      byTask[task].inputTokens += Number(r.input_tokens) || 0;
      byTask[task].outputTokens += Number(r.output_tokens) || 0;
      byTask[task].costUsd += cost;
    }

    // Round aggregates for display
    const round = (n) => Math.round(n * 1e6) / 1e6;
    totalCostUsd = round(totalCostUsd);
    for (const k of Object.keys(byProvider)) byProvider[k].costUsd = round(byProvider[k].costUsd);
    for (const k of Object.keys(byTask)) byTask[k].costUsd = round(byTask[k].costUsd);

    const recent = rows.slice(0, limit).map((r) => ({
      id: r.id,
      correlationId: r.correlation_id,
      recordedAt: r.created_at,
      taskId: r.task_id,
      provider: r.provider,
      model: r.model,
      success: r.success !== false,
      errorCode: r.error_code,
      latencyMs: r.latency_ms,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      cachedTokens: r.cached_tokens,
      costUsd: Number(r.cost_usd) || 0,
      siteId: r.site_id,
      fallbackUsed: !!r.fallback_used
    }));

    const recentFailures = recent.filter((e) => e.success === false).slice(0, 20);

    return {
      ok: true,
      available: true,
      days,
      totalEvents: rows.length,
      failures,
      totalCostUsd,
      byProvider,
      byTask,
      recent,
      recentFailures,
      notice:
        'Durable ledger (last ' +
        days +
        ' days). Costs = actual tokens × published model rates — ops forecast, not the provider invoice.'
    };
  } catch (err) {
    return {
      ok: false,
      available: false,
      error: (err && err.message) || 'load_failed',
      notice: 'Could not load durable AI usage.'
    };
  }
}

/** Test helper */
function resetUsagePersistClient() {
  _admin = null;
}

module.exports = {
  eventToRow,
  persistUsageEvent,
  loadDurableUsage,
  resetUsagePersistClient,
  getAdmin
};
