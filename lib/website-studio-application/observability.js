'use strict';

/**
 * Production-safe Website Studio observability (Phase 6 pilot).
 * Structured events only — no secrets, tokens, or full private briefs.
 */

const { randomUUID } = require('crypto');

/** @type {object[]} */
const recentEvents = [];
const MAX_EVENTS = 500;

function trackStudioEvent(event) {
  const row = {
    id: event.id || 'wsevt_' + randomUUID().replace(/-/g, '').slice(0, 12),
    type: event.type || 'unknown',
    ts: event.ts || new Date().toISOString(),
    actorUserId: event.actorUserId || null,
    draftId: event.draftId || null,
    conceptId: event.conceptId || null,
    versionId: event.versionId || null,
    siteId: event.siteId || null,
    durationMs: event.durationMs != null ? event.durationMs : null,
    success: event.success != null ? !!event.success : null,
    failureStage: event.failureStage || null,
    error: event.error || null,
    diagnosticId: event.diagnosticId || null,
    meta: sanitizeMeta(event.meta || {})
  };
  recentEvents.push(row);
  if (recentEvents.length > MAX_EVENTS) recentEvents.shift();

  // Structured log line for platform log drains (no secrets)
  try {
    console.info(
      JSON.stringify({
        channel: 'website_studio',
        ...row
      })
    );
  } catch {
    /* ignore */
  }
  return row;
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    const key = String(k).toLowerCase();
    if (/secret|password|token|authorization|apikey|api_key|brief\b/.test(key)) continue;
    if (typeof v === 'string' && v.length > 500) out[k] = v.slice(0, 500) + '…';
    else out[k] = v;
  }
  return out;
}

function listStudioEvents(limit) {
  return recentEvents.slice(-(limit || 100));
}

function clearStudioEvents() {
  recentEvents.length = 0;
}

function timed(type, fn, base) {
  const started = Date.now();
  return Promise.resolve()
    .then(fn)
    .then((result) => {
      trackStudioEvent({
        ...(base || {}),
        type: type + (result && result.ok === false ? '_failed' : '_completed'),
        durationMs: Date.now() - started,
        success: !(result && result.ok === false),
        error: result && result.ok === false ? result.error : null,
        diagnosticId: result && result.audit && result.audit.diagnosticId,
        failureStage: result && result.failureStage,
        siteId: (result && result.site && result.site.id) || (base && base.siteId) || null
      });
      return result;
    })
    .catch((err) => {
      trackStudioEvent({
        ...(base || {}),
        type: type + '_failed',
        durationMs: Date.now() - started,
        success: false,
        error: err && err.message ? err.message : String(err),
        failureStage: 'exception'
      });
      throw err;
    });
}

module.exports = {
  trackStudioEvent,
  listStudioEvents,
  clearStudioEvents,
  timed,
  sanitizeMeta
};
