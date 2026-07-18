# Website Studio rollout flags

**Updated:** 2026-07-18 (Phase 5)

## Access vs application

| Flag | Default | Purpose |
|------|---------|---------|
| `THEME_STUDIO_V2` | ON | Website Studio UI/API access |
| `THEME_STUDIO_ALLOW_LIVE_APPLY` | OFF | Legacy live config overwrite (not used by Phase 5 replacement drafts) |
| `WEBSITE_STUDIO_APPLICATION` | OFF | Master switch for Phase 5 application |
| `WEBSITE_STUDIO_CREATE_SITE` | OFF | Mode: create new draft site |
| `WEBSITE_STUDIO_REPLACEMENT_DRAFT` | OFF | Mode: replacement draft |
| `WEBSITE_STUDIO_PRIVATE_TEMPLATE` | OFF | Mode: private template save |
| `WEBSITE_STUDIO_APPLICATION_AUDIENCE` | `superuser` | Staged audience |

## Audience stages

Set `WEBSITE_STUDIO_APPLICATION_AUDIENCE` to:

1. `superuser` (default)
2. `selected_partners` / `partners`
3. `selected_clients` / `wider`

Studio access (`THEME_STUDIO_V2` + role policy) remains separate. Clients are still denied Studio UI in V1 unless product policy changes.

## AI images

Unchanged: superuser-only via Image Service. No rollout flag enables partner/client AI images.

## Phase 5 rule

Do **not** enable application flags globally as part of shipping the code. Ops enables them per stage.
