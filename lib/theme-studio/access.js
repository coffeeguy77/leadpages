'use strict';

/**
 * Website Studio access policy.
 *
 * Status: Experimental / On Ice — superuser pilot only.
 * Partners and clients are denied. Re-enablement requires explicit product approval.
 * WEBSITE_STUDIO_PILOT_SUPERUSER_ONLY remains supported (redundant while ROLE_POLICY
 * already denies partners/clients).
 */

/**
 * Freeze default: superuser only. Partners/clients stay OFF.
 */
const ROLE_POLICY = Object.freeze({
  superuser: true,
  partner: false,
  client: false
});

function isPilotSuperuserOnly() {
  const env = String(process.env.WEBSITE_STUDIO_PILOT_SUPERUSER_ONLY || '0').toLowerCase();
  return env === '1' || env === 'true' || env === 'on';
}

function effectiveRolePolicy() {
  // On Ice: always deny partners/clients regardless of pilot env.
  // Pilot env may still be set for ops clarity; it cannot widen audience.
  if (isPilotSuperuserOnly()) {
    return { superuser: true, partner: false, client: false };
  }
  return ROLE_POLICY;
}

/**
 * @typedef {{
 *   isSuperuser?: boolean,
 *   isPartner?: boolean,
 *   isClient?: boolean,
 *   roles?: string[],
 *   role?: string
 * }} ThemeStudioActor
 */

/**
 * Resolve whether an actor may use Theme Studio V1.
 * Does not hide links — callers must enforce this on API routes.
 *
 * @param {ThemeStudioActor|null|undefined} actor
 * @returns {{ allowed: boolean, reason: string, audience: string }}
 */
function canAccessThemeStudio(actor) {
  if (!actor || typeof actor !== 'object') {
    return { allowed: false, reason: 'unauthenticated', audience: 'none' };
  }

  const roles = new Set(
    [
      ...(Array.isArray(actor.roles) ? actor.roles : []),
      actor.role
    ]
      .filter(Boolean)
      .map((r) => String(r).toLowerCase())
  );

  const isSuper =
    actor.isSuperuser === true ||
    roles.has('super') ||
    roles.has('superuser') ||
    roles.has('admin');

  const isPartner =
    actor.isPartner === true ||
    roles.has('partner');

  const isClient =
    actor.isClient === true ||
    roles.has('client') ||
    roles.has('owner') ||
    roles.has('site_owner');

  const policy = effectiveRolePolicy();

  if (isSuper && policy.superuser) {
    return { allowed: true, reason: 'superuser', audience: 'superuser' };
  }
  if (isPartner && !policy.partner) {
    return {
      allowed: false,
      reason: 'partner_disabled_in_pilot',
      audience: 'partner'
    };
  }
  if (isPartner && policy.partner) {
    return { allowed: true, reason: 'partner', audience: 'partner' };
  }
  if (isClient && !policy.client) {
    return {
      allowed: false,
      reason: isPilotSuperuserOnly() ? 'client_disabled_in_pilot' : 'client_disabled_in_v1',
      audience: 'client'
    };
  }
  if (isClient && policy.client) {
    return { allowed: true, reason: 'client', audience: 'client' };
  }

  return { allowed: false, reason: 'role_not_permitted', audience: 'none' };
}

/**
 * Future flag helper: enable client access without restructuring modules.
 * @param {boolean} enabled
 */
function describeClientEnablement(enabled) {
  return {
    policyKey: 'ROLE_POLICY.client',
    enabled: !!enabled,
    note:
      'Flip ROLE_POLICY.client (or a durable brain_settings / env flag in Phase 3) to admit clients; keep canAccessThemeStudio as the single gate.'
  };
}

module.exports = {
  ROLE_POLICY,
  canAccessThemeStudio,
  describeClientEnablement,
  isPilotSuperuserOnly,
  effectiveRolePolicy
};
