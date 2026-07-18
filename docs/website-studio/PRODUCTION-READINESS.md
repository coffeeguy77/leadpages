# Website Studio — Production Readiness (Phase 6)

**Updated:** 2026-07-18  
**Scope:** Superuser pilot readiness (not partner rollout)

Statuses: **pass** · **pass-with-warning** · **fail**

| Area | Status | Notes |
|------|--------|-------|
| Security | pass | Server authz; forged approval rejected; publish fields rejected; secrets not logged |
| Permissions | pass | `WEBSITE_STUDIO_PILOT_SUPERUSER_ONLY`; partners/clients denied; AI images superuser-only |
| Persistence | pass | `website_studio_application_audits` + `_idempotency` SQL; memory fallback for tests; `theme_studio_versions_kind_expand.sql` required on older pilot DBs |
| Idempotency | pass | Survives simulated process restart; duplicate create prevented |
| Image licensing metadata | pass | Attribution retained on import plan/result |
| Cloudinary import | pass-with-warning | Server-side import implemented; live credentials required in pilot env |
| Marketplace app compatibility | pass-with-warning | Composer+adapters covered; live editor per-app pass is checklist item |
| Editor handoff | pass | Draft site + `/manage.html?site=` link; no Studio-only public render |
| Forms | pass-with-warning | Explicit recipient enforced; live notification drill is checklist |
| SEO | pass | Draft `noindex`; leakage checks on composition |
| Accessibility | pass-with-warning | Quality gate checks; full a11y audit not exhaustive |
| Mobile rendering | pass | Neutral shell desktop/mobile preview + fixture snapshots |
| Error recovery | pass | Validation blocks; diagnostic IDs; idempotent retry |
| Performance | pass-with-warning | Measured in automated path (local); pilot env timings in checklist |
| Logging | pass | Structured `website_studio` events; no secrets/briefs |
| Backups | pass-with-warning | Replacement snapshots prefer `site_backups`; create-site is new row |
| Rollback | pass | Discard replacement; new draft can be cancelled; live untouched |
| Feature flags | pass | Application OFF by default; pilot documented |
| Support documentation | pass | Pilot checklist, issues register, rollout, application docs |

## Critical fails

None in code path for superuser pilot.

## Open ops items (do not block superuser pilot ready)

- Live Chrome/tablet session sign-off (PILOT-004)
- Live form notification send (PILOT-005)
- Cloudinary credentials verified in pilot environment

## Recommendation

**superuser pilot ready**

Not partner pilot ready until PILOT-004/005 signed off and no new critical/high defects remain.
