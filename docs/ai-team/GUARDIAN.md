# Guardian

`lib/ai-team/guardian.js` validates recommendations.

Phase 1 checks:

- Required title/specialist
- Blocks `publish` / `applyLive`
- Blocks protected paths (forms, tracking, domains, billing, auth, webhooks)
- Forces `executable: false`
- Warns when target capability is unknown (prefer `capabilityGap`)

Guardian does not mutate sites.
