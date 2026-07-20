# Site Brain

Per-site durable knowledge and specialist memory for the AI Website Team.

## Persistence

| Mode | When |
|------|------|
| Database | Deployed envs; `SITE_BRAIN_STORAGE=database` |
| Memory | `NODE_ENV=test` / `SITE_BRAIN_TEST=1`, or explicit local `SITE_BRAIN_STORAGE=memory` |

Apply `db/site_brain.sql` before using Site Brain in preview/production.

## Bootstrap

1. First open syncs from `sites.config` (`api/site-brain/sync`).  
2. Interpretive fields are `needs-confirmation` / inferred.  
3. User completes **Site Knowledge review** (not raw JSON).  
4. Confirmed fields become `verified` via `api/site-brain/bootstrap-review`.

## Review fields

Business name, industry, main services, target audience, primary goal, service areas, preferred CTA, brand tone, content restrictions.

## APIs

| Endpoint | Purpose |
|----------|---------|
| `POST /api/site-brain/get` | Load brain + review payload |
| `POST /api/site-brain/sync` | Sync from website config |
| `POST /api/site-brain/bootstrap-review` | Confirm/correct imported knowledge |

See [SITE-BRAIN-SCHEMA](SITE-BRAIN-SCHEMA.md).
