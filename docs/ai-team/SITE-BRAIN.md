# Site Brain / Site Knowledge

Per-site durable knowledge and specialist memory for the AI Website Team.

## Site Knowledge is not copy

Site Knowledge stores **approved business truth**:

- Business goal
- Preferred CTA (intent)
- Target audience
- Brand tone
- Service areas
- Services
- Restrictions / offers

| Owner | Owns |
|-------|------|
| Site Knowledge | Facts the business approved |
| Echo | Generated website copy |
| Forge | Configuration implementation |
| Atlas | Recommendations from those facts |

Do **not** treat generated page copy as permanent Site Knowledge.

## Persistence

| Mode | When |
|------|------|
| Database | Deployed envs; `SITE_BRAIN_STORAGE=database` |
| Memory | `NODE_ENV=test` / `SITE_BRAIN_TEST=1`, or explicit local `SITE_BRAIN_STORAGE=memory` |

Apply `db/site_brain.sql` before using Site Brain in preview/production.

## Bootstrap

1. First open syncs from `sites.config` (`api/site-brain/sync`).  
2. Interpretive fields are `needs-confirmation` / inferred.  
3. User completes **Site Knowledge** (form and/or Atlas guided chat).  
4. Confirmed fields become `verified` via `api/site-brain/bootstrap-review`.

Field guide: `lib/ai-team/site-knowledge-fields.js` (`kind: business_fact`).

## Snapshot extras (Phase 2)

- `executionPlans[]` — Forge Execution Plans
- `configRollbackSnapshots[]` — pre-apply config for rollback

See [SITE-BRAIN-SCHEMA](SITE-BRAIN-SCHEMA.md) and [EXECUTION](EXECUTION.md).
