'use strict';

/**
 * Theme Studio V1 access policy (architecture only — not wired to HTTP routes yet).
 *
 * V1 audience: Superusers + Partners.
 * Normal client accounts must be denied even if they discover a URL.
 * Client enablement later should flip ROLE_POLICY.client without restructuring.
 */

/** @type {Readonly<{ superuser: boolean, partner: boolean, client: boolean }>} */
const ROLE_POLICY = Object.freeze({
  superuser: true,
  partner: true,
  client: false
});

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

  if (isSuper && ROLE_POLICY.superuser) {
    return { allowed: true, reason: 'superuser', audience: 'superuser' };
  }
  if (isPartner && ROLE_POLICY.partner) {
    return { allowed: true, reason: 'partner', audience: 'partner' };
  }
  if (isClient && !ROLE_POLICY.client) {
    return {
      allowed: false,
      reason: 'client_disabled_in_v1',
      audience: 'client'
    };
  }
  if (isClient && ROLE_POLICY.client) {
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
  describeClientEnablement
};
