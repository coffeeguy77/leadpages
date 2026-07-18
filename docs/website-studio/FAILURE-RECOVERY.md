# Application failure recovery

## Idempotency

Clients should send `idempotencyKey` on `apply-concept`.  
Retries with the same key return the original success payload and do not create duplicate sites, replacement drafts, or templates.

## Stages

| Stage | On failure |
|-------|------------|
| Permission / flags | No writes |
| Validation | Audit `failureStage: validation`; no site created |
| Image finalisation | Blocks commit when required images fail |
| Commit | Audit `failureStage: commit`; partial memory rows marked unsuccessful |

## Partial failure rule

A failed operation must not present an apparently successful incomplete website.  
Create-site commit only returns `ok: true` after the draft site row (or memory fallback) is created and the draft meta is updated.

## Resume

- Re-run `application-plan` after fixing contact/images/warnings
- Re-submit `apply-concept` with the same idempotency key after transient errors
- Discard replacement drafts explicitly — live site remains untouched
