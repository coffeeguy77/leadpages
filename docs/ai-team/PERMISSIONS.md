# Permissions

`lib/ai-team/permissions.js`

| Action | Roles (Phase 1) |
|--------|-----------------|
| `view_brain` | client, broker, partner, super |
| `sync_brain` / `bootstrap_review` | client, broker, partner, super |
| `atlas_review` | client, broker, partner, super |
| `approve_recommendation` | client, broker, partner, super |
| `diagnostics` | super only |

Site access still goes through existing `assertSiteAccess`. Website Studio remains superuser-only (On Ice).
