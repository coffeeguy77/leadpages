# Guardian

`lib/ai-team/guardian.js` validates **Recommendations** and **Execution Plans**.

## Recommendation checks

- Required title/specialist
- Blocks `publish` / `applyLive`
- Blocks protected paths (forms, tracking, domains, billing, auth, webhooks)
- Forces `executable: false` on Atlas attach
- Warns if a recommendation smuggles config paths (Forge owns those)
- Warns when target capability is unknown

## Execution Plan checks (required before Apply)

- Plan must be `generatedBy: forge`
- Steps must declare operations
- CTA steps must be non-empty / non-generic
- FAQ/section enable must be allowlisted
- Protected config paths blocked
- Rollback strategy expected
- `canApply` only when critical checks pass and config steps exist

Guardian does not mutate sites or publish.
