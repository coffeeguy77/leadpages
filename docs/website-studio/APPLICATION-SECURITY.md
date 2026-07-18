# Application security review (Phase 5)

## Controls implemented

| Risk | Control |
|------|---------|
| Cross-tenant concept access | `assertDraftAccess` on draft owner / partner / superuser |
| Cross-tenant site application | `canManageTargetSite` for replacement mode |
| Forged approval state | Client `approvalState` ignored; server draft meta required |
| Version tampering | Version must belong to draft; approvedVersionId mismatch warns |
| Live overwrite | Replacement mode never writes `sites.config`; publish fields rejected |
| Role escalation | Mode permissions + audience flag server-side |
| Feature flags | Application defaults OFF; checked on every request |
| Form-recipient injection | Requires `contact.confirmed` + valid emails; partner-as-recipient explicit |
| Freeform config | Assembler strips diagnostics / protected fields; no Brain arbitrary writes |
| Temp image URLs | Blocked unless imported / mock test path |
| AI images | Unchanged — superuser only via Image Service permissions |
| Idempotency | `idempotencyKey` replays prior success without duplicate sites |
| Secrets in logs | Audit stores IDs/results only — no provider credentials |

## Explicitly rejected request fields

- `publish: true`, `status: 'live'`, `siteStatus: 'live'`
- Client-supplied privileged approval overrides
- Partner platform/public template visibility (non-superuser)

## Residual limitations

- In-memory audit/idempotency for tests and missing-table fallbacks; production should persist audits to a durable store in a follow-up
- Cloudinary binary upload still uses existing sign endpoint — application stores plans / final URLs after import
- Full entitlement checks against paid Marketplace purchases are best-effort via supported-app catalogue (not a billing entitlement service)
