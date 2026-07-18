# Website Studio — Approval Workflow (Draft Only)

**Updated:** 2026-07-18 (Phase 4)

## States

| State | Meaning |
|-------|---------|
| `draft` | Working concept |
| `selected` | Chosen among generated concepts |
| `ready-for-review` | Passed quality expectations for review |
| `approved-for-application` | Approved draft stored for a future apply phase |

API: `POST api/theme-studio/approve-draft`

A concept cannot be marked ready/approved when the quality gate returns `blocked`.

## Explicit non-actions

Phase 4 approval does **not**:

- Apply the draft to a live site  
- Overwrite current site configuration  
- Publish Marketplace templates  
- Alter production publishing  

Final Phase 4 action label: **Approve website draft** — not Publish website.

Approved drafts remain available for a future controlled migration/diff phase.
