# Roadmap

## Phase 1 (shipped) — advisory

Site Brain, bootstrap review, Atlas panel, real capability registry, Guardian on recommendations, permissions, audit, docs, tests. Website Studio On Ice.

## Phase 2 (architecture lock) — Execution Plans

- **Execution Plan** object between Recommendation and Apply
- **Change Preview** before Apply (before/after, pages, risk, time)
- **Forge** as sole `sites.config` writer
- **Batch** selected recommendations → one plan / one diff / one rollback
- **Guardian** validation of Execution Plans
- **Rollback** via pre-apply config snapshot
- **Site Knowledge** = business truth (not generated copy)
- **Editor page/section context** for Atlas + Forge
- Atlas speaks **business outcomes** only (no config paths / section ids)

Still **no auto-publish**.

Supported Forge operations (expand later through the same pipeline only):

- Strengthen primary CTA (hero; sticky/footer when present)
- Enable FAQ for objections

## Phase 3+

Do not begin broader specialist execution until this pipeline is the only path.

Then: more Forge operations, Scout SEO execution, Echo copy drafts, Nova/Pulse interactive flows, Account Brain, Beacon hooks — each still:

Recommendation → Execution Plan → Guardian → Preview → Apply → Editor → User Publish
