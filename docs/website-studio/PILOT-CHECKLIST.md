# Website Studio — Superuser Pilot Checklist

**Business:** Bean Culture Coffee Roastery  
**Mode:** Create **new draft** site only — do **not** replace existing `beanculture` site  
**Audience:** Authenticated superusers only

## Pilot environment flags

```bash
THEME_STUDIO_V2=1
WEBSITE_STUDIO_PILOT_SUPERUSER_ONLY=1
WEBSITE_STUDIO_APPLICATION=1
WEBSITE_STUDIO_CREATE_SITE=1
WEBSITE_STUDIO_REPLACEMENT_DRAFT=0
WEBSITE_STUDIO_PRIVATE_TEMPLATE=0
WEBSITE_STUDIO_APPLICATION_AUDIENCE=superuser
THEME_STUDIO_ALLOW_LIVE_APPLY=0
```

Apply SQL:

- `db/website_studio_application.sql`
- `db/theme_studio_versions_kind_expand.sql` (expands `theme_studio_versions.kind` for `images` / `approve` / `restore` / edit kinds)

Require: Supabase service role, `CLOUDINARY_*`, `PEXELS_API_KEY` (server).

Brief template: `fixtures/website-composer/bean-culture-pilot-brief.js` (enter via UI — do not inject config).

---

## Workflow checklist

| # | Step | Result | Evidence |
|---|------|--------|----------|
| 1 | Superuser opens `/theme-studio-v2` | ☐ | screenshot |
| 2 | Partner/client session denied | ☐ | |
| 3 | Enter Bean Culture brief (real contact details) | ☐ | |
| 4 | Generate three concepts | ☐ | timing ___ ms |
| 5 | Desktop + mobile preview each concept | ☐ | |
| 6 | Select one concept + reason | ☐ | |
| 7 | Refine content/structure | ☐ | |
| 8 | Approve/approve images → Cloudinary import | ☐ | no Pexels URLs |
| 9 | Quality gate — review warnings | ☐ | |
| 10 | Mark `approved-for-application` | ☐ | |
| 11 | Review application plan | ☐ | |
| 12 | Create new draft site | ☐ | slug ≠ `beanculture` |
| 13 | Open in normal editor (`/manage.html?site=…`) | ☐ | |
| 14 | Edit every generated section; save; reload | ☐ | |
| 15 | Normal site preview | ☐ | |
| 16 | Form test to designated test recipient | ☐ | lead id ___ |
| 17 | Confirm site still `draft` / unpublished | ☐ | |
| 18 | Confirm existing Bean Culture site unchanged | ☐ | |
| 19 | **STOP — do not publish** | ☐ | |

## Deliberate failure drills

| Drill | Expected | Result |
|-------|----------|--------|
| Missing form recipient | Block | ☐ |
| Missing required image | Block | ☐ |
| Unapproved concept | Block | ☐ |
| Duplicate idempotency key | Replay, no second site | ☐ |
| Plumbing leakage in brief | Quality/validation block | ☐ |

## Marketplace apps (selected concept)

For each installed app: editor loads · fields editable · items add/remove · layout variants · image replace · reorder · disable · mobile · save/reload.

| App | Editor OK | Mobile OK | Notes |
|-----|-----------|-----------|-------|
| hero / heroSlider / splitHero | ☐ | ☐ | |
| packageCompare | ☐ | ☐ | cart/van/caravan |
| services | ☐ | ☐ | |
| featuredProjects | ☐ | ☐ | |
| brandStory | ☐ | ☐ | |
| clientLogos | ☐ | ☐ | only if real logos |
| bookingCta | ☐ | ☐ | |
| reviews | ☐ | ☐ | only if real testimonials |
| faq | ☐ | ☐ | |
| quote | ☐ | ☐ | |
| footer | ☐ | ☐ | |

## Sign-off

| Role | Name | Date | Verdict |
|------|------|------|---------|
| Superuser pilot | | | pass / fail |
| Eng review | | | |
