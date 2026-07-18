# Website Studio rollout flags

**Updated:** 2026-07-18 (Phase 6 superuser pilot)

## Access vs application

| Flag | Default | Pilot | Purpose |
|------|---------|-------|---------|
| `THEME_STUDIO_V2` | ON | ON | Website Studio UI/API |
| `WEBSITE_STUDIO_PILOT_SUPERUSER_ONLY` | OFF | **ON** | Deny partners/clients at Studio gate |
| `THEME_STUDIO_ALLOW_LIVE_APPLY` | OFF | OFF | Legacy live overwrite (unused by Phase 5/6 create) |
| `WEBSITE_STUDIO_APPLICATION` | OFF | **ON** (pilot env only) | Master application switch |
| `WEBSITE_STUDIO_CREATE_SITE` | OFF | **ON** (pilot) | New draft site mode |
| `WEBSITE_STUDIO_REPLACEMENT_DRAFT` | OFF | OFF | Replacement drafts |
| `WEBSITE_STUDIO_PRIVATE_TEMPLATE` | OFF | OFF | Private templates |
| `WEBSITE_STUDIO_APPLICATION_AUDIENCE` | `superuser` | `superuser` | Audience stage |

## Pilot environment

See `describePilotFlagConfiguration()` / [PILOT-CHECKLIST.md](PILOT-CHECKLIST.md).

SQL required: `db/website_studio_application.sql`

## Audience stages (future)

1. superuser (current pilot)  
2. selected_partners / partners — **not enabled**  
3. selected_clients / wider — **not enabled**

## AI images

Unchanged: superuser-only. No flag enables partner/client AI images.

## Rule

Do not enable application flags globally. Do not enable partners/clients until Phase 6 pilot sign-off and explicit approval.
