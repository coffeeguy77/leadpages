# Platform Capability Registry

**Authority:** real App Marketplace + install system + editor + production renderer + save/reload.  
**Not authority:** Website Composer `catalogue-data.json` / `app-metadata.js` (secondary comparison only).

Implementation: `lib/ai-team/capability-registry.js`

## Inclusion rules (execution allowlist — future)

An app may be execution-allowlisted only when verified:

1. Exists in real App Marketplace (`app_registry` / catalog seed)
2. Installable via normal `site_apps` system
3. Has normal editor controls in `manage.html`
4. Has production renderer (`trade` / landing shell)
5. Fields save and reload correctly
6. Editable without Website Studio
7. Tenant/permission behaviour understood

Phase 1 sets `executableActions: []` and `isExecutableCapability() → false` for all.

## Evidence sources used

- `api/api-apps.js`, `api/api-site-apps.js`
- `lib/marketplace-catalog-seed.js`
- `manage.html` TRADE_SUBTABS, App Marketplace, section editors
- `trade.template.json`, `landing-shell-neutral-v1.template.json`
- `sites.config.sections*` persistence

## Exclusions

Virtual / Composer-only / Studio preview-only candidates are listed in `VIRTUAL_OR_COMPOSER_EXCLUSIONS`. Atlas may describe unsupported needs as **capability gaps**, never as executable actions.
