'use strict';

/** Layout Composer feature flag (server). Set LAYOUT_COMPOSER=1 to enable entry UI. */

function isLayoutComposerEnabled(env) {
  env = env || process.env;
  const raw = String(env.LAYOUT_COMPOSER || env.NEXT_PUBLIC_LAYOUT_COMPOSER || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function layoutComposerFlagPayload(env) {
  const enabled = isLayoutComposerEnabled(env);
  return {
    ok: true,
    enabled: enabled,
    flag: 'LAYOUT_COMPOSER',
    entryPath: '/layout-composer',
    phase: 2,
    note: enabled
      ? 'Layout Composer entry is enabled (Phase 2 stub). Existing create flows remain available.'
      : 'Layout Composer entry is off. Use manage / partner create flows as today.',
  };
}

module.exports = {
  isLayoutComposerEnabled,
  layoutComposerFlagPayload,
};
