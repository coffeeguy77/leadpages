# Website Studio — Application (Phase 5)

**Updated:** 2026-07-18  
**Status:** Implemented behind feature flags (default OFF)

## Purpose

Turn an `approved-for-application` Website Studio concept into:

1. A **new draft LeadPages site** (not published)
2. A **replacement draft** for an existing site (live unchanged)
3. A **private reusable template** (not public Marketplace)

Publishing remains a separate, explicit product action. Application never sets `status: live`.

## Architecture

```text
Approved concept version
    ↓
Pre-application validation          lib/website-studio-application/validate.js
    ↓
Image finalisation plan             images.js
    ↓
Application plan + human diff       plan.js
    ↓
Safe config assembler               assemble.js
    ↓
Mode commit (create / replace / template)   apply.js
    ↓
Audit + idempotency                 audit.js
```

APIs:

| Endpoint | Role |
|----------|------|
| `POST /api/theme-studio/application-plan` | Plan + validate only |
| `POST /api/theme-studio/apply-concept` | Commit after `confirmPlan:true` |

UI: `/theme-studio-v2` step **Create website from this design**.

## Modes

| Mode | Constant | Result |
|------|----------|--------|
| Create new website | `create_site` | `sites` row `status: draft`, `seo.noindex: true` |
| Replacement draft | `replacement_draft` | Snapshot + replacement workspace; live config untouched |
| Private template | `private_template` | `theme_studio_templates` visibility `private` |

## Invariants

- `contentInheritance: "none"`, `sourceTemplateId: null` preserved in assembled config
- Deterministic adapters already applied during composition — application does not freeform-merge
- Studio diagnostics stripped; provenance stored under `__websiteStudioSource`
- Protected operational fields never written into design config
- Live overwrite path (`THEME_STUDIO_ALLOW_LIVE_APPLY`) is **not** used by Phase 5 replacement drafts

## Flags

See [ROLLOUT.md](ROLLOUT.md). All application flags default **off**.
