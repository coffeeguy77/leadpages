# Recommendations

Structured proposals from specialists (Phase 1: Atlas).

## Lifecycle

`proposed` → `approved` | `rejected` (status only in Phase 1)

Approve/reject does **not** apply changes to the live site.

## Shape

- title, problem, evidence, proposedChange, reason
- estimatedEffort, affectedAreas, requiredPermissions, risk
- `executable: false` in Phase 1
- `capabilityGap` when the need is unsupported by the real registry
- `guardian` validation result

## APIs

- `POST /api/ai-team/atlas-review` — generate + persist recommendations
- `GET|POST /api/ai-team/recommendations` — list / approve / reject
