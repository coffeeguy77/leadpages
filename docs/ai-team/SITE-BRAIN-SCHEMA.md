# Site Brain schema (v1.0)

## Tables (`db/site_brain.sql`)

- `site_brains` — one row per `site_id`; `version`, `snapshot` JSON, `bootstrap_status`
- `site_brain_events` — audit trail (propose/approve/reject/sync/observe/…)
- `site_brain_recommendations` — recommendation lifecycle rows

## Snapshot shape (high level)

- `schemaVersion`: `"1.0"`
- `siteId`, `accountId`
- Provenance facts: `{ value, status, source, confidence, updatedAt, … }`
- Domains: `business`, `offers`, `audience`, `goals`, `brand`, `marketplace`, `seo`, …
- `agentMemory.{atlas,nova,scout,…}` — namespaced; no cross-agent overwrite
- `openTasks`, `decisions`, `evidence`
- `executionPlans[]` — Forge Execution Plans (Recommendation → Preview → Apply)
- `configRollbackSnapshots[]` — pre-apply `sites.config` for one-shot rollback

Site Knowledge facts are **business truth** (`kind: business_fact` in the field guide). Generated copy belongs to Echo, not permanent Site Knowledge.

## Fact statuses

`verified` | `needs-confirmation` | `inferred` | `proposed` | `rejected` | `stale`

## Protected paths

Identity keys such as `siteId` cannot be rewritten via knowledge propose.
