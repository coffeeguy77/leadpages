'use strict';

const { BrainError, CODES } = require('../errors');
const { V1_SLICES, extractSlice, redactSecrets } = require('./slices');

/**
 * Default authorizer — no DB. Caller supplies site (+ optional partner).
 * Super admins always allowed. Owners and linked partners allowed when IDs match.
 *
 * @param {{ actor?: import('../types').BrainActor, site: object }} args
 */
function defaultAuthorize(args) {
  const actor = args.actor || {};
  const site = args.site || {};
  const role = String(actor.role || '').toLowerCase();
  if (role === 'super' || role === 'super_admin' || actor.isSuperAdmin) return { ok: true };
  if (actor.userId && site.owner_user_id && String(actor.userId) === String(site.owner_user_id)) {
    return { ok: true };
  }
  if (
    actor.partnerId &&
    (String(actor.partnerId) === String(site.servicing_partner_id || '') ||
      String(actor.partnerId) === String(site.referring_partner_id || ''))
  ) {
    return { ok: true };
  }
  // Allow anonymous/system callers only when explicitly marked.
  if (role === 'system' || role === 'cron') return { ok: true };
  return { ok: false, reason: 'actor cannot access site' };
}

/**
 * @param {object} [opts]
 * @param {(args: { actor?: object, site: object }) => { ok: boolean, reason?: string }} [opts.authorize]
 * @param {number} [opts.maxChars] — soft bound on serialized context size
 */
function createContextResolver(opts) {
  const options = opts || {};
  const authorize = options.authorize || defaultAuthorize;
  const maxChars = typeof options.maxChars === 'number' ? options.maxChars : 12000;

  /**
   * @param {object} input
   * @param {string} [input.siteId]
   * @param {object} [input.site] — preloaded sites row (required in Phase 3; no DB fetch)
   * @param {import('../types').BrainActor} [input.actor]
   * @param {string[]} input.slices
   * @param {object} [input.partner]
   * @param {object} [input.adsSummary] — redacted Google Ads overview for ads.summary
   */
  function resolve(input) {
    if (!input || typeof input !== 'object') {
      throw new BrainError(CODES.bad_request, 'Context resolve input is required');
    }
    const slices = Array.isArray(input.slices) ? input.slices : [];
    if (!slices.length) {
      throw new BrainError(CODES.bad_request, 'contextSlices is required');
    }
    for (const slice of slices) {
      if (!V1_SLICES.includes(slice)) {
        throw new BrainError(CODES.bad_request, 'Unknown or unsupported context slice: ' + slice, {
          details: { slice, allowed: V1_SLICES }
        });
      }
    }

    const site = input.site;
    if (!site || typeof site !== 'object') {
      throw new BrainError(
        CODES.bad_request,
        'site object is required for context resolution in Phase 3 (no DB fetch yet)'
      );
    }
    if (input.siteId && site.id && String(input.siteId) !== String(site.id)) {
      throw new BrainError(CODES.forbidden, 'siteId does not match provided site');
    }

    const auth = authorize({ actor: input.actor, site });
    if (!auth || !auth.ok) {
      throw new BrainError(CODES.forbidden, (auth && auth.reason) || 'Context access denied', {
        details: { siteId: site.id || input.siteId || null }
      });
    }

    /** @type {Record<string, unknown>} */
    const context = {};
    for (const slice of slices) {
      const extracted = extractSlice(site, slice, {
        partner: input.partner,
        adsSummary: input.adsSummary
      });
      context[slice] = redactSecrets(extracted);
    }

    const serialized = JSON.stringify(context);
    if (serialized.length > maxChars) {
      throw new BrainError(CODES.bad_request, 'Resolved context exceeds size bound', {
        details: { chars: serialized.length, maxChars }
      });
    }

    return {
      siteId: site.id || input.siteId || null,
      slices: [...slices],
      context,
      meta: {
        freshness: 'request-time',
        redacted: true,
        chars: serialized.length
      }
    };
  }

  return { resolve, allowedSlices: () => [...V1_SLICES] };
}

module.exports = { createContextResolver, defaultAuthorize };
