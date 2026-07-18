# Website Studio — Save & create options

**Updated:** 2026-07-18

Nothing in Website Studio publishes a live site. “Save” and “Create” mean different things.

## Quick map

| Control | Where | What it saves | Creates a site? | Publishes? |
|---------|--------|---------------|-----------------|------------|
| **Save Draft** | Sticky bar (bottom) | Creative brief on the Studio draft | No | No |
| **Approve selection** | Images | Image choices as a new draft **version** | No | No |
| **Save approval state** | Approve website draft | Approval flag on a new draft **version** | No | No |
| **Review application plan** | Create website… | Nothing (dry-run validation) | No | No |
| **Create website from this design** | Create website… | New LeadPages **draft site** / replacement draft / private template | Yes (draft / template) | No |
| **Save as My Template** | Legacy block | Private `theme_studio_templates` row | Template only | No |
| **Legacy confirm apply** | Legacy block | Older demo / draft scopes | Depends on scope | No |

## Required path to create a draft site

1. Generate + select a concept  
2. Approve images (**Approve selection**) if the plan lists required images  
3. Set **Approval state** → `approved-for-application` → **Save approval state**  
4. Fill site name, slug, valid business + lead emails, confirm contact  
5. Optional: **Review application plan** (shows blockers)  
6. **Create website from this design**

If create fails with **Pre-application validation failed**, open the plan panel below the buttons — blocking issues are listed there (e.g. `not_approved`, invalid email, unapproved images).

## Finding created work later

| Saved as | Where to open |
|----------|----------------|
| Studio draft (brief + versions) | `/theme-studio-v2` — same session draft id, or reopen via drafts API / superuser tooling |
| Draft LeadPages site | Normal site list / `/manage.html?site=<slug>` (status `draft`, `noindex`) |
| Private template | Theme Studio templates store (not public Marketplace) |

## Common blockers

| Code | Meaning | Fix |
|------|---------|-----|
| `not_approved` | Concept not `approved-for-application` | Save approval state with that value |
| `business_email_required` / `lead_recipient_required` | Missing or invalid email | Use a full address like `hello@business.com` (not `a@.com`) |
| `contact_not_confirmed` | Checkbox unchecked | Tick contact confirmation |
| `image_not_approved` / `temp_image_url` | Images not approved / still on Pexels | Approve selection; import to Cloudinary when required |
| `quality_*` | Quality gate critical | Refine content / fix placeholders |

See also: [APPLICATION.md](APPLICATION.md), [NEW-SITE-CREATION.md](NEW-SITE-CREATION.md), [APPROVAL-WORKFLOW.md](APPROVAL-WORKFLOW.md).
